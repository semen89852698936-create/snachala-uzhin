#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..', 'data', 'editorial', 'salads');
const files = [
  'russian-first-10.json',
  'italian-french-spanish-30.json',
  'greek-turkish-lebanese-30.json',
  'japanese-thai-american-30.json',
];
const docs = files.map(file => JSON.parse(fs.readFileSync(path.join(base,file),'utf8')));
const recipes = docs.flatMap(d => d.recipes);
const countries = [
  'Русская и советская кухня', 'Итальянская', 'Французская',
  'Испанская', 'Греческая', 'Турецкая',
  'Ливанская', 'Японская', 'Тайская', 'Американская'
];
assert.equal(recipes.length,100,'Exactly 100 salads required');
assert.deepEqual(docs.map(d=>d.recipes.length),[10,30,30,30]);
assert.equal(new Set(recipes.map(r=>r.id)).size,100,'Recipe IDs must be unique');
assert.equal(new Set(recipes.map(r=>r.title.toLowerCase())).size,100,'Recipe titles must be unique');
for(const [idx,country] of countries.entries()){
  const group = recipes.slice(idx*10,(idx+1)*10);
  assert.equal(group.length,10);
  for(const r of group) assert.equal(r.cuisine,country,'Wrong cuisine grouping for '+r.title);
}
for(const r of recipes){
  assert.equal(r.category,'salads',r.id);
  assert.equal(r.base,2,'All recipes must serve two: '+r.id);
  assert.ok(Number.isFinite(r.minutes)&&r.minutes>=10&&r.minutes<=300,'Time: '+r.id);
  assert.ok(Array.isArray(r.ingredients)&&r.ingredients.length>=4,'Ingredients: '+r.id);
  for(const i of r.ingredients){
    assert.ok(typeof i.name==='string'&&i.name.trim().length>=2,'Ingredient name: '+r.id);
    assert.ok(Number.isFinite(i.amount)&&i.amount>=0,'Ingredient amount: '+r.id);
    assert.ok(typeof i.unit==='string'&&i.unit.length>0,'Ingredient unit: '+r.id);
  }
  assert.ok(Array.isArray(r.steps)&&r.steps.length>=4,'Steps: '+r.id);
  for(const step of r.steps){
    assert.ok(typeof step.title==='string'&&step.title.length>0,'Step title: '+r.id);
    assert.ok(typeof step.detail==='string'&&step.detail.length>=24,'Step description: '+r.id);
    assert.ok(Number.isFinite(step.timer)&&step.timer>=0,'Step timer: '+r.id);
  }
  assert.ok(typeof r.photoBrief==='string'&&r.photoBrief.length>=30,'Photo brief: '+r.id);
  assert.equal(r.photoStatus,'pending_separate_photo','Photos are NOT approved or published: '+r.id);
  assert.equal(r.reviewStatus,'editorial_draft_requires_source_by_source_signoff',
    'Do not claim verified source signoff: '+r.id);
  assert.equal(r.photo,undefined,'Never reuse an old unrelated photo: '+r.id);
}
console.log('PASS: 100 distinct salads, 10 cuisines x 10, two servings, step/ingredient schema, staging only.');
console.log('NOTE: culinary source-by-source review, original photos and published-site integration remain pending.');
