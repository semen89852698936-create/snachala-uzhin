import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRelease } from '../scripts/photo-release-gate.mjs';

function fixtures() {
  const sources = Array.from({length: 100}, (_, i) => ({
    number: i + 1, recipe_id: 'recipe-' + (i + 1),
    sha256: (i + 1).toString(16).padStart(64, '0'),
    source_page: 'https://example.org/image/' + (i + 1),
    license: i === 0 ? 'CC BY-SA 4.0' : 'CC0',
    license_url: i === 0 ? 'https://creativecommons.org/licenses/by-sa/4.0' : 'https://creativecommons.org/publicdomain/zero/1.0/'
  }));
  return { manifest: {sources}, ledger: {schema_version: 1, release_candidates: []} };
}
function valid(source) {
  return {
    recipe_id: source.recipe_id,
    reviewed_image_sha256: source.sha256,
    reviewed_source_page: source.source_page,
    visual_match_confirmed: true,
    visual_evidence_ref: 'review/evidence/001.png',
    ingredient_review_notes: 'Verified against recipe ingredients and dish presentation',
    reviewer: 'Editorial reviewer',
    reviewed_date: '2026-11-02',
    license_terms_reviewed: true,
    license_evidence_url: source.source_page,
    verified_license: source.license,
    modifications_disclosed: true,
    author_verified: true,
    attribution_text: 'Photo: verified author, CC BY-SA 4.0',
    verified_license_url: source.license_url,
    share_alike_obligations_reviewed: true,
    explicit_archive_copy_reapproval: true
  };
}
test('empty ledger blocks all archive files', () => {
  const {manifest, ledger} = fixtures();
  const r = auditRelease(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.equal(r.blocked_from_release, 100);
  assert.deepEqual(r.errors, []);
});
test('explicit evidence can clear one candidate, not other 99', () => {
  const {manifest, ledger} = fixtures();
  ledger.release_candidates.push(valid(manifest.sources[0]));
  const r = auditRelease(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 1);
  assert.equal(r.blocked_from_release, 99);
});
test('stale SHA and missing visual evidence block release', () => {
  const {manifest, ledger} = fixtures();
  const c = valid(manifest.sources[0]);
  c.reviewed_image_sha256 = '0'.repeat(64);
  delete c.visual_evidence_ref;
  ledger.release_candidates.push(c);
  const r = auditRelease(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.match(r.errors[0], /reviewed_image_sha256/);
  assert.match(r.errors[0], /visual_evidence_ref/);
});
test('CC BY-SA requires attribution and share-alike review', () => {
  const {manifest, ledger} = fixtures();
  const c = valid(manifest.sources[0]);
  delete c.attribution_text;
  c.share_alike_obligations_reviewed = false;
  ledger.release_candidates.push(c);
  const r = auditRelease(manifest, ledger);
  assert.match(r.errors[0], /attribution_text/);
  assert.match(r.errors[0], /share_alike_obligations_reviewed/);
});
test('production approvals 6, 10 and 20 do not transfer to archive', () => {
  const {manifest, ledger} = fixtures();
  for (const n of [6, 10, 20]) {
    const c = valid(manifest.sources[n - 1]);
    c.explicit_archive_copy_reapproval = false;
    ledger.release_candidates.push(c);
  }
  const r = auditRelease(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.equal(r.errors.length, 3);
  assert.ok(r.errors.every(x => x.includes('explicit_archive_copy_reapproval')));
});
test('duplicate and unknown IDs fail', () => {
  const {manifest, ledger} = fixtures();
  ledger.release_candidates.push(valid(manifest.sources[0]), valid(manifest.sources[0]));
  ledger.release_candidates.push({...valid(manifest.sources[0]), recipe_id:'unknown'});
  const r = auditRelease(manifest, ledger);
  assert.equal(r.errors.length, 2);
  assert.match(r.errors.join(' '), /duplicate/);
  assert.match(r.errors.join(' '), /unknown/);
});
test('license and URL must match source manifest', () => {
  const {manifest, ledger} = fixtures();
  const c = valid(manifest.sources[0]);
  c.verified_license = 'CC0';
  c.verified_license_url = 'https://creativecommons.org/licenses/by/4.0';
  ledger.release_candidates.push(c);
  const r = auditRelease(manifest, ledger);
  assert.match(r.errors[0], /verified_license/);
  assert.match(r.errors[0], /license URL mismatch/);
});

test('visual rejection of exact archive bytes blocks release even with completed ledger', () => {
  const {manifest, ledger} = fixtures();
  const c = valid(manifest.sources[0]);
  ledger.release_candidates.push(c);
  const triage = {records:[{recipe_id:c.recipe_id,image_sha256:c.reviewed_image_sha256,visual_status:'reject_for_recipe'}]};
  const r = auditRelease(manifest, ledger, triage);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.match(r.errors[0], /visual_triage_rejected_archive_copy/);
});
