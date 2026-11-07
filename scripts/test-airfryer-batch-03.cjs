'use strict';
const assert = require('node:assert/strict');
const batch = require('../data/airfryer-recipes-batch-03.json');
const plan = require('../data/airfryer-100-editorial-plan.json');

assert.equal(batch.schema, 'airfryer-recipe-batch-v1');
assert.equal(batch.batch_number, 3);
assert.equal(batch.category, 'Мясо');
assert.equal(batch.recipe_count, 10);
assert.equal(batch.recipes.length, 10);
const ids = batch.recipes.map((recipe) => recipe.id);
assert.equal(new Set(ids).size, 10);
assert.deepEqual(batch.recipes.map((recipe) => recipe.number), [21,22,23,24,25,26,27,28,29,30]);
assert.ok(batch.recipes.every((recipe) => recipe.servings === 2));
assert.ok(batch.recipes.every((recipe) => recipe.ingredients.length >= 5));
assert.ok(batch.recipes.every((recipe) => recipe.steps.length >= 4));
assert.ok(batch.recipes.every((recipe) => recipe.temperature_c >= 150 && recipe.temperature_c <= 210));
assert.ok(batch.recipes.every((recipe) => Array.isArray(recipe.cook_minutes) && recipe.cook_minutes.length === 2));
assert.ok(batch.recipes.every((recipe) => recipe.source_verification?.source_url));
assert.ok(batch.recipes.every((recipe) => recipe.tefal_reference?.status));
assert.ok(batch.recipes.every((recipe) => ['not_started','present_pending_visual_review','needs_replacement','replacement_generated_pending_visual_review','generated_pending_visual_review'].includes(recipe.photo_status)));
assert.ok(batch.recipes.every((recipe) => recipe.appliance_test_status === 'not_tested'));
assert.ok(batch.recipes.every((recipe) => recipe.publication_status === 'not_published'));
assert.ok(batch.recipes.every((recipe) => /63 °C|71 °C/.test(recipe.doneness + ' ' + recipe.safety)));

for (const recipe of batch.recipes) {
  const item = plan.items.find((entry) => entry.id === recipe.id);
  assert.ok(item, `Missing plan item: ${recipe.id}`);
  assert.equal(item.batch_number, 3);
  assert.equal(item.recipe_status, 'full_draft_source_reviewed');
  assert.equal(item.publication_status, 'not_published');
}
console.log(JSON.stringify({
  ok: true, batch: 3, recipes: batch.recipes.length,
  uniqueIds: new Set(ids).size, range: [21,30],
  twoServings: true, sourceAndTefalStatuses: true,
  safeTemperatures: true, photos: 'not_started',
  physicalTests: 'not_tested', publication: 'not_published'
}, null, 2));
