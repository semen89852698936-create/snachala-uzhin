import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const review = read('review/ai-art-eleven-to-fifteen-visual-triage-20261102.json');
const earlier = [
  ...read('review/ai-art-first-five-visual-triage-20261102.json').records,
  ...read('review/ai-art-six-to-ten-visual-triage-20261102.json').records
];
const recipes = read('photo-library/recipes.json').recipes;
const pinned = new Map([
  [11, 'a91473a9e29b9afe5aef18b2cc47127d104f7275'],
  [12, '3ba84d1e422b1596fbda44d430455f100075fd61'],
  [13, 'ab06cdae7fed38cc3843c659ba6babbdc18c137a'],
  [14, '149e2b8a0ceb70227bdcd7e8936ed1fdabdf2eb7'],
  [15, 'a2d408f471edaa06e31dac663d3a0475fe6fea7c']
]);
test('11-15 direct review matches source-pinned physical WebP, metadata and exact recipes', () => {
  assert.equal(review.source_commit, 'a1c30f0be8745b8996577da7e7a4a3c2b3f2f028');
  assert.deepEqual(review.records.map(r => r.number), [11, 12, 13, 14, 15]);
  assert.equal(review.sample_size, 5);
  assert.equal(review.visually_checked, 5);
  assert.equal(new Set([...earlier, ...review.records].map(r => r.number)).size, 15);
  for (const item of review.records) {
    const recipe = recipes[item.number - 1];
    const prefix = String(item.number).padStart(4, '0') + '-' + item.recipe_id;
    const meta = read('photo-library/alice-ai-art/records/' + prefix + '.json');
    assert.equal(recipe.n, item.number);
    assert.equal(recipe.id, item.recipe_id);
    assert.equal(recipe.title, item.recipe_title);
    assert.equal(meta.recipe_id, item.recipe_id);
    assert.equal(meta.path, item.photo_path);
    assert.equal(meta.sha256, item.metadata_sha256);
    assert.equal(item.photo_git_blob_sha, pinned.get(item.number));
    assert.match(item.metadata_git_blob_sha, /^[a-f0-9]{40}$/);
    assert.ok(existsSync(item.photo_path), 'missing physical WebP: ' + item.photo_path);
    assert.ok(item.observed_visual_evidence.length > 100);
    assert.equal(meta.status, 'generated_unpublished');
    assert.equal(meta.approved_for_publication, false);
    assert.equal(item.license_and_rights_status, 'not_verified');
    assert.equal(item.owner_approved, false);
    assert.equal(item.published, false);
  }
});
test('11-15 classifications remain fail-closed and tally correctly', () => {
  const counts = {candidate_visual_match_unapproved: 2, needs_culinary_review: 3};
  assert.equal(review.candidate_unapproved, counts.candidate_visual_match_unapproved);
  assert.equal(review.needs_culinary_review, counts.needs_culinary_review);
  assert.equal(review.rejected, 0);
  assert.equal(review.approved_for_publication, 0);
  for (const [status, count] of Object.entries(counts)) {
    assert.equal(review.records.filter(r => r.visual_status === status).length, count);
  }
  assert.equal(review.records.find(r => r.number === 14).visual_status, 'needs_culinary_review');
  assert.ok(review.records.every(r => !r.visual_status.startsWith('reject_')));
});
