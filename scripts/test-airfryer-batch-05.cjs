'use strict';
const assert = require('node:assert/strict');
const batch = require('../data/airfryer-recipes-batch-05.json');
const plan = require('../data/airfryer-100-editorial-plan.json');

assert.equal(batch.schema, 'airfryer-recipe-batch-v1');
assert.equal(batch.batch_number, 5);
assert.equal(batch.category, 'Рыба и морепродукты');
assert.equal(batch.recipe_count, 10);
assert.equal(batch.recipes.length, 10);
const ids = batch.recipes.map((recipe) => recipe.id);
assert.equal(new Set(ids).size, 10, 'Batch 05 IDs must be unique.');
assert.deepEqual(batch.recipes.map((recipe) => recipe.number), [41,42,43,44,45,46,47,48,49,50]);
assert.ok(batch.recipes.every((recipe) => recipe.servings === 2));
assert.ok(batch.recipes.every((recipe) => recipe.ingredients.length >= 5));
assert.ok(batch.recipes.every((recipe) => recipe.steps.length >= 5));
assert.ok(batch.recipes.every((recipe) => recipe.temperature_c >= 160 && recipe.temperature_c <= 210));
assert.ok(batch.recipes.every((recipe) => Array.isArray(recipe.cook_minutes) && recipe.cook_minutes.length === 2));
assert.ok(batch.recipes.every((recipe) => recipe.source_verification?.source_url));
assert.ok(batch.recipes.every((recipe) => recipe.tefal_reference?.status));
assert.ok(batch.recipes.every((recipe) => recipe.photo_brief && recipe.photo_brief.length >= 60));
assert.ok(batch.recipes.every((recipe) => recipe.photo_status === 'not_started'));
assert.ok(batch.recipes.every((recipe) => recipe.appliance_test_status === 'not_tested'));
assert.ok(batch.recipes.every((recipe) => recipe.publication_status === 'not_published'));
assert.ok(batch.recipes.every((recipe) => /63 °C/.test(recipe.doneness + ' ' + recipe.safety)));

for (const recipe of batch.recipes) {
  const item = plan.items.find((entry) => entry.id === recipe.id);
  assert.ok(item, `Missing plan item: ${recipe.id}`);
  assert.equal(item.batch_number, 5);
  assert.equal(item.recipe_status, 'full_draft_source_reviewed');
  assert.equal(item.source_status, 'cross_checked');
  assert.equal(item.publication_status, 'not_published');
}
assert.equal(plan.items.filter((item) => item.batch_number === 5).length, 10);
console.log(JSON.stringify({
  ok: true, batch: 5, recipes: batch.recipes.length,
  uniqueIds: new Set(ids).size, range: [41,50],
  twoServings: true, sourceAndTefalStatuses: true,
  seafoodSafety: true, photos: 'not_started',
  physicalTests: 'not_tested', publication: 'not_published'
}, null, 2));
