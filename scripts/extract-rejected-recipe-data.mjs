// Extract exact catalog ingredients for rejected archived WebP still lacking replacement briefs.
// This is metadata preparation only: no downloaded images, legal clearance, or release approval.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const html = readFileSync('index.html', 'utf8');
const triage = readJson('review/visual-triage-20261102.json');
const briefs = readJson('review/replacement-briefs-20261102.json');
const manifest = readJson('photo-library/batch-100-20261101/manifest.json');

function catalogRecipe(id) {
  const start = html.indexOf('{"id":' + JSON.stringify(id));
  assert.ok(start >= 0, 'Catalog recipe not found: ' + id);
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else {
      if (c === '"') quoted = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
  }
  throw new Error('Unclosed recipe: ' + id);
}

const already = new Set(briefs.briefs.map(x => x.number));
assert.equal(already.size, briefs.briefs.length, 'Duplicate replacement briefs');
const rejected = triage.records.filter(x => x.visual_status === 'reject_for_recipe');
const rejectedNumbers = new Set(rejected.map(x => x.number));
assert.equal(rejectedNumbers.size, rejected.length, 'Duplicate rejected triage records');
for (const brief of briefs.briefs) {
  assert.ok(rejectedNumbers.has(brief.number), 'Brief not backed by rejection: ' + brief.number);
}
const missing = rejected.filter(x => !already.has(x.number)).sort((a,b) => a.number - b.number);
const results = missing.map(review => {
  const archive = manifest.sources.find(x => x.number === review.number);
  assert.ok(archive, 'Missing archived source: ' + review.number);
  assert.equal(archive.sha256, review.image_sha256, 'Archive/triage SHA mismatch: ' + review.number);
  assert.equal(archive.recipe_id, review.recipe_id, 'Recipe ID mismatch: ' + review.number);
  const recipe = catalogRecipe(review.recipe_id);
  assert.equal(recipe.title, archive.title, 'Catalog title mismatch: ' + review.number);
  assert.ok(Array.isArray(recipe.ingredients) && recipe.ingredients.length, 'Missing ingredients: ' + review.number);
  assert.ok(Array.isArray(recipe.steps) && recipe.steps.length, 'Missing steps: ' + review.number);
  return {
    number: review.number,
    recipe_id: recipe.id,
    recipe_title: recipe.title,
    recipe_ingredients_exact: recipe.ingredients.map(({name, amount, unit}) => ({name, amount, unit})),
    preparation_reference: recipe.steps.map(x => x.detail),
    rejected_archive_photo: {
      relative_file: archive.file,
      sha256: archive.sha256,
      reason: review.observed_visual_evidence,
      source_page: archive.source_page,
      license_claim_unverified: archive.license
    },
    replacement_status: 'not_found',
    license_status: 'not_verified',
    editorial_status: 'requires_independent_visual_review',
    owner_publication_approval: false
  };
});
console.log('REPLACEMENT_DATA_JSON=' + JSON.stringify(results));
console.log('Unbriefed visual rejects: ' + results.map(x => x.number).join(', ') + ' (' + results.length + ')');
