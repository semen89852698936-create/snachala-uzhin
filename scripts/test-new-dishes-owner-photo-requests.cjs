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
assert.equal(new Set(data.recipes.map(r=>r.id)).size,10);
const byId=new Map(data.recipes.map(r=>[r.id,r]));
assert.equal(byId.get('nd-pork-mushrooms-sourcream').title,'Свинина, тушеная с грибами в сметанном соусе');
assert.match(byId.get('nd-beef-slow-onion').steps[0].detail,/кубиками примерно 3–4 см/);
assert.match(byId.get('nd-beef-slow-onion').photo_brief,/МАТОВУЮ/);
assert.match(byId.get('nd-pork-oven-shashlik').photo_brief,/ЗАПЕЧЁННЫЙ/);
const four=[
 'nd-beef-slow-onion',
 'nd-pork-mushrooms-sourcream',
 'nd-beef-stroganoff-mushrooms',
 'nd-pork-oven-shashlik'
];
assert.deepEqual(new Set(data.owner_approved_collage.approved_recipe_ids),new Set(four));
assert.equal(data.owner_approved_collage.do_not_regenerate,true);
for(const id of four){
 const r=byId.get(id);
 assert.equal(r.photo_status,'owner_approved',id);
 assert.equal(r.photo_editorial_status,'approved',id);
 assert.equal(r.photo,'/assets/new-dishes/approved-collage-4/'+id+'.webp',id);
 const file=path.join(root,r.photo.slice(1));
 assert.ok(fs.existsSync(file),file+' missing');
 assert.ok(fs.statSync(file).size>15000,file+' appears empty');
}
const six={
 'nd-rustic-pork-potatoes':'/assets/new-dishes/nd-rustic-pork-potatoes.webp',
 'nd-pork-vegetables-tomato':'/assets/new-dishes/nd-pork-vegetables-tomato.webp',
 'nd-beef-goulash-potatoes':'/assets/new-dishes/review-v3/nd-beef-goulash-potatoes.webp',
 'nd-beef-stroganoff-classic':'/assets/new-dishes/review-v3/nd-beef-stroganoff-classic.webp',
 'nd-beef-peppers-soy':'/assets/new-dishes/review-v3/nd-beef-peppers-soy.webp',
 'nd-chicken-mushroom-julienne':'/assets/new-dishes/nd-chicken-mushroom-julienne.webp'
};
for(const [id,p] of Object.entries(six)){assert.equal(byId.get(id).photo,p,id);}
const html=fs.readFileSync(path.join(root,'new-dishes/index.html'),'utf8');
assert.match(html,/fetch\('\/data\/ten-new-dishes-editorial\.json'\)/);
console.log('PASS: all four exact owner-approved collage panels exist; other six unaffected; title correct; catalog remains 1001');
