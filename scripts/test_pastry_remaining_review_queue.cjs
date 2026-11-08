// Non-destructive inventory gate for the 98 pastry recipes.
// Run from repository root: node scripts/test_pastry_remaining_review_queue.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
function load(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
const map = load('photo-library/ai-recipe-photo-map.json').photos;
const replaced = load('photo-library/pastry-no-eggs-review.json').photos;
const queue = load('photo-library/pastry-remaining-56-review-queue.json');
const pastry = map.filter(x => x.recipe_id.startsWith('collection-pastry-'));
const indexed = new Map(pastry.map(x => [x.recipe_id, x]));
const replacedIds = new Set(replaced.map(x => x.recipe_id));
const pendingIds = new Set(queue.items.map(x => x.recipe_id));
assert.equal(pastry.length, 98, 'Expected exactly 98 pastry recipes');
assert.equal(indexed.size, 98, 'Duplicate pastry recipe IDs in the active map');
assert.equal(replaced.length, 42, 'Replacement log does not have 42 photos');
assert.equal(replacedIds.size, 42, 'Duplicate recipe IDs in replacement log');
assert.equal(queue.items.length, 56, 'Incomplete pending review queue');
assert.equal(pendingIds.size, 56, 'Duplicate recipe IDs in pending review queue');
assert.deepEqual(queue.counts, {
  pastryTotal: 98, alreadyReplacedNoEggs: 42, notYetVisuallyAssessed: 56
});
for (const photo of replaced) {
  const active = indexed.get(photo.recipe_id);
  assert.ok(active, 'Replaced photo not in pastry catalog: ' + photo.recipe_id);
  assert.equal(active.path, photo.path, '42-way photo binding changed: ' + photo.recipe_id);
  assert.ok(photo.path.endsWith('-no-eggs.webp'), 'No-eggs suffix missing');
  assert.ok(!pendingIds.has(photo.recipe_id), 'Replaced photo wrongly queued');
}
for (const item of queue.items) {
  const active = indexed.get(item.recipe_id);
  assert.ok(active, 'Pending photo not in pastry catalog: ' + item.recipe_id);
  assert.ok(!replacedIds.has(item.recipe_id), 'Pending photo already replaced');
  assert.equal(active.n, item.n, 'Recipe number changed: ' + item.recipe_id);
  assert.equal(active.path, item.path, 'Photo path changed: ' + item.recipe_id);
  assert.equal(active.sha, item.git_blob_sha, 'Source Git blob changed: ' + item.recipe_id);
  assert.ok(typeof item.title === 'string' && item.title.length > 0);
  assert.equal(item.review_status, 'awaiting_direct_visual_review');
  assert.equal(item.visible_eggs, 'unknown', 'No visual inspection has been performed');
  assert.equal(item.recipe_match, 'unknown');
  assert.equal(item.disposition, 'keep_original_until_verified');
}
assert.equal(replacedIds.size + pendingIds.size, indexed.size, 'Incomplete 98-recipe partition');
assert.equal(queue.reviewPolicy.doNotDeleteOrReplaceBeforeVisualInspection, true);
assert.equal(queue.reviewPolicy.noAutomaticPaidCalls, true);
console.log('PASS: 98 pastry recipes = 42 replacements + 56 unchanged pending visual review');
