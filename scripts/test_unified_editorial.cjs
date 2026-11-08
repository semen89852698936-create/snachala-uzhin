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
const editorialPhotos=[
  '/assets/home-hero-steak-wine-20261108.webp',
  '/assets/recipes-ai/0003-pepper-steak.webp'
];
const editorialPaperAssets=[
  '/assets/editorial-paper-fibres-20261108.svg',
  '/assets/editorial-paper-tear-mask-20261108.svg',
  '/assets/editorial-paper-panel-mask-20261108.svg',
  '/assets/editorial-paper-torn-bottom-20261108.svg'
];
assert.deepEqual([...new Set(cssUrls)].sort(),[...editorialPhotos,...editorialPaperAssets].sort(),
  'CSS must reference only approved local photos and torn-paper design assets');
for (const localUrl of [...editorialPhotos,...editorialPaperAssets]) {
  assert(fs.existsSync(path.join(root,localUrl.slice(1))),
    'Referenced editorial asset does not exist: '+localUrl);
}
for (const url of editorialPaperAssets) {
  const svg=fs.readFileSync(path.join(root,url.slice(1)),'utf8');
  assert(svg.includes('<svg') && svg.includes('</svg>'),
    'Torn paper SVG must contain a valid SVG root and close: '+url);
}
assert(css.includes('ORGANIC_FIBRE_TORN_PAPER_CONTROLS_20261108'),
  'Approved organic paper material is not enabled');
assert(css.includes('editorial-paper-torn-bottom-20261108.svg'),
  'Photographic lower edge is still an outdated polygonal wave');
assert(css.includes('APPROVED_THREE_SCENE_COMPOSITION_20261108_V2'),
  'The approved three-scene editorial composition must remain in the shared CSS');
assert(css.includes('grid-template-columns:minmax(0,1.08fr) minmax(0,.68fr) minmax(0,.90fr)'),
  'The desktop dinner spread must retain three photographic/text planes');
// Homepage photograph is a real, one-time generated WebP, not a screenshot of
// interface text or an ephemeral external image.
const crypto=require('node:crypto');
const heroBytes=fs.readFileSync(path.join(root,'assets/home-hero-steak-wine-20261108.webp'));
assert.equal(heroBytes.subarray(0,4).toString(),'RIFF','Home hero file is not WebP');
assert.equal(heroBytes.subarray(8,12).toString(),'WEBP','Home hero lacks WebP signature');
const heroMeta=JSON.parse(fs.readFileSync(path.join(root,'photo-library/home-hero-steak-wine-20261108.json'),'utf8'));
assert.equal(heroMeta.image,'assets/home-hero-steak-wine-20261108.webp');
assert.equal(heroMeta.sha256,crypto.createHash('sha256').update(heroBytes).digest('hex'),
  'One-time generated homepage asset hash mismatch');
assert.equal(heroMeta.width,1400);
assert.equal(heroMeta.height,900);
assert(!fs.existsSync(path.join(root,'photo-library/home-hero-steak-wine-20261108.pending.json')),
  'Homepage photo generation left an unresolved paid request');
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
