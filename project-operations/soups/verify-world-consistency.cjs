#!/usr/bin/env node
'use strict';
// Ensures the compiled 100-soup JSON matches the 12 editorial source manuscripts.
// This is a technical consistency gate, not proof that external recipes were read.
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const chunks=['russian-01-03.md','russian-04.md','russian-05-10.md','italian-11-20.md','french-21-30.md','spanish-31-40.md','turkish-41-50.md','japanese-51-60.md','korean-61-70.md','mexican-71-80.md','vietnamese-81-90.md','chinese-91-100.md'];
const data=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_RECIPES.json'),'utf8'));
const errors=[], seen=new Set(), byId=new Map();
for(const fname of chunks){
 const txt=fs.readFileSync(path.join(dir,fname),'utf8');
 const h=[...txt.matchAll(/(?:^|\n)#{1,3}\s+№(\d+)\.\s/g)];
 for(let i=0;i<h.length;i++){
  const n=Number(h[i][1]),sec=txt.slice(h[i].index,h[i+1]?.index??txt.length);
  if(seen.has(n))errors.push('Duplicate #'+n);
  seen.add(n);
  const urls=[...sec.matchAll(/https:\/\/[^\s)\]<>]+/g)].map(m=>m[0].replace(/[.,;:]$/,'')).slice(0,3);
  byId.set(n,{fname,urls});
 }
}
for(const x of data.recipes){
 const row=byId.get(x.id);
 if(!row) {errors.push('#'+x.id+' missing manuscript');continue;}
 if(row.urls.length!==3 || row.urls.join('\n')!==x.recipe_sources.join('\n')) errors.push('#'+x.id+' source mismatch between markdown and JSON');
 if(!Array.isArray(x.steps)||x.steps.length<5||x.steps.some(s=>s.length<12))errors.push('#'+x.id+' unparsed steps');
 if(!Array.isArray(x.ingredient_items)||x.ingredient_items.length<4||x.ingredient_items.some(s=>!s))errors.push('#'+x.id+' unparsed ingredients');
 if(x.recipe_source_audit_status==='VERIFIED' && !x.source_content_evidence)errors.push('#'+x.id+' claims verified without evidence');
 if(x.photo_approved===true && !x.photo_path)errors.push('#'+x.id+' claims image approval without file');
}
if(seen.size!==100||data.recipes.length!==100)errors.push('Exactly 100 recipes required');
const summary={manuscripts:chunks.length,recipes:data.recipes.length,ingredients:data.recipes.reduce((n,x)=>n+x.ingredient_items.length,0),steps:data.recipes.reduce((n,x)=>n+x.steps.length,0),urls:data.recipes.reduce((n,x)=>n+x.recipe_sources.length,0),sources_match_markdown:errors.length===0,errors};
console.log(JSON.stringify(summary,null,2));
if(errors.length)process.exit(1);
console.log('PASS: 100 compiled soup recipes exactly match Markdown source references, steps and ingredient arrays complete.');
