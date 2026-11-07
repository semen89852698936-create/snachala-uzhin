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
const potato=data.recipes.find(r=>r.id==='af-potato-wedges-2');
assert.ok(potato,'potato wedges candidate must exist');
assert.ok(potato.prep_minutes>=55,'potato prep must include 30+15 minutes soaking plus 10 minutes active prep');
assert.match(potato.additional_prep||'',/30 минут/,'cold soak must remain explicit');
assert.match(potato.additional_prep||'',/15 минут/,'hot soak must remain explicit');
// Prevent misleading airfryer claims: the bread is toasted outside the appliance.
const mushrooms=data.recipes.find(r=>r.id==='af-mushrooms-thyme-toast-2');
assert.ok(mushrooms,'mushroom toast candidate must exist');
assert.doesNotMatch(mushrooms.title,/тостах из аэрогриля/i,'title must not claim airfried bread');
assert.match(mushrooms.basket,/хлеб поджарить отдельно/i,'bread preparation must remain separate');
assert.match(mushrooms.steps.join(' '),/тостере или на сухой сковороде/i,'bread method must be explicit');
assert.match(mushrooms.steps.join(' '),/не включать обжаривание хлеба в 12–15 минут/i,'cook time must apply only to mushrooms');
// Poultry instructions must explicitly prevent cross-contamination; internal temperature alone is insufficient.
const chicken=data.recipes.find(r=>r.id==='af-chicken-paprika-2');
assert.ok(chicken,'chicken candidate must exist');
const chickenMethod=chicken.steps.join(' ');
assert.match(chickenMethod,/сырую курицу не мыть/i,'do not wash raw poultry');
assert.match(chickenMethod,/вымыть руки, нож и доску/i,'clean hands and utensils after handling raw poultry');
assert.match(chickenMethod,/74\\s*°C/,'safe internal temperature remains explicit');
assert.match(chickenMethod,/не использовать для готового мяса посуду/i,'avoid reusing contaminated serving utensils');
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
assert.ok(/^assets\/[\w./-]+\.webp$/.test('assets/airfryer-salmon.webp'),'valid WebP path must pass release regex');
assert.ok(!/^assets\/[\w./-]+\.webp$/.test('assets/airfryer-salmon.png'),'non-WebP must fail release regex');
const missing=data.recipes.filter(r=>r.photo_status!=='ready'||!r.photo_webp);
if(process.argv.includes('--release')){
  assert.doesNotMatch(data.status,/NOT published|NOT experimentally verified|editorial candidates/i,'draft cannot ship');
  assert.equal(missing.length,0,'matching WebP photos required');
  for(const r of data.recipes){
    assert.ok(typeof r.photo_webp==='string'&&/^assets\/[\w./-]+\.webp$/.test(r.photo_webp)&&!r.photo_webp.includes('..'),r.id+' invalid photo path');
    const photoPath=path.resolve(root,r.photo_webp);
    assert.ok(photoPath.startsWith(path.resolve(root,'assets')+path.sep),r.id+' photo outside assets');
    assert.ok(fs.existsSync(photoPath),r.id+' photo missing');
    const photo=fs.readFileSync(photoPath);
    assert.ok(photo.length>=12&&photo.toString('ascii',0,4)==='RIFF'&&photo.toString('ascii',8,12)==='WEBP',r.id+' invalid WebP signature');
    // Editorial sources and a matching photograph do not establish real-appliance verification.
    // Require recorded independent cooking QA before any candidate is eligible for release.
    assert.equal(r.appliance_test?.status,'passed',r.id+' real-appliance QA missing');
    assert.ok(typeof r.appliance_test?.model==='string'&&r.appliance_test.model.trim(),r.id+' tested appliance model missing');
    assert.ok(typeof r.appliance_test?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.appliance_test.date),r.id+' test date missing');
    assert.ok(typeof r.appliance_test?.notes==='string'&&r.appliance_test.notes.trim(),r.id+' cooking observations missing');
  }
}
console.log('PASS '+data.recipes.length+' editorial candidates; '+missing.length+' photos pending. No publication claimed.');
