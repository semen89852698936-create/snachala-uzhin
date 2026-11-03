'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const report = read('photo-library/ai-art-direct-visual-review-36-40-20261103.json');
const map = read('photo-library/ai-recipe-photo-map.json');
const expected = new Map([
  [36, '892ea54131c4078ed6d5b4991d0de444c614a2bd'],
  [37, '30859788d43631efce13e0d9f81fef93a52e6022'],
  [38, '9511ec3cd193dadaeee2be1e3bd2b0eae5174e28'],
  [39, 'a1ff0bda1779a1d5ac41a59855ee0fa3919e78e7'],
  [40, '6040633ac7838f8b389c86280e3da1b64ce4a889']
]);
assert.equal(report.schema_version, 1);
assert.equal(report.reviewed_count, 5);
assert.equal(report.rejected_count, 4);
assert.equal(report.needs_culinary_review_count, 1);
assert.equal(report.approved_count, 0);
assert.equal(report.reviews.length, 5);
assert.equal(map.total, 1001);
assert.equal(map.photos.length, 1001);
assert.equal(report.photo_map_blob_sha, '68c9c4c964c6afb7df5a164fbed3763434402290');
assert.equal(report.recipe_source.blob_sha, 'acb94b3fd125bd3dfd06f5d79bece0b3c3257c4e');
const unique = new Set();
for (const r of report.reviews) {
  assert(expected.has(r.n), 'Unexpected photo index ' + r.n);
  assert(!unique.has(r.n), 'Duplicate review ' + r.n);
  unique.add(r.n);
  const original = map.photos.find(p => p.n === r.n);
  assert(original, 'Missing map entry ' + r.n);
  assert.equal(r.recipe_id, original.recipe_id);
  assert.equal(r.path, original.path.replace(/^\\//, ''));
  assert.equal(r.blob_sha, original.sha);
  assert.equal(r.blob_sha, expected.get(r.n));
  assert(fs.existsSync(path.join(root, r.path)), 'Physical WebP missing: ' + r.path);
  assert(Array.isArray(r.ingredients) && r.ingredients.length >= 4);
  assert(Array.isArray(r.observations) && r.observations.length >= 2);
  assert.notEqual(r.approved_for_publication, true);
  assert(['rejected', 'needs_culinary_review'].includes(r.status));
  if (r.status === 'rejected') {
    assert(r.replacement_brief);
    assert(r.replacement_brief.must_show.length > 0);
    assert(r.replacement_brief.must_not_show.length > 0);
    assert.equal(r.replacement_brief.generation_authorized, false);
  } else {
    assert.equal(r.replacement_brief, undefined);
  }
}
assert.deepEqual([...unique].sort((a, b) => a - b), [36, 37, 38, 39, 40]);
console.log('PASS: five source-pinned visual decisions, four replacement briefs, no publication or generation approval.');
