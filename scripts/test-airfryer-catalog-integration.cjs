'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'assets', 'airfryer-recipes.js');
const dataSource = fs.readFileSync(dataPath, 'utf8');
const context = { window: {} };
new vm.Script(dataSource, { filename: 'airfryer-recipes.js' }).runInNewContext(context);
const recipes = context.window.AIRFRYER_RECIPE_DATA;

assert.ok(Array.isArray(recipes), 'Air-fryer data must be an array');
assert.equal(recipes.length, 100, 'Exactly 100 air-fryer recipes must be integrated');
assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, 100, 'Recipe IDs must be unique');

const required = ['id', 'title', 'category', 'servings', 'temperature_c', 'cook_minutes', 'basket', 'ingredients', 'steps', 'doneness', 'safety', 'source_verification'];
for (const recipe of recipes) {
  for (const field of required) assert.ok(recipe[field] !== undefined && recipe[field] !== null, recipe.id + ' is missing ' + field);
  assert.equal(recipe.servings, 2, recipe.id + ' must remain a two-serving recipe');
  assert.ok(recipe.temperature_c >= 70 && recipe.temperature_c <= 200, recipe.id + ' temperature is outside the Tefal manual range');
  assert.ok(Array.isArray(recipe.cook_minutes) && recipe.cook_minutes.length === 2, recipe.id + ' must have a cooking-time range');
  assert.ok(recipe.cook_minutes[0] > 0 && recipe.cook_minutes[0] <= recipe.cook_minutes[1] && recipe.cook_minutes[1] <= 60, recipe.id + ' has an invalid cooking-time range');
  assert.ok(Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0, recipe.id + ' has no ingredients');
  assert.ok(Array.isArray(recipe.steps) && recipe.steps.length > 0, recipe.id + ' has no preparation steps');
  assert.ok(recipe.source_verification.source_url, recipe.id + ' has no recipe source URL');
  assert.equal(recipe.appliance_test_status, 'not_tested', recipe.id + ' must not claim physical appliance testing');
  assert.equal(recipe.publication_status, 'not_published', recipe.id + ' must not claim publication before release');
  const imagePath = path.join(root, 'assets', 'airfryer', recipe.id + '.webp');
  assert.ok(fs.existsSync(imagePath), recipe.id + ' is missing its local WebP image');
}

const imageFiles = fs.readdirSync(path.join(root, 'assets', 'airfryer')).filter((file) => file.endsWith('.webp'));
assert.equal(imageFiles.length, 100, 'The air-fryer photo library must contain exactly 100 WebP files');

for (const relative of ['index.html', 'full-catalog/index.html']) {
  const html = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.ok(html.includes('id="airfryer"'), relative + ' is missing the air-fryer section');
  assert.ok(html.includes('/assets/airfryer-catalog.css'), relative + ' is missing catalogue styling');
  assert.ok(html.includes('/assets/airfryer-recipes.js'), relative + ' is missing the 100-recipe data script');
  assert.ok(html.includes('/assets/airfryer-catalog.js'), relative + ' is missing catalogue interactions');
  assert.ok(!html.includes('Раздел наполняется'), relative + ' still contains the old placeholder');
  assert.ok(html.includes('RECIPES.push(...AIRFRYER_APP_RECIPES)'), relative + ' does not connect air-fryer recipes to recipe details');
  assert.ok(html.includes('!r.airfryer&&'), relative + ' may leak air-fryer recipes into the 1001-recipe catalogue');
  assert.ok(html.includes('!r.airfryer&&r.category===cat'), relative + ' may leak air-fryer recipes into the curated evening menus');
  assert.ok(html.includes('if(item.display)return item.display'), relative + ' does not preserve exact ingredient quantity text');
  assert.ok(html.includes('du-af-facts'), relative + ' is missing appliance-specific recipe facts');
  assert.ok(html.indexOf('/assets/airfryer-recipes.js') < html.indexOf('const RECIPES = JSON.parse'), relative + ' loads recipe data after the main app');
  const appStart = html.indexOf("<script>'use strict';");
  const appEnd = html.indexOf('</script>', appStart);
  const appScript = appStart >= 0 && appEnd > appStart ? html.slice(html.indexOf('>', appStart) + 1, appEnd) : '';
  assert.ok(appScript, relative + ' main application script was not found');
  new vm.Script(appScript, { filename: relative + ':main-script' });
}

new vm.Script(fs.readFileSync(path.join(root, 'assets', 'airfryer-catalog.js'), 'utf8'), { filename: 'airfryer-catalog.js' });
new vm.Script(dataSource, { filename: 'airfryer-recipes.js' });

console.log(JSON.stringify({
  ok: true,
  recipes: recipes.length,
  uniqueIds: new Set(recipes.map((recipe) => recipe.id)).size,
  images: imageFiles.length,
  editions: ['index.html', 'full-catalog/index.html'],
  physicalTestingClaimed: recipes.some((recipe) => recipe.appliance_test_status !== 'not_tested')
}, null, 2));
