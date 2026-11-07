'use strict';
const assert = require('node:assert/strict');
const batch = require('../data/airfryer-recipes-batch-06.json');
const plan = require('../data/airfryer-100-editorial-plan.json');

assert.equal(batch.schema, 'airfryer-recipe-batch-v1');
assert.equal(batch.batch_number, 6);
assert.equal(batch.recipe_count, 10);
assert.equal(batch.recipes.length, 10);
const ids = batch.recipes.map((recipe) => recipe.id);
assert.equal(new Set(ids).size, 10, 'Batch 06 IDs must be unique.');
assert.deepEqual(batch.recipes.map((recipe) => recipe.number), [51,52,53,54,55,56,57,58,59,60]);
assert.ok(batch.recipes.every((recipe) => recipe.servings === 2));
assert.ok(batch.recipes.every((recipe) => recipe.ingredients.length >= 4));
assert.ok(batch.recipes.every((recipe) => recipe.steps.length >= 4));
assert.ok(batch.recipes.every((recipe) => recipe.temperature_c >= 160 && recipe.temperature_c <= 210));
assert.ok(batch.recipes.every((recipe) => Array.isArray(recipe.cook_minutes) && recipe.cook_minutes.length === 2));
assert.ok(batch.recipes.every((recipe) => recipe.source_verification?.source_url));
assert.ok(batch.recipes.every((recipe) => recipe.tefal_reference?.status));
assert.ok(batch.recipes.every((recipe) => recipe.photo_brief && recipe.photo_brief.length >= 60));
assert.ok(batch.recipes.every((recipe) => recipe.doneness && recipe.safety));
assert.ok(batch.recipes.every((recipe) => ['not_started','present_pending_visual_review','needs_replacement','replacement_generated_pending_visual_review','generated_pending_visual_review'].includes(recipe.photo_status)));
assert.ok(batch.recipes.every((recipe) => recipe.appliance_test_status === 'not_tested'));
assert.ok(batch.recipes.every((recipe) => recipe.publication_status === 'not_published'));
assert.ok(batch.recipes.slice(0,4).every((recipe) => /63 °C|74 °C/.test(recipe.doneness + ' ' + recipe.safety)));
assert.ok(batch.recipes[3].safety.includes('24 часов'));
assert.equal(batch.recipes[9].tefal_reference.status, 'direct_recipe_in_supplied_tefal_book');

for (const recipe of batch.recipes) {
  const item = plan.items.find((entry) => entry.id === recipe.id);
  assert.ok(item, `Missing plan item: ${recipe.id}`);
  assert.equal(item.batch_number, 6);
  assert.equal(item.recipe_status, 'full_draft_source_reviewed');
  assert.equal(item.source_status, 'cross_checked');
  assert.equal(item.publication_status, 'not_published');
}
assert.equal(plan.items.filter((item) => item.batch_number === 6).length, 10);
console.log(JSON.stringify({
  ok: true, batch: 6, recipes: batch.recipes.length,
  uniqueIds: new Set(ids).size, range: [51,60],
  twoServings: true, sourceAndTefalStatuses: true,
  seafoodAndRiceSafety: true, photos: 'not_started',
  physicalTests: 'not_tested', publication: 'not_published'
}, null, 2));
