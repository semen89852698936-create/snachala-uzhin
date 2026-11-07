#!/usr/bin/env node
// Non-mutating audit: the legacy summary must never be treated as AI release readiness.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
function audit(map, legacy) {
  assert.equal(map.total, 1001, 'AI map total must be 1001');
  assert.equal(map.photos.length, map.total, 'AI map length mismatch');
  const ids = new Set(), recipeIds = new Set(), paths = new Set();
  for (const p of map.photos) {
    assert(Number.isInteger(p.n) && p.n >= 1 && p.n <= map.total, 'invalid index');
    assert(!ids.has(p.n), 'duplicate index: ' + p.n); ids.add(p.n);
    assert(typeof p.recipe_id === 'string' && p.recipe_id.trim(), 'missing recipe id');
    assert(!recipeIds.has(p.recipe_id), 'duplicate recipe id: ' + p.recipe_id); recipeIds.add(p.recipe_id);
    assert(typeof p.path === 'string' && /^\/assets\/recipes-ai\/[^/]+\.webp$/.test(p.path), 'invalid path');
    assert(!paths.has(p.path), 'duplicate path'); paths.add(p.path);
    assert(Number.isInteger(p.bytes) && p.bytes > 0, 'invalid byte size');
    assert(typeof p.sha === 'string' && /^[a-f0-9]{40}$/.test(p.sha), 'invalid Git blob SHA');
  }
  assert.equal(legacy.totalRecipes, map.total, 'legacy total differs');
  return { totalRecipes: map.total, mappedPaths: paths.size,
    physicallyVerifiedThisRun: 0, visuallyReviewedThisRun: 0,
    legallyReviewedThisRun: 0, approvedThisRun: 0,
    unverifiedVisualCount: null, unverifiedLegalCount: null,
    legacySummaryIsCurrent: false,
    note: 'Mapped paths and blob metadata are NOT evidence of visual, legal, or publication approval. Historical summary describes a different photo inventory.' };
}
if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const map = JSON.parse(fs.readFileSync(path.join(root,'photo-library/ai-recipe-photo-map.json'),'utf8'));
  const legacy = JSON.parse(fs.readFileSync(path.join(root,'photo-library/summary.json'),'utf8'));
  console.log(JSON.stringify(audit(map,legacy),null,2));
}
module.exports={audit};