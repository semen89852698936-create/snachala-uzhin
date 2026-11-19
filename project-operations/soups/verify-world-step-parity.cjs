#!/usr/bin/env node
'use strict';
/**
 * Exact content parity between 100 canonical Markdown recipes and the compiled JSON.
 * Checks steps, not merely 3 URL strings or counts.
 * This is a structural consistency check, not external culinary source verification.
 */
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const files=['russian-01-03.md','russian-04.md','russian-05-10.md','italian-11-20.md','french-21-30.md','spanish-31-40.md','turkish-41-50.md','japanese-51-60.md','korean-61-70.md','mexican-71-80.md','vietnamese-81-90.md','chinese-91-100.md'];
const recipes=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_RECIPES.json'),'utf8')).recipes;
const byId=new Map(recipes.map(x=>[x.id,x])),errors=[],seen=new Set();
const normal=s=>String(s).replace(/\s+/g,' ').trim();
for(const file of files){
 const full=fs.readFileSync(path.join(dir,file),'utf8');
 const heads=[...full.matchAll(/(?:^|\n)#{1,3}\s+№(\d+)\.\s*/g)];
 for(let h=0;h<heads.length;h++){
  const id=Number(heads[h][1]),section=full.slice(heads[h].index,heads[h+1]?.index??full.length);
  if(seen.has(id)){errors.push('#'+id+' duplicate in manuscripts');continue;}
  seen.add(id);
  const marker=id===4?section.match(/## Готовим\s*/):section.match(/\*\*(?:Готовим|Как готовить|Приготовление|Пошагово|Пошаговое приготовление)[^*]*\*\*\s*/i);
  if(!marker){errors.push('#'+id+' missing cooking steps marker');continue;}
  const start=marker.index+marker[0].length;
  let end=id===4?section.indexOf('\n## ',start):section.indexOf('\n\n**',start);
  if(end<0)end=section.indexOf('\n## ',start);
  if(end<0)end=section.length;
  const body=section.slice(start,end).trim();
  const markers=[...body.matchAll(/(?:^|\s)(\d+)\.\s+/g)];
  const extracted=markers.map((m,i)=>body.slice(m.index+m[0].length,markers[i+1]?.index??body.length).trim());
  const compiled=byId.get(id);
  if(!compiled){errors.push('#'+id+' not in JSON');continue;}
  if(extracted.length!==compiled.steps.length){errors.push('#'+id+' step count mismatch '+extracted.length+' vs '+compiled.steps.length);continue;}
  for(let i=0;i<extracted.length;i++)if(normal(extracted[i])!==normal(compiled.steps[i]))errors.push('#'+id+' cooking step '+(i+1)+' differs between manuscript and JSON');
  const expectedText=compiled.steps.map((s,i)=>(i+1)+'. '+s).join('\n');
  if(normal(expectedText)!==normal(compiled.steps_text))errors.push('#'+id+' steps_text not in sync with steps array');
 }
}
if(seen.size!==100)errors.push('Markdown contains '+seen.size+' unique recipes; expected 100');
if(errors.length){console.error('FAIL '+errors.length+' content mismatches\n'+errors.join('\n'));process.exit(1);}
console.log('PASS: All 100 JSON step arrays and steps_text match canonical Markdown manuscript verbatim (whitespace normalized). No external recipe content was verified by this test.');
