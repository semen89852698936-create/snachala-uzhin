import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const a = read('review/visual-triage-addendum-20261102-1543.json');
const m = read('photo-library/batch-100-20261101/manifest.json');
const c = read('review/visual-triage-20261102.json');

test('Three new direct WebP reviews refer to unique immutable archive entries', () => {
  assert.deepEqual(a.records.map(x => x.number), [33, 34, 36]);
  assert.equal(a.source_commit, c.archive_commit_sha);
  assert.equal(a.source_manifest_blob_sha, c.archive_manifest_blob_sha);
  assert.equal(a.addendum_reviewed, 3);
  assert.equal(a.addendum_rejected, 3);
  assert.equal(new Set(a.records.map(x => x.number)).size, 3);
  for (const x of a.records) {
    const source = m.sources.find(y => y.number === x.number);
    assert.ok(source, 'Missing manifest entry '+x.number);
    assert.equal(c.records.filter(y => y.number === x.number).length, 0, 'Previously reviewed '+x.number);
    assert.equal(x.recipe_id, source.recipe_id);
    assert.equal(x.recipe_title, source.title);
    assert.equal(x.archive_path, 'photo-library/batch-100-20261101/'+source.file);
    assert.equal(x.image_sha256, source.sha256);
    assert.equal(x.source_page, source.source_page);
    assert.match(x.git_blob_sha, /^[a-f0-9]{40}$/);
    assert.equal(x.visual_status, 'reject_for_recipe');
    assert.ok(x.observed_visual_evidence.length > 35);
    assert.equal(x.source_license_status, 'not_verified');
    assert.equal(x.archive_file_provenance_verified, false);
    assert.equal(x.publication_approved, false);
  }
});

test('Existing review 35 is not counted twice; addendum cannot clear images', () => {
  assert.equal(c.records.filter(x => x.number === 35).length, 1);
  assert.equal(a.records.some(x => x.number === 35), false);
  assert.equal(a.base_canonical_reviewed, c.reviewed_images);
  assert.equal(a.combined_unique_reviewed, c.reviewed_images + a.addendum_reviewed);
  assert.equal(a.combined_rejected, c.clear_mismatch_count + a.addendum_rejected);
  assert.equal(a.combined_unreviewed, m.photo_files - a.combined_unique_reviewed);
  assert.equal(a.license_verified_count, 0);
  assert.equal(a.combined_unique_reviewed, 32);
  assert.equal(a.combined_rejected, 28);
});
