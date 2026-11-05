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
  assert.equal(data.length, 1001, path + ': recipe count changed');
  const ids = data.map(r => r.id);
  assert.equal(new Set(ids).size, 1001, path + ': duplicate recipe IDs');
  for (const r of data) {
    assert.ok(r.id != null && r.title && Array.isArray(r.ingredients) && Array.isArray(r.steps),
      path + ': incomplete recipe ' + String(r.id));
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
console.log('PASS: 1001 unique complete recipes; both HTML catalogs identical by ID; SHA256=' + hash);
