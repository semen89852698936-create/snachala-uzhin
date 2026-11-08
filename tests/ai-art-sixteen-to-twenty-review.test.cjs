'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const load = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const review = load('review/ai-art-sixteen-to-twenty-visual-triage-20261102.json');
const briefs = load('photo-library/ai-art-replacement-briefs-18-19-20261102.json');
const photoMap = load('photo-library/ai-recipe-photo-map.json');
const allowed = new Set(['candidate_visual_match_unapproved','needs_culinary_review','rejected_visual_mismatch']);
test('five distinct, source-pinned current-site WebP reviews', () => {
  assert.equal(photoMap.total, 1001);
  assert.equal(photoMap.photos.length, 1001);
  assert.deepEqual(review.review_range, [16,20]);
  assert.equal(review.sample_size, 5);
  assert.equal(review.visually_checked, 5);
  assert.equal(review.records.length, 5);
  assert.equal(review.source_photo_map_blob_sha, '77e0428e8bb97546dbac2e093a585433d20da607');
  assert.equal(review.source_recipe_catalog_blob_sha, 'acb94b3fd125bd3dfd06f5d79bece0b3c3257c4e');
  const numbers = review.records.map(r => r.number);
  assert.deepEqual(numbers, [16,17,18,19,20]);
  assert.equal(new Set(numbers).size, 5);
  for (const r of review.records) {
    const source = photoMap.photos.find(p => p.n === r.number);
    assert.ok(source, 'Missing source image for '+r.number);
    assert.equal(r.recipe_id, source.recipe_id);
    assert.equal('/'+r.photo_path, source.path);
    assert.equal(r.photo_git_blob_sha, source.sha);
    assert.match(r.photo_git_blob_sha, /^[a-f0-9]{40}$/);
    assert.ok(allowed.has(r.visual_status));
    assert.ok(r.observed_visual_evidence.length > 70);
    assert.ok(r.visual_limitations.length > 40);
    assert.equal(r.rights_status, 'not_verified');
    assert.equal(r.owner_approved, false);
    assert.equal(r.published, false);
    assert.equal(r.recipe_catalog_blob_sha, review.source_recipe_catalog_blob_sha);
  }
});
test('counts are derived from editorial decisions, never treated as approvals', () => {
  const count = status => review.records.filter(r => r.visual_status === status).length;
  assert.equal(review.candidate_unapproved, count('candidate_visual_match_unapproved'));
  assert.equal(review.needs_culinary_review, count('needs_culinary_review'));
  assert.equal(review.rejected, count('rejected_visual_mismatch'));
  assert.equal(review.approved_for_publication, 0);
  assert.equal(review.candidate_unapproved+review.needs_culinary_review+review.rejected, review.visually_checked);
});
test('each rejected photo has one source-pinned replacement brief, without paid or release permission', () => {
  assert.equal(briefs.cost_approval_required, true);
  assert.equal(briefs.publication_allowed, false);
  const rejected = review.records.filter(r => r.visual_status === 'rejected_visual_mismatch');
  assert.deepEqual(briefs.items.map(i=>i.number), rejected.map(r=>r.number));
  for (const item of briefs.items) {
    const r = rejected.find(x => x.number === item.number);
    assert.ok(r);
    assert.equal(item.recipe_id, r.recipe_id);
    assert.equal(item.rejected_photo_blob_sha, r.photo_git_blob_sha);
    assert.ok(item.must_show.length >= 3);
    assert.ok(item.must_avoid.length >= 2);
    assert.equal(item.status, 'brief_only_no_physical_replacement');
    assert.equal(item.rights_status, 'unverified');
  }
});
