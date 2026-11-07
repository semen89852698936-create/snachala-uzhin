'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const batches = Array.from({length:10},(_,i)=>JSON.parse(fs.readFileSync(path.join(root,'data',`airfryer-recipes-batch-${String(i+1).padStart(2,'0')}.json`),'utf8')));
const recipes = batches.flatMap(batch=>batch.recipes);
assert.equal(recipes.length,100,'airfryer catalog must contain exactly 100 recipes');
assert.equal(new Set(recipes.map(r=>r.id)).size,100,'recipe IDs must be unique');
for(const recipe of recipes){
  assert.ok(recipe.title && recipe.ingredients?.length && recipe.steps?.length,recipe.id+' needs title, ingredients and steps');
  assert.ok(recipe.temperature_c>0 && recipe.cook_minutes,recipe.id+' needs temperature and cooking time');
  assert.ok(recipe.doneness && recipe.safety,recipe.id+' needs doneness and safety guidance');
  assert.ok(recipe.source_verification?.source_url,recipe.id+' needs a source URL');
  assert.ok(fs.existsSync(path.join(root,recipe.photo_path)),recipe.id+' photo is missing');
}
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/airfryer-catalog.js'),'utf8'),sandbox);
assert.equal(sandbox.window.AIRFRYER_RECIPES.length,100,'runtime catalog must expose all 100 recipes');
assert.equal(new Set(sandbox.window.AIRFRYER_RECIPES.map(r=>r.id)).size,100,'runtime recipe IDs must be unique');
for(const recipe of sandbox.window.AIRFRYER_RECIPES){
  assert.equal(recipe.category,'airfryer');
  assert.ok(recipe.photo.startsWith('/assets/airfryer/'));
  assert.ok(recipe.ingredients.length && recipe.steps.length);
  assert.ok(recipe.airfryer.temperature && recipe.airfryer.cookMax);
}
for(const file of ['index.html','full-catalog/index.html']){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(html.includes('/assets/airfryer-catalog.js'),file+' must load the catalog data');
  assert.ok(html.includes('id="airfryerGrid"'),file+' must render the catalog grid');
  assert.ok(html.includes('renderAirfryerCatalog();'),file+' must initialize the catalog');
  assert.ok(html.includes('airfryerSpecsHtml(r)'),file+' must show the technical recipe panel');
}
console.log('Airfryer catalog QA passed: 100 unique recipes, 100 local photos, complete cooking and safety fields, both HTML variants wired.');
