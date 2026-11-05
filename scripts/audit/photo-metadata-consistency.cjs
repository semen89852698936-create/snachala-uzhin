#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const summary = JSON.parse(fs.readFileSync(path.join(root,'photo-library/summary.json'),'utf8'));
const curated = JSON.parse(fs.readFileSync(path.join(root,'photo-library/curated-images.json'),'utf8'));
assert.equal(summary.totalRecipes,1001,'Total recipe count changed unexpectedly');
assert(Array.isArray(curated.sources),'Curated sources must be an array');
assert.equal(curated.candidateCount,curated.sources.length,'Candidate count differs from sources');
const keys = new Set();
for(const item of curated.sources){
  assert(Number.isInteger(item.n)&&item.n>=1&&item.n<=summary.totalRecipes,'Invalid recipe index');
  assert(!keys.has(item.n),'Duplicate candidate index '+item.n);
  keys.add(item.n);
  if(item.publication_approved){
    assert.equal(item.photo_downloaded,true,'Approved candidate without a file');
    assert.equal(item.visually_approved,true,'Approved candidate without visual review');
    assert.equal(item.license_source_page_checked,true,'Approved candidate without license review');
  }
  if(item.site_published) assert.equal(item.publication_approved,true,'Published candidate not approved');
}
const range = curated.searchRange;
assert.equal(curated.needsSourcePages,(range.to-range.from+1)-curated.sources.length,'Unresolved count inconsistent');
const warnings=[];
if(summary.updatedAt < '2026-11-05') warnings.push('summary.json is historical, not a current production photo inventory');
if(!fs.existsSync(path.join(root,'photo-library/recipes-photo-registry.csv'))) warnings.push('recipes-photo-registry.csv missing from main; do not infer missing photo files');
console.log(JSON.stringify({validatedCandidates:curated.sources.length,finalApprovals:curated.sources.filter(x=>x.publication_approved).length,warnings},null,2));
