import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const recipes = read('photo-library/recipes.json').recipes;
const reviews = [
  read('review/ai-art-first-five-visual-triage-20261102.json'),
  read('review/ai-art-six-to-ten-visual-triage-20261102.json')
];
const briefs = [
  read('photo-library/ai-art-replacement-brief-5-20261102.json'),
  read('photo-library/ai-art-replacement-briefs-8-9-20261102.json')
];

test('every rejected AI WebP among reviewed 1-10 has exactly one source-pinned replacement brief', () => {
  const rejected = reviews.flatMap(review => review.records).filter(x => x.visual_status.startsWith('reject_'));
  const items = briefs.flatMap(brief => brief.items);
  assert.deepEqual(rejected.map(x => x.number).sort((a,b) => a-b), [5,8,9]);
  assert.deepEqual(items.map(x => x.number).sort((a,b) => a-b), [5,8,9]);
  assert.equal(new Set(items.map(x => x.number)).size, items.length, 'duplicate replacement brief');
  for (const item of items) {
    const source = rejected.find(x => x.number === item.number);
    const recipe = recipes[item.number - 1];
    assert.ok(source, 'brief without rejected visual evidence');
    assert.equal(item.recipe_id, source.recipe_id);
    assert.equal(item.recipe_title, source.recipe_title);
    assert.equal(item.rejected_photo_blob_sha, source.photo_git_blob_sha);
    assert.equal(item.recipe_id, recipe.id);
    assert.equal(item.recipe_title, recipe.title);
    assert.ok(item.must_show.length >= 3);
    assert.ok(item.must_avoid.length >= 2);
    assert.equal(item.rights_status, 'unverified');
    assert.equal(item.status, 'brief_only_no_physical_replacement');
  }
  for (const brief of briefs) {
    assert.equal(brief.cost_approval_required, true);
    assert.equal(brief.publication_allowed, false);
  }
});

test('baked salmon brief matches source ingredients and cannot silently release a raw-looking photo', () => {
  const salmon = briefs[0].items[0];
  const recipe = recipes[4];
  assert.equal(salmon.number, 5);
  assert.deepEqual(salmon.recipe_ingredients, recipe.ingredients);
  assert.equal(salmon.rejected_photo_path, 'photo-library/alice-ai-art/photos/0005-salmon-lemon.webp');
  assert.equal(salmon.visual_review_required, true);
  assert.equal(salmon.owner_approved, false);
  assert.match(salmon.cooking_evidence, /200 °C/);
  assert.match(salmon.cooking_evidence, /12–15/);
});
