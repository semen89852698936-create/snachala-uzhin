#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const base=read('data/ten-new-dishes-editorial.json');
const correction=read('data/new-dishes-photo-fidelity-v2.json');
const expected=new Set([
'nd-beef-goulash-potatoes',
'nd-beef-stroganoff-classic',
'nd-beef-stroganoff-mushrooms',
'nd-beef-peppers-soy',
'nd-beef-slow-onion',
'nd-pork-mushrooms-sourcream',
'nd-pork-oven-shashlik'
]);
assert.equal(base.recipe_count,10);
assert.equal(base.existing_main_catalog_count_unmodified,1001);
assert.equal(correction.recipes.length,7);
assert.equal(new Set(correction.recipes.map(r=>r.id)).size,7);
assert.deepEqual(new Set(correction.recipes.map(r=>r.id)),expected);
for(const dish of base.recipes){
 const corrected=expected.has(dish.id);
 const shouldBe='/assets/new-dishes/'+(corrected?'review-v2/':'')+dish.id+'.webp';
 assert.equal(dish.photo,shouldBe,dish.id+' wrong photo');
 assert.ok(fs.existsSync(path.join(root,dish.photo.slice(1))),dish.id+' missing physical photo');
 assert.equal(dish.base,2);
 if(corrected){
  assert.equal(dish.photo_revision,'source_fidelity_v2_20261113');
  assert.equal(dish.photo_status,'revised_generated_pending_visual_review');
  const meta=read('photo-library/new-dishes/review-v2/records/'+dish.id+'.json');
  assert.equal(meta.source_document,'Новые блюда.docx');
  assert.equal(meta.status,'generated_pending_owner_visual_review');
  assert.match(meta.sha256,/^[a-f0-9]{64}$/);
 }
}
assert.match(correction.recipes.find(r=>r.id==='nd-beef-goulash-potatoes').photo_brief,/НЕ суп/);
assert.match(correction.recipes.find(r=>r.id==='nd-beef-stroganoff-classic').photo_brief,/ДЛИННЫЕ ТОНКИЕ ПОЛОСКИ/);
assert.match(correction.recipes.find(r=>r.id==='nd-beef-stroganoff-mushrooms').photo_brief,/МЕЛКО НАРЕЗАННЫЕ/);
assert.match(correction.recipes.find(r=>r.id==='nd-beef-peppers-soy').photo_brief,/НЕТ лужи/);
assert.match(correction.recipes.find(r=>r.id==='nd-beef-slow-onion').photo_brief,/ЛУКА НЕ ВИДНО/);
assert.match(correction.recipes.find(r=>r.id==='nd-pork-mushrooms-sourcream').photo_brief,/КУБИКАМИ/);
assert.match(correction.recipes.find(r=>r.id==='nd-pork-oven-shashlik').photo_brief,/БЕЗ шпажек/);
console.log('PASS: exactly seven physical v2 photo references and metadata; three existing photos unchanged; 1001 recipe catalog preserved');
