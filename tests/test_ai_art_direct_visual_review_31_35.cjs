'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const review = JSON.parse(fs.readFileSync('photo-library/ai-art-direct-visual-review-31-35-20261103.json', 'utf8'));
const map = JSON.parse(fs.readFileSync('photo-library/ai-recipe-photo-map.json', 'utf8'));
assert.equal(review.schema_version, 1);
assert.equal(review.reviewed_count, 5);
assert.equal(review.rejected_count, 3);
assert.equal(review.approved_count, 0);
assert.equal(review.reviews.length, 5);
assert.deepEqual(review.reviews.map(r => r.n), [31,32,33,34,35]);
assert.equal(new Set(review.reviews.map(r => r.recipe_id)).size, 5);
for (const r of review.reviews) {
  const current = map.photos.find(p => p.n === r.n);
  assert.ok(current, 'missing photo map entry ' + r.n);
  assert.equal(r.recipe_id, current.recipe_id);
  assert.equal('/' + r.path, current.path);
  assert.equal(r.blob_sha, current.sha, 'image changed: review must be repeated for ' + r.n);
  assert.ok(r.ingredients.length >= 4);
  assert.ok(r.observations.length >= 1);
  assert.notEqual(r.status, 'approved');
  if (r.status === 'rejected') {
    assert.ok(r.replacement_brief?.target);
    assert.ok(r.replacement_brief.must_show.length);
    assert.ok(r.replacement_brief.must_not_show.length);
    assert.equal(r.replacement_brief.generation_authorized, false);
  }
}
assert.equal(review.reviews.filter(r => r.status === 'rejected').length, 3);
console.log('PASS: 5 source-pinned direct visual reviews, 3 blocked images, no release or generation authorization');
