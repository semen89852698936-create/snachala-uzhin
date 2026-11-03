// Source-selection regression guard, not an image/rights approval.
// Run: node --test tests/recipe-photo-41-45-source-guard.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(root, 'photo-library/ai-recipe-photo-map.json'), 'utf8'));
const expected = new Map([
  [41, ['collection-meat-03-03', '0041-collection-meat-03-03-regen.webp']],
  [42, ['collection-meat-03-04', '0042-collection-meat-03-04.webp']],
  [43, ['collection-meat-03-05', '0043-collection-meat-03-05.webp']],
  [44, ['collection-meat-03-06', '0044-collection-meat-03-06-regen.webp']],
  [45, ['collection-meat-03-07', '0045-collection-meat-03-07.webp']],
]);

test('photo map has 1001 unique numbered recipe paths', () => {
  assert.equal(map.photos.length, 1001);
  assert.equal(new Set(map.photos.map(p => p.n)).size, 1001);
  assert.equal(new Set(map.photos.map(p => p.path)).size, 1001);
  assert.equal(new Set(map.photos.map(p => p.recipe_id)).size, 1001);
});

test('41-45 retain their exact selected versions, including regenerated 41 and 44', () => {
  for (const [number, [recipeId, filename]] of expected) {
    const photo = map.photos.find(p => p.n === number);
    assert.ok(photo, 'missing entry ' + number);
    assert.equal(photo.recipe_id, recipeId);
    assert.equal(photo.path, '/assets/recipes-ai/' + filename);
    assert.match(photo.sha, /^[a-f0-9]{40}$/);
    assert.ok(photo.bytes > 0);
    assert.ok(fs.existsSync(path.join(root, photo.path.slice(1))), 'physical WebP missing: ' + filename);
  }
});
