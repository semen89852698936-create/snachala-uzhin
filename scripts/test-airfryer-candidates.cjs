#!/usr/bin/env node
'use strict';
// Editorial QA for pilot recipes. Never equate this with real-appliance tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/airfryer-editorial-candidates.json'),'utf8'));
function audit(r){
  const issues=[];
  for(const k of ['id','title','category','preheat','basket','turn','reference'])if(!r[k])issues.push('missing '+k);
  if(!Array.isArray(r.ingredients)||r.ingredients.length<3||r.ingredients.some(a=>!Array.isArray(a)||a.length!==2||a.some(v=>typeof v!=='string'||!v.trim())))issues.push('ingredients');
  if(!Number.isInteger(r.prep_minutes)||r.prep_minutes<0||r.prep_minutes>180)issues.push('prep time');
  if(!Number.isInteger(r.temperature_c)||r.temperature_c<120||r.temperature_c>230)issues.push('temperature');
  if(!Array.isArray(r.cook_minutes)||r.cook_minutes.length!==2||r.cook_minutes[0]<1||
     !r.cook_minutes.every(Number.isInteger)||r.cook_minutes[0]>r.cook_minutes[1]||r.cook_minutes[1]>120)issues.push('time');
  if(!Array.isArray(r.steps)||r.steps.length<3||r.steps.some(step=>typeof step!=='string'||!step.trim()))issues.push('steps');
  const s=Array.isArray(r.steps)?r.steps.join(' '):'';
  if(!/(?:1[2-9]\d|2[0-3]\d)\s*°\s*[CcСс]?/.test(s)||!/\d+\s*(?:[-–]\s*\d+\s*)?минут/.test(s))issues.push('method must state temperature and time');
  if(!/од(?:ин|ним|ного|ном)[^.;]{0,35}сло/i.test(r.basket||''))issues.push('single-layer basket');
  if(/куриц|курин/i.test(r.title||'')&&!/74\s*°/.test(s))issues.push('poultry core 74°C');
  if(/лосос|форел|рыб/i.test(r.title||'')&&!/63\s*°/.test(s))issues.push('fish core 63°C');
  if(!/^https:\/\//.test(r.reference||''))issues.push('source HTTPS');
  if(!['required','ready'].includes(r.photo_status))issues.push('photo_status');
  if(r.photo_status==='ready'&&!r.photo_webp)issues.push('photo marked ready without WebP');
  if(r.photo_webp&&(!/^assets\/[\w./-]+\.webp$/.test(r.photo_webp)||r.photo_webp.includes('..')))issues.push('local photo path');
  return issues;
}
assert.equal(data.schema,'airfryer-editorial-draft-v1');
assert.equal(data.servings,2);
assert.ok(Array.isArray(data.recipes)&&data.recipes.length>=3);
assert.equal(new Set(data.recipes.map(r=>r.id)).size,data.recipes.length,'duplicate IDs');
for(const r of data.recipes)assert.deepEqual(audit(r),[],r.id+' invalid metadata');
// Test that failures really are detected, not merely printed.
const r=data.recipes[1];
assert.ok(audit({...r,temperature_c:300}).includes('temperature'));
assert.ok(audit({...r,cook_minutes:[30,10]}).includes('time'));
assert.ok(audit({...r,cook_minutes:['10','20']}).includes('time'),'string minutes must not pass numeric QA');
assert.ok(audit({...r,cook_minutes:[10.5,20]}).includes('time'),'fractional minutes require explicit editorial normalization');
assert.ok(audit({...r,prep_minutes:'7'}).includes('prep time'),'prep minutes must be numeric');
assert.ok(audit({...r,ingredients:[['курица',''],['масло','1 ч. л.'],['соль','по вкусу']]}).includes('ingredients'),'empty ingredient quantity cannot pass');
assert.ok(audit({...r,steps:['Подготовить',' ', 'Готовить']}).includes('steps'),'empty cooking step cannot pass');
assert.ok(audit({...r,photo_status:'ready',photo_webp:null}).includes('photo marked ready without WebP'));
assert.ok(audit({...r,steps:['Приготовить на глаз']}).length);
const missing=data.recipes.filter(r=>r.photo_status!=='ready'||!r.photo_webp);
if(process.argv.includes('--release')){
  assert.doesNotMatch(data.status,/NOT published|NOT experimentally verified|editorial candidates/i,'draft cannot ship');
  assert.equal(missing.length,0,'matching WebP photos required');
  for(const r of data.recipes){
    assert.ok(fs.existsSync(path.join(root,r.photo_webp)),r.id+' photo missing');
    // Editorial sources and a matching photograph do not establish real-appliance verification.
    // Require recorded independent cooking QA before any candidate is eligible for release.
    assert.equal(r.appliance_test?.status,'passed',r.id+' real-appliance QA missing');
    assert.ok(typeof r.appliance_test?.model==='string'&&r.appliance_test.model.trim(),r.id+' tested appliance model missing');
    assert.ok(typeof r.appliance_test?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.appliance_test.date),r.id+' test date missing');
    assert.ok(typeof r.appliance_test?.notes==='string'&&r.appliance_test.notes.trim(),r.id+' cooking observations missing');
  }
}
console.log('PASS '+data.recipes.length+' editorial candidates; '+missing.length+' photos pending. No publication claimed.');
