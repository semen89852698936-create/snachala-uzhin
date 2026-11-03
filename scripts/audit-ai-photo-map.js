#!/usr/bin/env node
// Read-only audit. Never treats a manifest entry as visual or legal approval.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(root, 'photo-library/ai-recipe-photo-map.json'), 'utf8'));
const historical = JSON.parse(fs.readFileSync(path.join(root, 'photo-library/summary.json'), 'utf8'));
assert.equal(map.total, 1001, 'manifest total');
assert.equal(map.photos.length, map.total, 'manifest length');
assert.equal(new Set(map.photos.map(x => x.recipe_id)).size, map.total, 'recipe IDs unique');
assert.equal(new Set(map.photos.map(x => x.path)).size, map.total, 'paths unique');
for (let i = 0; i < map.photos.length; i++) {
  const p = map.photos[i];
  assert.equal(p.n, i + 1, 'sequential photo number');
  assert.match(p.path, /^\\/assets\\/recipes-ai\\/\\d{4}-[a-z0-9-]+\\.webp$/, 'safe image path');
  assert.match(p.sha, /^[a-f0-9]{40}$/, 'git blob sha');
  assert.ok(Number.isInteger(p.bytes) && p.bytes > 0, 'positive file size');
}
const report = {
  verifiedAt: new Date().toISOString(),
  scope: 'metadata only; no binary fetch, visual review or rights confirmation',
  manifestEntries: map.photos.length,
  uniqueRecipeIds: new Set(map.photos.map(x => x.recipe_id)).size,
  uniquePhotoPaths: new Set(map.photos.map(x => x.path)).size,
  binaryFilesIndependentlyVerifiedThisRun: 0,
  visuallyVerifiedThisRun: 0,
  legallyVerifiedThisRun: 0,
  finallyApprovedThisRun: 0,
  visualReviewRemainingIfPriorCheckpoint5: 996,
  historicalSummaryStale: historical.uniqueCurrentPhotoIdentifiers !== map.photos.length,
  historicalSummaryIdentifiers: historical.uniqueCurrentPhotoIdentifiers
};
console.log(JSON.stringify(report, null, 2));
