'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const paths = ['index.html','full-catalog/index.html'];

for (const path of paths) {
  const html = fs.readFileSync(path, 'utf8');
  const marker = html.match(/\/\* INGREDIENT_SEARCH_V1_START[\s\S]*?INGREDIENT_SEARCH_V1_END \*\//);
  assert.ok(marker, path+': ingredient matcher missing');

  const dataStart = html.indexOf('id="recipeData"');
  assert.ok(dataStart >= 0, path+': recipeData missing');
  const start = html.indexOf('>', dataStart) + 1;
  const end = html.indexOf('</script>', start);
  const recipes = JSON.parse(html.slice(start,end));
  assert.equal(recipes.length, 1001, path+': must preserve 1001 recipes');
  assert.equal(new Set(recipes.map(x=>x.id)).size, 1001, path+': duplicate recipe ids');

  const appStart = html.lastIndexOf('<script>', html.indexOf('function renderRecipes()'));
  const appEnd = html.indexOf('</script>', html.indexOf('function renderRecipes()'));
  assert.ok(appStart >= 0 && appEnd > appStart, path+': recipe JS missing');
  new vm.Script(html.slice(appStart+8, appEnd), {filename:path}); // compile only, no DOM

  const context = vm.createContext({
    norm: s => String(s ?? '').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').normalize('NFKC')
  });
  new vm.Script(marker[0], {filename:path}).runInContext(context);
  const parts = vm.runInContext('ingredientSearchParts', context);
  const matches = vm.runInContext('recipeMatchesIngredientParts', context);

  const allThree = recipes.filter(r=>matches(r,parts('курица, сливки, грибы')));
  assert.equal(allThree.length, 6, path+': expected 6 actual chicken + cream + mushroom dishes');
  assert.equal(recipes.filter(r=>matches(r,parts('КУРИЦА; СЛИВКИ; ГРИБЫ'))).length,6, path+': semicolon/case aliases');
  assert.equal(recipes.filter(r=>matches(r,parts('курица, сливки, несуществующийпродукт'))).length,0,
    path+': AND search must not silently return partial ingredient matches');
  assert.equal(matches({title:'Курица с грибами',description:'сливки',ingredients:[]},parts('курица, сливки')),false,
    path+': compound ingredient query must inspect ingredients, not marketing description');
  assert.ok(html.includes('ingredientParts?recipeMatchesIngredientParts(r,ingredientParts)'),
    path+': matcher not connected to catalog rendering');
  assert.ok(html.includes('!query||(ingredientParts?'), path+': plain-text search fallback missing');

  console.log('PASS',path,'recipes:',recipes.length,'multi-ingredient example matches:',allThree.length);
}
