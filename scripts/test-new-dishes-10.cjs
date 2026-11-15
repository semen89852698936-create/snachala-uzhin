#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/ten-new-dishes-editorial.json'),'utf8'));
assert.equal(data.recipe_count,10);
assert.equal(data.existing_main_catalog_count_unmodified,1001);
assert.equal(data.recipes.length,10);
assert.equal(data.integration_policy.do_not_change_catalog_or_existing_recipe_ids,true);
assert.equal(new Set(data.recipes.map(r=>r.id)).size,10);
for(let n=0;n<data.recipes.length;n++){
 const r=data.recipes[n];
 assert.equal(r.base,2,r.id+' must be for two people');
 assert.ok(['meat','poultry'].includes(r.category),r.id+' unexpected category');
 assert.ok(r.title&&r.description&&r.photo_brief,r.id+' needs copy and unique photo brief');
 assert.ok(Number.isInteger(r.minutes)&&r.minutes>=35&&r.minutes<=270,r.id+' invalid total duration');
 assert.ok(r.ingredients.length>=7,r.id+' incomplete ingredients');
 assert.ok(r.steps.length>=4,r.id+' incomplete steps');
 assert.ok(r.steps.some(s=>s.timer>0),r.id+' has no timer');
 assert.equal(r.photo,'/assets/new-dishes/'+r.id+'.webp');
 assert.equal(r.source_photo_page,[1,2,4,6,8,9,11,13,14,16][n]);
 for(const i of r.ingredients){
  assert.ok(i.name&&i.unit, r.id+' missing ingredient details');
  assert.ok(Number.isFinite(i.amount)&&i.amount>=0,r.id+' invalid ingredient quantity');
 }
 for(const s of r.steps){
  assert.ok(s.title&&s.detail&&Number.isInteger(s.timer)&&s.timer>=0,r.id+' invalid step');
 }
}
const page=fs.readFileSync(path.join(root,'new-dishes/index.html'),'utf8');
assert.match(page,/ten-new-dishes-editorial\.json/);
assert.match(page,/data-next/);
assert.match(page,/data-prev/);
assert.match(page,/aria-hidden/);
assert.match(page,/plov-timer/);
console.log('PASS: ten editorial new dishes, quantities, source image mapping, steps, timed cooking and isolated page');
