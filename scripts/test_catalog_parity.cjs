'use strict';
// Read-only regression: verify both customer-facing catalogs contain identical recipe data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const paths = ['index.html', 'full-catalog/index.html'];
function load(path) {
  const html = fs.readFileSync(path, 'utf8');
  const tag = /<script\b[^>]*\bid=["']recipeData["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  assert.ok(tag, path + ': recipeData script missing');
  const data = JSON.parse(tag[1]);
  assert.ok(Array.isArray(data), path + ': recipeData is not an array');
  const soupReplacement = html.includes('window.WORLD_SOUPS_RECIPES || []') && fs.existsSync('assets/world-soups-10.js');
  const expectedCount = soupReplacement ? 801 : 1001;
  assert.equal(data.length, expectedCount, path + ': recipe count changed');
  // Normalize IDs exactly as the cross-catalog lookup does: 1 and "1" are the same recipe.
  const ids = data.map(r => {
    assert.ok(typeof r.id === 'string' || (typeof r.id === 'number' && Number.isSafeInteger(r.id)),
      path + ': invalid recipe ID type ' + String(r.id));
    const id = String(r.id);
    assert.equal(id, id.trim(), path + ': recipe ID contains surrounding whitespace ' + JSON.stringify(id));
    return id;
  });
  assert.equal(new Set(ids).size, expectedCount, path + ': duplicate recipe IDs after normalization');
  for (const r of data) {
    assert.ok(r.id != null && r.title && Array.isArray(r.ingredients) && Array.isArray(r.steps),
      path + ': incomplete recipe ' + String(r.id));
    assert.ok(String(r.id).trim() && String(r.id) !== 'undefined', path + ': blank recipe ID');
    assert.ok(typeof r.title === 'string' && r.title.trim(), path + ': blank recipe title ' + r.id);
    assert.ok(r.ingredients.length && r.steps.length, path + ': empty recipe ' + r.id);
  }
  return data;
}
const [main, full] = paths.map(load);
const byId = recipes => new Map(recipes.map(r => [String(r.id), r]));
const fullMap = byId(full);
for (const recipe of main) {
  const other = fullMap.get(String(recipe.id));
  assert.ok(other, 'full-catalog missing recipe ' + recipe.id);
  assert.deepEqual(other, recipe, 'catalog drift for recipe ' + recipe.id);
}
const hash = crypto.createHash('sha256').update(JSON.stringify(main)).digest('hex');
console.log('PASS: ' + main.length + ' unique complete embedded recipes; both HTML catalogs identical by ID; SHA256=' + hash);
