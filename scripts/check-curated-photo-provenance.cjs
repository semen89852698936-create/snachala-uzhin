#!/usr/bin/env node
// Read-only validation of photo-library/curated-images.json.
// Source URLs and license labels are not proof of image ownership or final approval.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const file = path.join(__dirname, '..', 'photo-library', 'curated-images.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const sources = data.sources || [];
const seen = new Set();
for (const row of sources) {
  assert(Number.isInteger(row.n) && row.n >= 1 && row.n <= 1001, 'invalid recipe number');
  assert(!seen.has(row.n), 'duplicate recipe number: ' + row.n);
  seen.add(row.n);
  assert(row.recipe_id && row.recipe_title, 'missing recipe identity: ' + row.n);
  if (row.publication_approved || row.site_published) {
    assert(row.photo_downloaded === true, 'published/approved without downloaded image: ' + row.n);
    assert(row.visually_approved === true, 'published/approved without visual approval: ' + row.n);
    assert(row.license_source_page_checked === true, 'published/approved without license-page review: ' + row.n);
    assert(row.image_path && fs.existsSync(path.join(__dirname, '..', row.image_path)), 'published/approved image missing: ' + row.n);
  }
}
assert.equal(data.candidateCount, sources.length, 'candidateCount disagrees with source entries');
if (data.searchRange) {
  assert.equal(data.needsSourcePages, data.searchRange.to - data.searchRange.from + 1 - sources.length, 'needsSourcePages disagrees with batch');
}
console.log('PASS curated photo provenance invariants: ' + sources.length + ' candidates, ' + seen.size + ' unique recipe IDs');
