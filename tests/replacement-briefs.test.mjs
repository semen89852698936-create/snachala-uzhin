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

test('Every rejected archived image has a distinct, exact replacement brief', () => {
  const rejected = triage.records.filter(x => x.visual_status === 'reject_for_recipe');
  const expectedNumbers = rejected.map(x => x.number).sort((a,b) => a - b);
  assert.equal(briefs.rejected_count, expectedNumbers.length);
  assert.equal(briefs.briefs.length, expectedNumbers.length);
  assert.equal(new Set(briefs.briefs.map(x => x.number)).size, expectedNumbers.length);
  assert.deepEqual(briefs.briefs.map(x => x.number).sort((a,b) => a - b), expectedNumbers);
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

test('The four addendum reviews are integrated exactly once and have source-matched briefs', () => {
  const addendum = load('review/visual-triage-addendum-20261102-1042.json');
  assert.equal(addendum.source_commit, triage.archive_commit_sha);
  assert.equal(addendum.source_manifest_blob_sha, triage.archive_manifest_blob_sha);
  assert.equal(addendum.addendum_reviewed, 4);
  assert.equal(addendum.addendum_rejected, 4);
  assert.equal(addendum.records.length, 4);
  assert.equal(new Set(addendum.records.map(x => x.number)).size, 4);
  assert.equal(triage.reviewed_images, triage.records.length);
  assert.ok(triage.reviewed_images >= addendum.combined_unique_reviewed, 'Historical addendum must remain integrated');
  assert.ok(triage.clear_mismatch_count >= addendum.combined_rejected, 'New reviews may increase rejected total');
  assert.ok(100 - triage.reviewed_images <= addendum.remaining_unreviewed, 'New reviews may reduce unreviewed total');
  assert.equal(briefs.rejected_count, triage.clear_mismatch_count);
  for (const row of addendum.records) {
    const matches = triage.records.filter(x => x.number === row.number);
    assert.equal(matches.length, 1, 'Unique canonical review ' + row.number);
    assert.equal(matches[0].visual_status, 'reject_for_recipe');
    assert.equal(matches[0].image_sha256, row.archive_sha256_from_manifest);
    assert.equal(matches[0].git_blob_sha, row.git_blob_sha);
    assert.equal(matches[0].observed_visual_evidence, row.observed_visual_evidence);
    const matchedBriefs = briefs.briefs.filter(x => x.number === row.number);
    assert.equal(matchedBriefs.length, 1, 'Unique replacement brief ' + row.number);
    assert.equal(matchedBriefs[0].recipe_id, row.recipe_id);
    assert.equal(matchedBriefs[0].rejected_archive_photo.sha256, row.archive_sha256_from_manifest);
    assert.equal(matchedBriefs[0].replacement_status, 'not_found');
    assert.equal(matchedBriefs[0].license_status, 'not_verified');
    assert.equal(matchedBriefs[0].owner_publication_approval, false);
  }
});


test('Four new direct-WebP reviews 22-25 match immutable archive and do not imply clearance', () => {
  const statuses = new Map([[22, 'reject_for_recipe'], [23, 'reject_for_recipe'],
    [24, 'reject_for_recipe'], [25, 'partial_match_needs_recipe_review']]);
  assert.equal(triage.reviewed_images, triage.records.length);
  assert.equal(new Set(triage.records.map(x => x.number)).size, triage.records.length);
  for (const [number, status] of statuses) {
    const source = manifest.sources.find(x => x.number === number);
    const reviews = triage.records.filter(x => x.number === number);
    assert.equal(reviews.length, 1, 'One review per archive number ' + number);
    const row = reviews[0];
    assert.equal(row.visual_status, status);
    assert.equal(row.recipe_id, source.recipe_id);
    assert.equal(row.image_sha256, source.sha256);
    assert.equal(row.archive_path, 'photo-library/batch-100-20261101/' + source.file);
    assert.ok(row.git_blob_sha.length >= 40);
    assert.equal(row.source_license_status, 'not_verified');
    assert.equal(row.publication_approved, false);
    const matchedBriefs = briefs.briefs.filter(x => x.number === number);
    assert.equal(matchedBriefs.length, status === 'reject_for_recipe' ? 1 : 0);
    if (matchedBriefs.length) {
      assert.equal(matchedBriefs[0].rejected_archive_photo.sha256, source.sha256);
      assert.deepEqual(matchedBriefs[0].recipe_ingredients_exact,
        catalogRecipe(source.recipe_id).ingredients.map(({name, amount, unit}) => ({name, amount, unit})));
    }
  }
  assert.equal(triage.reviewed_images, 32);
  assert.equal(triage.clear_mismatch_count, 28);
  assert.equal(triage.partial_match_count, 3);
  assert.equal(triage.possible_match_count, 1);
  assert.equal(briefs.rejected_count, 28);
});
