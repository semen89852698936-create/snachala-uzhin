#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname,'..');
const mainSha = 'c19b0ba277441f445c4d8533340e39d3299cf6ab';
const files = ['index.html','full-catalog/index.html'];
const photoFolder = 'assets/replacement-20-20261116/';
const json = rel => JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const plan = json('project-operations/catalog-20-swap-map-20261116.json');
const assets = json('project-operations/catalog-20-asset-map-20261116.json');
const payload = json('data/catalog-20-replacement-payload-20261116.json');
const openPattern = '<script id="recipeData" type="application/json">';
const parse = html => {
 const start=html.indexOf(openPattern);
 assert.ok(start>=0, 'recipeData missing');
 const jsonStart=start+openPattern.length;
 const end=html.indexOf('</script>', jsonStart);
 assert.ok(end>jsonStart);
 assert.equal(html.indexOf(openPattern,start+1),-1,'more than one recipeData');
 return {prefix:html.slice(0,jsonStart),suffix:html.slice(end),recipes:JSON.parse(html.slice(jsonStart,end))};
};
assert.equal(plan.replacements.length,20);
assert.equal(assets.entries.length,20);
assert.equal(payload.recipes.length,20);
const ids=new Set(payload.recipes.map(x=>x.id));
assert.equal(ids.size,20);
const byId = new Map(payload.recipes.map(x=>[x.id,x]));
const originals=new Set(plan.replacements.map(x=>x.old_id));
assert.equal(originals.size,20);
const expectCats={meat:17,poultry:2,vegetables:1};
const counts={};
for(const r of payload.recipes){
 counts[r.category]=(counts[r.category]||0)+1;
 assert.equal(r.base,2);
 assert.ok(r.title && r.description && r.ingredients.length>=4);
 assert.ok(r.steps.length>=4);
 assert.ok(r.steps.every(s=>s.title && s.detail && Number.isFinite(s.timer)));
 assert.ok(r.photo.startsWith('/'+photoFolder));
 const p=path.join(root,r.photo.slice(1));
 assert.ok(fs.existsSync(p),p+' is missing');
 const signature=fs.readFileSync(p).subarray(0,12);
 assert.equal(signature.toString('ascii',0,4),'RIFF');
 assert.equal(signature.toString('ascii',8,12),'WEBP');
 const map=assets.entries.find(x=>x.new_id===r.id);
 assert.ok(map);
 assert.equal(map.category,r.category);
 assert.equal(map.path,r.photo.slice(1));
 const sha=execFileSync('git',['hash-object',p],{encoding:'utf8'}).trim();
 assert.equal(sha,map.blobSha,'wrong photo SHA for '+r.id);
}
assert.deepEqual(counts,expectCats);
const approved=new Set(['nd-beef-slow-onion','nd-pork-mushrooms-sourcream','nd-beef-stroganoff-mushrooms','nd-pork-oven-shashlik']);
assert.deepEqual(new Set(assets.entries.filter(x=>x.fromSource==='four_no_text_photos_generation_20261116').map(x=>x.new_id)),approved);
assert.equal(byId.get('nd-pork-mushrooms-sourcream').title,'Свинина, тушеная с грибами в сметанном соусе');
assert.equal(byId.get('plov-mushroom-bell-pepper').category,'vegetables');
assert.equal(byId.get('plov-chicken-prunes').category,'poultry');
assert.equal(byId.get('nd-chicken-mushroom-julienne').category,'poultry');

const catalogs=[];
for(const rel of files){
 const raw=fs.readFileSync(path.join(root,rel),'utf8');
 const old=execFileSync('git',['show',mainSha+':'+rel],{encoding:'utf8',maxBuffer:6*1024*1024});
 const before=parse(old),after=parse(raw);
 assert.equal(after.prefix,before.prefix,'layout/CSS/script before recipeData changed: '+rel);
 assert.equal(after.suffix,before.suffix,'layout/CSS/script after recipeData changed: '+rel);
 assert.equal(after.recipes.length,1001,rel+' wrong number of recipes');
 assert.equal(new Set(after.recipes.map(x=>x.id)).size,1001,rel+' duplicate IDs');
 const groupSizes={};
 for(const r of after.recipes)groupSizes[r.category]=(groupSizes[r.category]||0)+1;
 for(const group of ['meat','poultry','vegetables','pasta','fish','pastry','soup','dessert','salads','breakfast']){
  assert.equal(groupSizes[group],100,rel+' count mismatch '+group);
 }
 assert.equal(groupSizes.bonus,1);
 const oldById=new Map(before.recipes.map((r,i)=>[r.id,{recipe:r,index:i}]));
 const afterById=new Map(after.recipes.map((r,i)=>[r.id,{recipe:r,index:i}]));
 for(const [id,record] of oldById){
  if(originals.has(id)){
   assert.equal(afterById.has(id),false,'Old card remains '+id);
  }else{
   const a=after.recipes[record.index];
   assert.deepEqual(a,record.recipe,'Unexpected change outside targeted recipe '+id);
  }
 }
 for(const row of plan.replacements){
  const oldIndex=oldById.get(row.old_id).index;
  const final=afterById.get(row.new_id);
  assert.ok(final,'Missing new recipe '+row.new_id);
  assert.equal(final.index,oldIndex,'New recipe not in same original slot '+row.new_id);
  assert.deepEqual(final.recipe,byId.get(row.new_id));
 }
 for(const saved of plan.kept_from_meat_shortlist){
  assert.ok(afterById.has(saved),'Must keep recipe from shortlist '+saved);
 }
 catalogs.push(after.recipes);
}
assert.deepEqual(catalogs[0],catalogs[1],'home page and full catalog diverged');
console.log('PASS: 20 exact 1:1 swaps, 17+2+1 categories, 1001 unique recipes, 20 physical WebP images, both HTML datasets identical, all layout/CSS/JS bytes unchanged');
