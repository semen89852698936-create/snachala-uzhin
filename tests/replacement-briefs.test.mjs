// Cross-check replacement briefs against the actual 1001-recipe catalog and archived WebP manifest.
// No image bytes are read, no source URL is treated as a photograph or a license clearance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const html = readFileSync('index.html', 'utf8');
const briefs = load('review/replacement-briefs-20261102.json');
const manifest = load('photo-library/batch-100-20261101/manifest.json');
const triage = load('review/visual-triage-20261102.json');

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

test('All 11 rejected images have distinct replacement briefs', () => {
  assert.equal(briefs.rejected_count, 11);
  assert.equal(briefs.briefs.length, 11);
  assert.equal(new Set(briefs.briefs.map(x => x.number)).size, 11);
  assert.deepEqual(briefs.briefs.map(x => x.number), [32,35,37,38,41,44,61,63,64,65,67]);
});

test('Ingredient quantities and preparation text match actual index.html recipes', () => {
  for (const brief of briefs.briefs) {
    const recipe = catalogRecipe(brief.recipe_id);
    assert.equal(brief.recipe_title, recipe.title, 'Title ' + brief.number);
    assert.deepEqual(brief.recipe_ingredients_exact,
      recipe.ingredients.map(({name, amount, unit}) => ({name, amount, unit})),
      'Ingredients ' + brief.number);
    assert.deepEqual(brief.preparation_reference,
      recipe.steps.map(x => x.detail), 'Preparation ' + brief.number);
  }
});

test('Every rejected image SHA, file and source matches manifest and visual triage', () => {
  for (const brief of briefs.briefs) {
    const archive = manifest.sources.find(x => x.number === brief.number);
    const review = triage.records.find(x => x.number === brief.number);
    assert.ok(archive && review, 'Missing archive or review ' + brief.number);
    assert.equal(review.visual_status, 'reject_for_recipe');
    assert.equal(brief.recipe_id, archive.recipe_id);
    assert.equal(brief.rejected_archive_photo.relative_file, archive.file);
    assert.equal(brief.rejected_archive_photo.sha256, archive.sha256);
    assert.equal(brief.rejected_archive_photo.sha256, review.image_sha256);
    assert.equal(brief.rejected_archive_photo.source_page, archive.source_page);
  }
});

test('Specifications cannot accidentally claim image delivery, rights or release', () => {
  for (const brief of briefs.briefs) {
    assert.equal(brief.replacement_status, 'not_found');
    assert.equal(brief.license_status, 'not_verified');
    assert.equal(brief.owner_publication_approval, false);
    assert.equal(brief.editorial_status, 'requires_independent_visual_review');
  }
});

test('Commons source-page records remain metadata only, never archive rights clearance', () => {
  const evidence = load('review/commons-source-page-evidence-20261102.json');
  assert.equal(evidence.source_pages_checked, 6);
  assert.equal(evidence.records.length, 6);
  assert.equal(new Set(evidence.records.map(x => x.number)).size, 6);
  for (const row of evidence.records) {
    const archive = manifest.sources.find(x => x.number === row.number);
    assert.ok(archive, 'Unknown Commons record ' + row.number);
    assert.equal(row.recipe_id, archive.recipe_id);
    assert.equal(row.sha256, archive.sha256);
    assert.equal(row.source_page, archive.source_page);
    assert.equal(row.verification, 'original_source_page_text_only');
    assert.equal(row.archive_file_provenance_verified, false);
    assert.equal(row.license_clearance_for_archive_copy, false);
    assert.equal(row.publication_approved, false);
    assert.ok(row.author.length > 2);
  }
});
