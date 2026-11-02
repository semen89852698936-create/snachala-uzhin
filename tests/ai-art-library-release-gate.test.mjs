import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const root = 'photo-library/alice-ai-art';
const catalog = read('photo-library/recipes.json');
const progress = read(root + '/progress.json');
const review = read('review/ai-art-first-five-visual-triage-20261102.json');
const files = readdirSync(root + '/records').filter(name => name.endsWith('.json')).sort();
const metadata = files.map(name => read(root + '/records/' + name));

test('1001 AI photographs have unique local records but no release approval', () => {
  assert.equal(catalog.recipe_count, 1001);
  assert.equal(catalog.recipes.length, 1001);
  assert.equal(progress.verified_webp, 1001);
  assert.equal(progress.complete_and_verified, true);
  assert.equal(progress.production_site_updated, false);
  assert.equal(progress.all_images_pending_visual_review, true);
  assert.equal(files.length, 1001);
  assert.equal(metadata.length, 1001);
  const paths = new Set();
  const recipeIds = new Set();
  for (let i = 0; i < metadata.length; i++) {
    const m = metadata[i], recipe = catalog.recipes[i];
    assert.equal(m.n, i + 1, 'record number mismatch at ' + files[i]);
    assert.equal(m.recipe_id, recipe.id, 'recipe mismatch at ' + files[i]);
    assert.equal(m.title, recipe.title, 'title mismatch at ' + files[i]);
    assert.equal(m.path, root + '/photos/' + files[i].replace(/\.json$/, '.webp'));
    assert.match(m.sha256, /^[a-f0-9]{64}$/);
    assert.ok(existsSync(m.path), 'missing physical WebP: ' + m.path);
    assert.equal(m.status, 'generated_unpublished', 'unexpected release state: ' + m.path);
    assert.equal(m.approved_for_publication, false, 'unreviewed approval: ' + m.path);
    assert.ok(!paths.has(m.path), 'duplicate path: ' + m.path);
    assert.ok(!recipeIds.has(m.recipe_id), 'duplicate recipe: ' + m.recipe_id);
    paths.add(m.path);
    recipeIds.add(m.recipe_id);
  }
});

test('five visual reviews are linked to the generated metadata, never to publication', () => {
  assert.equal(review.source_commit, 'a1c30f0be8745b8996577da7e7a4a3c2b3f2f028');
  assert.equal(review.records.length, 5);
  assert.equal(review.visually_checked, 5);
  assert.equal(review.approved_for_publication, 0);
  const allowed = new Set(['needs_culinary_review', 'candidate_visual_match_unapproved', 'reject_cooked_recipe_mismatch']);
  for (const entry of review.records) {
    const m = metadata[entry.number - 1];
    assert.equal(entry.recipe_id, m.recipe_id);
    assert.equal(entry.photo_path, m.path);
    assert.equal(entry.metadata_sha256, m.sha256);
    assert.ok(allowed.has(entry.visual_status), 'unrecognized review status');
    assert.equal(entry.owner_approved, false);
    assert.equal(entry.published, false);
    assert.equal(entry.license_and_rights_status, 'not_verified');
    assert.equal(m.approved_for_publication, false);
  }
  assert.equal(review.records.filter(x => x.visual_status === 'reject_cooked_recipe_mismatch').length, 1);
  assert.equal(review.records.find(x => x.number === 5).recipe_id, 'salmon-lemon');
});
