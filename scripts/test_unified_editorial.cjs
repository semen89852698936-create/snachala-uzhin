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
const cssUrls=[...css.matchAll(/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map(x=>x[1]);
assert(cssUrls.length>=1, 'Editorial photos must be referenced');
for(const url of new Set(cssUrls)){
  assert(/^\\/assets\\/recipes-ai\\/[0-9]{4}-[a-z0-9-]+\\.webp$/.test(url),
    'Only local catalog WebP photos are permitted; reject remote images and fonts: '+url);
  assert(fs.existsSync(path.join(root,url.slice(1))),
    'Referenced recipe photograph must exist in the local library: '+url);
}
const payloads = [];
for(const [page, link] of pages) {
  const text = fs.readFileSync(path.join(root,page),'utf8');
  const stylesheet = '<link rel="stylesheet" href="' + link + '">';
  assert.equal(text.split(stylesheet).length-1, 1, page+' must load override exactly once');
  const existingLink = page==='index.html' ? 'assets/editorial-recipe.css' : '../assets/editorial-recipe.css';
  assert(text.indexOf(existingLink)>0 && text.indexOf(existingLink)<text.indexOf(stylesheet),'Existing recipe style must load before override');
  const found=text.match(/<script id="recipeData" type="application\/json">([\s\S]*?)<\/script>/);
  assert(found, page+': recipeData missing');
  assert(text.includes('1000 рецептов + 1 полуночный'),page+': hero label must say midnight');
  assert(text.includes('class="du-approved-feature-grid"'), page+': approved three editorial links missing');
  for(const fragment of ['href="#catalog"','href="#airfryer"','href="#evening"','id="tryCooking"'])
    assert(text.includes(fragment),page+': functional entry missing '+fragment);
  const arch=text.match(/class="du-hero-one-curve"[\\s\\S]*?<path d="([^"]+)"/);
  assert(arch && (arch[1].match(/Q/g)||[]).length===1 && !/[CS]/.test(arch[1]),
    page+': approved red line must have ONE quadratic bend');
  assert(text.includes('1000 рецептов и 1 полуночный'),page+': catalog label must say midnight');
  assert(!/1000 рецептов (?:\+|и) 1 секретный/i.test(text),page+': outdated secret bonus label');
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
