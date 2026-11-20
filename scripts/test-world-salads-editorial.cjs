#!/usr/bin/env node
'use strict';
/**
 * Editorial validation for the staged international salads collection.
 * Does not modify the live site or treat source references as independently verified.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../data/editorial/salads');
const files = [
 '01-russian.json','02-italian.json','03-french.json','04-spanish.json',
 '05-greek.json','06-turkish.json','07-lebanese.json','08-japanese.json',
 '09-thai.json','10-american.json'
];
const expectedCuisines = [
 'Русская и советская домашняя кухня','Италия','Франция','Испания',
 'Греция','Турция','Ливан','Япония','Таиланд','США'
];
const all = [];
for (let i=0;i<files.length;i++) {
 const doc=JSON.parse(fs.readFileSync(path.join(root,files[i]),'utf8'));
 assert.equal(doc.recipes.length,10,files[i]+': exactly 10 entries required');
 assert.equal(doc.cuisine, ['Русская и советская','Италия','Франция','Испания','Греция','Турция','Ливан','Япония','Таиланд','США'][i],files[i]);
 for(const r of doc.recipes){assert.equal(r.cuisine, expectedCuisines[i],r.id+': cuisine mismatch');}
 all.push(...doc.recipes);
}
assert.equal(all.length,100,'The collection must have exactly 100 cards');
const ids=new Set(),titles=new Set();
for(const r of all){
 assert.ok(!ids.has(r.id),'Repeated ID: '+r.id);
 assert.ok(!titles.has(r.title),'Repeated title: '+r.title);
 ids.add(r.id);titles.add(r.title);
 assert.equal(r.category,'salads',r.id);
 assert.equal(r.base,2,r.id+' portions');
 assert.ok(Number.isInteger(r.minutes)&&r.minutes>=10&&r.minutes<=300,r.id+' minutes');
 assert.ok(r.ingredients.length>=5,r.id+' ingredients');
 assert.ok(r.steps.length>=4,r.id+' steps');
 assert.ok(r.description&&r.description.length>20,r.id+' description');
 assert.ok(r.photoBrief&&r.photoBrief.length>50,r.id+' photoBrief');
 assert.equal(r.photoStatus,'awaiting_original_photo_approval',r.id+' photo not approved');
 assert.equal(r.sourceReview.stage,'editorial_research',r.id+' pending source audit');
 const sources=r.sourceReview.sources;
 assert.equal(sources.length,3,r.id+' exactly three source references');
 const domains=new Set(sources.map(s=>{
   assert.match(s,/^https:\/\/[^\s/]+\/[^\s]+$/,r.id+' bad URL');
   return s.match(/^https:\/\/([^/]+)/)[1].replace(/^www\./,'');
 }));
 assert.equal(domains.size,3,r.id+' sources should be independent domains');
 for(const x of r.ingredients){
   assert.ok(typeof x.name==='string'&&x.name.trim().length>1,r.id+' ingredient name');
   assert.ok(Number.isFinite(x.amount)&&x.amount>=0,r.id+' ingredient amount');
   assert.ok(x.unit&&typeof x.unit==='string',r.id+' unit');
 }
 for(const s of r.steps){
   assert.ok(s.title&&s.title.length>3,r.id+' step title');
   assert.ok(s.detail&&s.detail.length>=25,r.id+' step detail');
   assert.ok(Number.isInteger(s.timer)&&s.timer>=0,r.id+' timer');
 }
}
const compiled=JSON.parse(fs.readFileSync(path.join(root,'world-100-catalog.json'),'utf8'));
assert.equal(compiled.count,100);
assert.equal(compiled.recipes.length,100);
assert.equal(compiled.publicationStatus,'STAGING_ONLY');
assert.equal(compiled.sourceReviewStatus,'URL_REFERENCES_NOT_FULLY_AUDITED');
assert.equal(compiled.imageStatus,'NO_NEW_IMAGES_APPROVED_OR_PUBLISHED');
for(let i=0;i<100;i++){
 const r=compiled.recipes[i],orig=all[i];
 assert.equal(r.id,orig.id,'compiled order');
 assert.equal(r.title,orig.title,'compiled title');
 assert.deepEqual(r.ingredients,orig.ingredients,'compiled ingredients');
 assert.deepEqual(r.sourceReview.sources,orig.sourceReview.sources,'compiled sources');
 assert.ok(r.imagePublishingBlocked===true);
 assert.equal(r.photo,null,'NO replaced photography');
 assert.equal(r.steps.length,orig.steps.length);
}
const ni=compiled.recipes.find(r=>r.id==='world-salad-fr-001');
assert.ok(ni && !ni.ingredients.some(i=>/картофель|фасол/i.test(i.name)),'Nicoise traditional vegetables should be raw');
const tab=compiled.recipes.find(r=>r.id==='world-salad-lb-001');
assert.ok(tab.ingredients.find(i=>/Петрушка/.test(i.name)).amount > tab.ingredients.find(i=>/Булгур/.test(i.name)).amount,'Tabbouleh must be parsley-led');
const kap=compiled.recipes.find(r=>r.id==='world-salad-it-001');
assert.ok(!kap.ingredients.some(i=>/латук|майонез/i.test(i.name)),'Caprese should not contain lettuce or mayonnaise');
console.log('PASS: exactly 100 unique recipes, 10 cuisines, 2 portions per recipe.');
console.log('PASS: each recipe has ingredients, four or more steps, photo brief and 3 independent source domains.');
console.log('PASS: compiled 100 cards match the 10 source batches; site and approved photos are not changed.');
console.log('NOTE: URL presence is NOT independent source verification; the editorial research audit remains open.');
