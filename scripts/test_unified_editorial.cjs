// Unified editorial rollout: syntax-independent invariants and asset-link regression.
// Only validates source integrity. Browser visual acceptance is a separate release gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pages = [
  ['index.html', 'assets/editorial-unified-20261106.css'],
  ['full-catalog/index.html', '../assets/editorial-unified-20261106.css']
];
const css = fs.readFileSync(path.join(root, 'assets/editorial-unified-20261106.css'),'utf8');
assert(css.includes('#recipeDetail') && css.includes('#cookOverlay'));
assert(css.includes('body.du-evening-mode #eveningLanding'));
assert(css.includes('@media (max-width: 430px)'));
assert(!/url\s*\(/i.test(css), 'No new unapproved images or fonts');
const payloads = [];
for(const [page, link] of pages) {
  const text = fs.readFileSync(path.join(root,page),'utf8');
  const stylesheet = '<link rel="stylesheet" href="' + link + '">';
  assert.equal(text.split(stylesheet).length-1, 1, page+' must load override exactly once');
  const existingLink = page==='index.html' ? 'assets/editorial-recipe.css' : '../assets/editorial-recipe.css';
  assert(text.indexOf(existingLink)>0 && text.indexOf(existingLink)<text.indexOf(stylesheet),'Existing recipe style must load before override');
  const found=text.match(/<script id="recipeData" type="application\/json">([\s\S]*?)<\/script>/);
  assert(found, page+': recipeData missing');
  const recipes=JSON.parse(found[1]);
  assert.equal(recipes.length,1001,page+': exactly 1001 recipes');
  assert.equal(new Set(recipes.map(r=>r.id)).size,1001,page+': unique IDs');
  payloads.push(found[1]);
}
assert.equal(payloads[0],payloads[1],'Both catalogues have identical recipe payloads');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const expected of [
 'assets/our-evening-together-approved.webp',
 'our-evening-invitation-approved-20261102.webp',
 'id="eveningLanding"',
 'id="music"'
]) assert(home.includes(expected),'Approved Our Evening asset/section missing: '+expected);
console.log('PASS: 1001 recipes in both catalogs; shared editorial stylesheet; approved Our Evening imagery untouched.');
