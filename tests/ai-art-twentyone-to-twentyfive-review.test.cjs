'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const load = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const review = load('review/ai-art-twentyone-to-twentyfive-visual-triage-20261102.json');
const briefs = load('photo-library/ai-art-replacement-briefs-22-23-20261102.json');
const photoMap = load('photo-library/ai-recipe-photo-map.json');
const meatRelease = load('photo-library/meat-14-site-release-20261103.json');
const allowed = new Set(['candidate_visual_match_unapproved','needs_culinary_review','rejected_visual_mismatch']);

test('five real current-site WebP reviews are source-pinned and never approve release', () => {
  assert.equal(photoMap.total, 1001);
  assert.equal(photoMap.photos.length, 1001);
  assert.deepEqual(review.review_range, [21,25]);
  assert.equal(review.sample_size, 5);
  assert.equal(review.visually_checked, 5);
  assert.equal(review.records.length, 5);
  assert.deepEqual(review.records.map(r => r.number), [21,22,23,24,25]);
  assert.match(review.source_commit, /^[a-f0-9]{40}$/);
  assert.equal(review.source_recipe_catalog_blob_sha, 'acb94b3fd125bd3dfd06f5d79bece0b3c3257c4e');
  assert.equal(review.approved_for_publication, 0);
  assert.equal(review.production_delivery_verified, false);
  for (const r of review.records) {
    const row = photoMap.photos[r.number-1];
    assert.equal(row.n, r.number);
    assert.equal(row.recipe_id, r.recipe_id);
    assert.equal(row.path, '/'+r.photo_path);
    assert.equal(row.sha, r.photo_git_blob_sha);
    assert.match(r.photo_git_blob_sha, /^[a-f0-9]{40}$/);
    assert.ok(fs.existsSync(path.join(root,r.photo_path)), 'Physical WebP absent: '+r.number);
    assert.ok(allowed.has(r.visual_status));
    assert.ok(r.observed_visual_evidence.length > 100);
    assert.ok(r.visual_limitations.length > 65);
    assert.equal(r.rights_status, 'not_verified');
    assert.equal(r.owner_approved, false);
    assert.equal(r.publication_authorization_from_this_review, false);
    assert.equal(r.recipe_catalog_blob_sha, review.source_recipe_catalog_blob_sha);
  }
});

test('editorial decisions and exact replacement briefs are complete', () => {
  const count = status => review.records.filter(r => r.visual_status === status).length;
  assert.equal(review.candidate_unapproved, count('candidate_visual_match_unapproved'));
  assert.equal(review.needs_culinary_review, count('needs_culinary_review'));
  assert.equal(review.rejected, count('rejected_visual_mismatch'));
  assert.equal(review.candidate_unapproved+review.needs_culinary_review+review.rejected, 5);
  assert.equal(briefs.cost_approval_required, true);
  assert.equal(briefs.publication_allowed, false);
  assert.equal(briefs.source_review, 'review/ai-art-twentyone-to-twentyfive-visual-triage-20261102.json');
  const rejected = review.records.filter(r=>r.visual_status==='rejected_visual_mismatch');
  assert.deepEqual(briefs.items.map(x=>x.number), rejected.map(x=>x.number));
  for (const b of briefs.items) {
    const r = rejected.find(x=>x.number===b.number);
    assert.equal(b.recipe_id,r.recipe_id);
    assert.equal(b.rejected_photo_blob_sha,r.photo_git_blob_sha);
    assert.ok(b.must_show.length>=3 && b.must_avoid.length>=2);
    assert.equal(b.rights_status,'unverified');
    assert.equal(b.status,'brief_only_no_physical_replacement');
  }
});

test('review targets exact regenerated meat release #21-24, while #25 remains original', () => {
  const released = new Map(meatRelease.photos.map(p=>[p.number,p]));
  for (const r of review.records.filter(x=>x.number<=24)) {
    const p = released.get(r.number);
    assert.ok(p,'Regenerated meat release missing '+r.number);
    assert.equal('/'+r.photo_path,p.new_path);
    assert.equal(r.photo_git_blob_sha,p.new_blob_sha);
    assert.ok(fs.existsSync(path.join(root,p.original_path.slice(1))), 'Original photo must remain');
  }
  assert.equal(released.has(25),false);
  assert.equal(review.records[4].photo_path,'assets/recipes-ai/0025-collection-meat-01-07.webp');
});
