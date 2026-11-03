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

test('approved site selections 6, 10 and 20 remain pinned independently of archive copies', () => {
  const approved = [
    [6, 'med-fish', '0006-med-fish.webp', '3f81081c840ef0aa42cb48c0181aab1b0cd47c34'],
    [10, 'pancakes', '0010-pancakes.webp', '367bd80873ecb2d261af0d35936f225d086ad04a'],
    [20, 'syrniki', '0020-syrniki.webp', '67107fb663d9ab49fdf0e3a50b20053dc1bf5018'],
  ];
  for (const [n, recipeId, filename, blobSha] of approved) {
    const photo = map.photos.find(p => p.n === n);
    assert.ok(photo, 'missing approved selection ' + n);
    assert.equal(photo.recipe_id, recipeId);
    assert.equal(photo.path, '/assets/recipes-ai/' + filename);
    assert.equal(photo.sha, blobSha);
    assert.ok(fs.existsSync(path.join(root, photo.path.slice(1))), 'missing selected WebP: ' + filename);
  }
});
