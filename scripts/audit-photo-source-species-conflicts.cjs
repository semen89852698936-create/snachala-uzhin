#!/usr/bin/env node
// Advisory source-page mismatch audit. Never infer image contents or rights from URLs.
const fs = require('node:fs');
const assert = require('node:assert/strict');
function flags(item) {
  const title = (item.recipe_title || '').toLowerCase();
  const url = (item.source_page || '').toLowerCase();
  const pork = /свин|свиная|свиные/.test(title);
  const chickenSlug = /chicken[-_ ](?:meat|dish)|chicken[-_ ]meat[-_ ]dish/.test(url);
  return pork && chickenSlug ? ['species_conflict_in_url_requires_manual_review'] : [];
}
if (process.argv.includes('--test')) {
  assert.deepEqual(flags({recipe_title:'Свиная вырезка с грибами',source_page:'https://example.org/photo/chicken-meat-dish-792027/'}),['species_conflict_in_url_requires_manual_review']);
  assert.deepEqual(flags({recipe_title:'Говядина с грибами',source_page:'https://example.org/photo/chicken-meat-dish-792027/'}),[]);
  assert.deepEqual(flags({recipe_title:'Свиная вырезка',source_page:'https://example.org/photo/pork-123/'}),[]);
  console.log('3 source-conflict regression cases passed');
} else {
  const data=JSON.parse(fs.readFileSync(process.argv[2] || 'photo-library/curated-images.json','utf8'));
  const findings=(data.sources || []).flatMap(item=>flags(item).map(reason=>({n:item.n,recipe_id:item.recipe_id,source_page:item.source_page,reason})));
  console.log(JSON.stringify({scanned:(data.sources||[]).length,findings,notice:'URL-only signals. No visual or license approval.'},null,2));
}
