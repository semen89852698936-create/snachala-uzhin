'use strict';
const assert = require('node:assert/strict');
const batch = require('../data/airfryer-recipes-batch-04.json');
const plan = require('../data/airfryer-100-editorial-plan.json');

assert.equal(batch.schema, 'airfryer-recipe-batch-v1');
assert.equal(batch.batch_number, 4);
assert.equal(batch.category, 'Смешанная партия: мясо и рыба');
assert.equal(batch.recipe_count, 10);
assert.equal(batch.recipes.length, 10);
const ids = batch.recipes.map((recipe) => recipe.id);
assert.equal(new Set(ids).size, 10, 'Batch 04 IDs must be unique.');
assert.deepEqual(batch.recipes.map((recipe) => recipe.number), [31,32,33,34,35,36,37,38,39,40]);
assert.ok(batch.recipes.every((recipe) => recipe.servings === 2));
assert.ok(batch.recipes.every((recipe) => recipe.ingredients.length >= 5));
assert.ok(batch.recipes.every((recipe) => recipe.steps.length >= 5));
assert.ok(batch.recipes.every((recipe) => recipe.temperature_c >= 160 && recipe.temperature_c <= 210));
assert.ok(batch.recipes.every((recipe) => Array.isArray(recipe.cook_minutes) && recipe.cook_minutes.length === 2));
assert.ok(batch.recipes.every((recipe) => recipe.source_verification?.source_url));
assert.ok(batch.recipes.every((recipe) => recipe.tefal_reference?.status));
assert.ok(batch.recipes.every((recipe) => recipe.photo_brief && recipe.photo_brief.length >= 60));
assert.ok(batch.recipes.every((recipe) => recipe.photo_status === 'generated_verified_unpublished'));
assert.ok(batch.recipes.every((recipe) => recipe.appliance_test_status === 'not_tested'));
assert.ok(batch.recipes.every((recipe) => recipe.publication_status === 'not_published'));
assert.ok(batch.recipes.every((recipe) => /63 °C|65 °C|71 °C/.test(recipe.doneness + ' ' + recipe.safety)));

for (const recipe of batch.recipes) {
  const item = plan.items.find((entry) => entry.id === recipe.id);
  assert.ok(item, `Missing plan item: ${recipe.id}`);
  assert.equal(item.batch_number, 4);
  assert.equal(item.recipe_status, 'full_draft_source_reviewed');
  assert.equal(item.source_status, 'cross_checked');
  assert.equal(item.publication_status, 'not_published');
}
assert.equal(plan.items.filter((item) => item.batch_number === 4).length, 10);
console.log(JSON.stringify({
  ok: true, batch: 4, recipes: batch.recipes.length,
  uniqueIds: new Set(ids).size, range: [31,40],
  twoServings: true, sourceAndTefalStatuses: true,
  safetyTemperatures: true, photos: 'generated_verified_unpublished',
  physicalTests: 'not_tested', publication: 'not_published'
}, null, 2));
