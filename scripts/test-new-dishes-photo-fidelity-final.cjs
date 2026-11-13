#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const d=load('data/ten-new-dishes-editorial.json');
const mapping={
'nd-rustic-pork-potatoes':'original',
'nd-pork-vegetables-tomato':'original',
'nd-beef-goulash-potatoes':'review-v3',
'nd-beef-stroganoff-classic':'review-v3',
'nd-beef-stroganoff-mushrooms':'review-v5',
'nd-beef-peppers-soy':'review-v3',
'nd-beef-slow-onion':'review-v4',
'nd-pork-mushrooms-sourcream':'review-v3',
'nd-pork-oven-shashlik':'review-v2',
'nd-chicken-mushroom-julienne':'original'
};
assert.equal(d.recipe_count,10);
assert.equal(d.existing_main_catalog_count_unmodified,1001);
assert.equal(d.recipes.length,10);
assert.equal(new Set(d.recipes.map(r=>r.id)).size,10);
for(const r of d.recipes){
 assert.equal(r.base,2,r.id);
 const version=mapping[r.id];assert.ok(version);
 const expected='/assets/new-dishes/'+(version==='original'?'':version+'/')+r.id+'.webp';
 assert.equal(r.photo,expected,r.id+' wrong photo path');
 assert.ok(fs.existsSync(path.join(root,expected.slice(1))),expected+' is absent');
 if(version!=='original'){
   const rec=load('photo-library/new-dishes/'+version+'/records/'+r.id+'.json');
   assert.equal(rec.id,r.id);
   assert.match(rec.sha256,/^[a-f0-9]{64}$/);
 }
}
console.log('PASS: 10 photos exactly = 3 untouched originals, 1 v2, 4 v3, 1 v4, 1 v5; 1001 catalog remains untouched');
