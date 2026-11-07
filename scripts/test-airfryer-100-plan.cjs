'use strict';
const assert = require('node:assert/strict');
const plan = require('../data/airfryer-100-editorial-plan.json');

assert.equal(plan.schema, 'airfryer-100-editorial-plan-v1');
assert.equal(plan.target_count, 100);
assert.equal(plan.items.length, 100, 'The air-fryer section must contain exactly 100 planned recipes.');

const ids = plan.items.map((item) => item.id);
assert.equal(new Set(ids).size, 100, 'Recipe IDs must be unique.');
assert.deepEqual(plan.items.map((item) => item.number), Array.from({ length: 100 }, (_, i) => i + 1));
assert.ok(plan.items.every((item) => item.servings === 2), 'All recipes are planned for two servings.');
assert.ok(plan.items.every((item) => item.editorial_concept && item.editorial_concept.trim()), 'Every item needs a culinary/technical brief.');
assert.ok(plan.items.every((item) => item.publication_status === 'not_published'), 'Planning records must not claim publication.');
assert.ok(plan.items.every((item) => typeof item.photo_path === 'string' && item.photo_path.startsWith('assets/airfryer/')), 'Every planned recipe must link to a local air-fryer WebP.');
assert.ok(plan.items.every((item) => ['present_pending_visual_review','needs_replacement'].includes(item.photo_status)), 'Photo presence must remain separate from editorial approval.');
assert.equal(plan.items.filter((item) => item.photo_status === 'needs_replacement').length, 3, 'Only the three owner-flagged photos should be marked for replacement.');

const actualCounts = Object.fromEntries(
  [...new Set(plan.items.map((item) => item.category))].map((category) => [
    category,
    plan.items.filter((item) => item.category === category).length
  ])
);
assert.deepEqual(actualCounts, {
  'Птица': 20,
  'Мясо': 16,
  'Рыба и морепродукты': 18,
  'Овощи и гарниры': 18,
  'Завтраки и выпечка': 10,
  'Закуски': 8,
  'Десерты': 10
});

const firstSix = [
  'af-chicken-paprika-2',
  'af-salmon-lemon-herbs-2',
  'af-potato-wedges-2',
  'af-brussels-lemon-2',
  'af-mushrooms-thyme-toast-2',
  'af-carrots-maple-thyme-2'
];
for (const id of firstSix) assert.ok(ids.includes(id), `Missing existing candidate: ${id}`);

console.log(JSON.stringify({
  ok: true,
  target: plan.target_count,
  actual: plan.items.length,
  uniqueIds: new Set(ids).size,
  categories: actualCounts,
  firstSixPreserved: true
}, null, 2));
