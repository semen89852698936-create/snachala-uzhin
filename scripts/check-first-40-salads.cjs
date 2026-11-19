#!/usr/bin/env node
'use strict';
/** Staging consistency and gated release checks for first 40 approved world salads. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../data/editorial/salads');
const names=['01-russian','02-italian','03-french','04-spanish'];
const source=names.flatMap(n=>JSON.parse(fs.readFileSync(path.join(root,n+'.json'),'utf8')).recipes);
const compiled=JSON.parse(fs.readFileSync(path.join(root,'world-100-catalog.json'),'utf8')).recipes.slice(0,40);
const stage=JSON.parse(fs.readFileSync(path.join(root,'first-40-staging-catalog.json'),'utf8'));
const preflight=JSON.parse(fs.readFileSync(path.join(root,'first-40-publication-preflight.json'),'utf8'));
assert.equal(source.length,40);assert.equal(compiled.length,40);assert.equal(stage.recipes.length,40);assert.equal(preflight.entries.length,40);
const keys=['id','title','minutes','description','ingredients','steps','tip','warn','photoBrief','sourceReview'];
const seen=new Set();
for(let i=0;i<40;i++){
 const a=source[i],c=compiled[i],s=stage.recipes[i],p=preflight.entries[i];
 assert.ok(!seen.has(a.id),'duplicate recipe '+a.id);seen.add(a.id);
 assert.equal(a.editorialApproval?.status,'approved_by_user');
 for(const key of keys){assert.deepEqual(a[key],c[key],a.id+' source/compiled mismatch '+key);assert.deepEqual(s[key],c[key],a.id+' stage/compiled mismatch '+key)}
 assert.equal(p.id,a.id,'preflight id mismatch');
 assert.ok(a.ingredients.length>=5&&a.steps.length>=4);
 assert.equal(a.base,2);
 for(const step of a.steps){assert.ok(Number.isInteger(step.timer)&&step.timer>=0,'bad timer '+a.id)}
 assert.equal(p.readyForPublish,false,'release unexpectedly marked ready');
}
console.log('PASS: 40 unique approved source, compiled, staged and preflight recipe IDs align.');
console.log('PASS: titles, ingredients, steps, timers, warnings, source refs and photo briefs are identical.');
if(process.argv.includes('--release')){
 const blockers=[];
 for(let i=0;i<40;i++){
  const x=compiled[i],p=preflight.entries[i];
  if(!p.sourceAuditCompleted)blockers.push(x.id+': unverified source audit');
  if(!p.photoVerifiedForRecipe||!p.photoPath)blockers.push(x.id+': no verified photo');
  if(p.photoPath&&!fs.existsSync(path.resolve(__dirname,'..',p.photoPath)))blockers.push(x.id+': missing local photo file');
 }
 if(blockers.length){console.error('BLOCKED: '+blockers.length+' release prerequisites not satisfied');blockers.slice(0,12).forEach(x=>console.error(x));process.exit(2)}
}
console.log('NOTE: staging integrity PASS does not mean web deployment or visual publication QA PASS.');
