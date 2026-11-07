'use strict';
const assert = require('node:assert/strict');
const batch = require('../data/airfryer-recipes-batch-01.json');
const plan = require('../data/airfryer-100-editorial-plan.json');

assert.equal(batch.schema, 'airfryer-recipe-batch-v1');
assert.equal(batch.batch_number, 1);
assert.equal(batch.category, 'Птица');
assert.equal(batch.recipe_count, 10);
assert.equal(batch.recipes.length, 10);

const ids = batch.recipes.map((recipe) => recipe.id);
assert.equal(new Set(ids).size, 10, 'Batch recipe IDs must be unique.');
assert.ok(batch.recipes.every((recipe) => recipe.servings === 2), 'All recipes must serve two.');
assert.ok(batch.recipes.every((recipe) => recipe.ingredients.length >= 5), 'Each recipe needs a real ingredient list.');
assert.ok(batch.recipes.every((recipe) => recipe.steps.length >= 4), 'Each recipe needs full steps.');
assert.ok(batch.recipes.every((recipe) => recipe.temperature_c >= 160 && recipe.temperature_c <= 210), 'Temperature must be explicit and plausible.');
assert.ok(batch.recipes.every((recipe) => Array.isArray(recipe.cook_minutes) && recipe.cook_minutes.length === 2 && recipe.cook_minutes[0] <= recipe.cook_minutes[1]), 'Each recipe needs a cook-time range.');
assert.ok(batch.recipes.every((recipe) => recipe.source_verification?.source_url), 'Each recipe needs a source URL.');
assert.ok(batch.recipes.every((recipe) => recipe.tefal_reference?.status), 'Each recipe needs a Tefal comparison status.');
assert.ok(batch.recipes.every((recipe) => recipe.photo_status === 'not_started'), 'Do not imply photos are ready.');
assert.ok(batch.recipes.every((recipe) => recipe.appliance_test_status === 'not_tested'), 'Do not imply physical tests happened.');
assert.ok(batch.recipes.every((recipe) => recipe.publication_status === 'not_published'), 'Drafts must not claim publication.');
assert.ok(batch.recipes.every((recipe) => /74 °C/.test(recipe.doneness) || /74 °C/.test(recipe.safety)), 'Poultry safety temperature must be explicit.');

for (const recipe of batch.recipes) {
  const planItem = plan.items.find((item) => item.id === recipe.id);
  assert.ok(planItem, `Recipe ${recipe.id} missing from 100-item plan.`);
  assert.equal(planItem.batch_number, 1);
  assert.equal(planItem.recipe_status, 'full_draft_source_reviewed');
  assert.equal(planItem.publication_status, 'not_published');
}

console.log(JSON.stringify({
  ok: true,
  batch: batch.batch_number,
  recipes: batch.recipes.length,
  uniqueIds: new Set(ids).size,
  allForTwo: true,
  sourceUrls: true,
  tefalComparisons: true,
  poultry74C: true,
  photos: 'not_started',
  physicalTests: 'not_tested',
  publication: 'not_published'
}, null, 2));
