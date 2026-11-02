import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRelease, collectExistingEvidenceFiles } from '../scripts/photo-release-gate.mjs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function auditWithEvidence(manifest, ledger, triage = {records: []}, evidenceFiles = new Set(['review/evidence/001.png'])) {
  return auditRelease(manifest, ledger, triage, evidenceFiles);
}

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
    license_evidence_url: source.license_url,
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
  const r = auditWithEvidence(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.equal(r.blocked_from_release, 100);
  assert.deepEqual(r.errors, []);
});
test('explicit evidence can clear one candidate, not other 99', () => {
  const {manifest, ledger} = fixtures();
  ledger.release_candidates.push(valid(manifest.sources[0]));
  const r = auditWithEvidence(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 1);
  assert.equal(r.blocked_from_release, 99);
});
test('stale SHA and missing visual evidence block release', () => {
  const {manifest, ledger} = fixtures();
  const c = valid(manifest.sources[0]);
  c.reviewed_image_sha256 = '0'.repeat(64);
  delete c.visual_evidence_ref;
  ledger.release_candidates.push(c);
  const r = auditWithEvidence(manifest, ledger);
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
  const r = auditWithEvidence(manifest, ledger);
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
  const r = auditWithEvidence(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.equal(r.errors.length, 3);
  assert.ok(r.errors.every(x => x.includes('explicit_archive_copy_reapproval')));
});
test('duplicate and unknown IDs fail', () => {
  const {manifest, ledger} = fixtures();
  ledger.release_candidates.push(valid(manifest.sources[0]), valid(manifest.sources[0]));
  ledger.release_candidates.push({...valid(manifest.sources[0]), recipe_id:'unknown'});
  const r = auditWithEvidence(manifest, ledger);
  assert.equal(r.errors.length, 3); // First record also fails: evidence was reused.
  assert.match(r.errors.join(' '), /visual_evidence_ref reused/);
  assert.match(r.errors.join(' '), /duplicate/);
  assert.match(r.errors.join(' '), /unknown/);
});
test('license and URL must match source manifest', () => {
  const {manifest, ledger} = fixtures();
  const c = valid(manifest.sources[0]);
  c.verified_license = 'CC0';
  c.verified_license_url = 'https://creativecommons.org/licenses/by/4.0';
  ledger.release_candidates.push(c);
  const r = auditWithEvidence(manifest, ledger);
  assert.match(r.errors[0], /verified_license/);
  assert.match(r.errors[0], /license URL mismatch/);
});

test('visual rejection of exact archive bytes blocks release even with completed ledger', () => {
  const {manifest, ledger} = fixtures();
  const c = valid(manifest.sources[0]);
  ledger.release_candidates.push(c);
  const triage = {records:[{recipe_id:c.recipe_id,image_sha256:c.reviewed_image_sha256,visual_status:'reject_for_recipe'}]};
  const r = auditWithEvidence(manifest, ledger, triage);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.match(r.errors[0], /visual_triage_rejected_archive_copy/);
});


test('image source page alone is not proof of license terms', () => {
  const {manifest, ledger} = fixtures();
  const c = valid(manifest.sources[0]);
  c.license_evidence_url = manifest.sources[0].source_page;
  ledger.release_candidates.push(c);
  const r = auditWithEvidence(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.match(r.errors[0], /independent license terms/);
});

test('unrecognized license is blocked even with completed reviewer fields', () => {
  const {manifest, ledger} = fixtures();
  manifest.sources[1].license = 'Custom License - terms unknown';
  const c = valid(manifest.sources[1]);
  ledger.release_candidates.push(c);
  const r = auditWithEvidence(manifest, ledger);
  assert.equal(r.cleared_for_editorial_release, 0);
  assert.match(r.errors[0], /unrecognized_archive_license/);
});

test('duplicate image numbers and hashes invalidate archive identity', () => {
  const {manifest, ledger} = fixtures();
  manifest.sources[1].number = manifest.sources[0].number;
  assert.throws(() => auditWithEvidence(manifest, ledger), /Duplicate image numbers/);
  manifest.sources[1].number = 2;
  manifest.sources[1].sha256 = manifest.sources[0].sha256;
  assert.throws(() => auditWithEvidence(manifest, ledger), /Duplicate image SHA-256/);
});


test('visual evidence must be a local, existing image with matching file signature', async () => {
  const {manifest, ledger} = fixtures();
  const candidate = valid(manifest.sources[0]);
  ledger.release_candidates.push(candidate);
  const root = await mkdtemp(join(tmpdir(), 'photo-release-evidence-'));
  try {
    const empty = await collectExistingEvidenceFiles(ledger.release_candidates, root);
    assert.equal(empty.size, 0);
    assert.match(auditRelease(manifest, ledger, {records: []}, empty).errors[0], /visual_evidence_file_missing_or_empty/);
    await mkdir(join(root, 'review/evidence'), {recursive: true});
    const image = join(root, candidate.visual_evidence_ref);
    await writeFile(image, 'this is not a real PNG image');
    const spoof = await collectExistingEvidenceFiles(ledger.release_candidates, root);
    assert.equal(spoof.size, 0, 'a renamed text file is not image evidence');
    const pngHeader = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13]);
    await writeFile(image, pngHeader);
    assert.equal((await collectExistingEvidenceFiles(ledger.release_candidates, root)).size, 0,
      'a PNG signature without pixel data must never count as evidence');
    // A genuine tiny PNG fixture, not merely a forged file extension or header.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=', 'base64');
    await writeFile(image, png);
    const available = await collectExistingEvidenceFiles(ledger.release_candidates, root);
    assert.ok(available.has(candidate.visual_evidence_ref));
    assert.equal(auditRelease(manifest, ledger, {records: []}, available).cleared_for_editorial_release, 1);
    candidate.visual_evidence_ref = '../outside.png';
    assert.match(auditRelease(manifest, ledger, {records: []}, available).errors[0], /local review\/evidence image/);
    candidate.visual_evidence_ref = 'https://example.org/screenshot.png';
    assert.match(auditRelease(manifest, ledger, {records: []}, available).errors[0], /local review\/evidence image/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});


test('license terms must come from the official licensor, not an unrelated HTTPS page', () => {
  const {manifest, ledger} = fixtures();
  const candidate = valid(manifest.sources[0]);
  candidate.license_evidence_url = 'https://example.org/license/by-sa/4.0';
  ledger.release_candidates.push(candidate);
  const result = auditWithEvidence(manifest, ledger);
  assert.equal(result.cleared_for_editorial_release, 0);
  assert.match(result.errors[0], /official license terms page/);
});

test('the same visual evidence image cannot clear two distinct recipe photos', () => {
  const {manifest, ledger} = fixtures();
  ledger.release_candidates.push(valid(manifest.sources[0]), valid(manifest.sources[1]));
  const result = auditWithEvidence(manifest, ledger);
  assert.equal(result.cleared_for_editorial_release, 0);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every(error => error.includes('visual_evidence_ref reused')));
});

test('license terms URLs cannot disguise unrelated paths or domains', () => {
  const {manifest, ledger} = fixtures();
  const candidate = valid(manifest.sources[0]);
  candidate.license_evidence_url = 'https://creativecommons.org/licenses/by-sa/4.0-fake';
  ledger.release_candidates.push(candidate);
  assert.match(auditWithEvidence(manifest, ledger).errors[0], /official license terms page/);
  candidate.license_evidence_url = 'https://creativecommons.org.evil.test/licenses/by-sa/4.0';
  assert.match(auditWithEvidence(manifest, ledger).errors[0], /official license terms page/);
});

test('truncated or inconsistent image structures are not accepted as editorial evidence', async () => {
  const {manifest, ledger} = fixtures();
  const candidate = valid(manifest.sources[0]);
  ledger.release_candidates.push(candidate);
  const root = await mkdtemp(join(tmpdir(), 'photo-evidence-structure-'));
  try {
    await mkdir(join(root, 'review/evidence'), {recursive: true});
    const path = join(root, 'review/evidence/001.png');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=', 'base64');
    await writeFile(path, png.subarray(0, 33));
    assert.equal((await collectExistingEvidenceFiles(ledger.release_candidates, root)).size, 0);
    candidate.visual_evidence_ref = 'review/evidence/001.jpg';
    const jpeg = Buffer.alloc(256);
    jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[254] = 0xff; jpeg[255] = 0xd9;
    await writeFile(join(root, candidate.visual_evidence_ref), jpeg);
    assert.equal((await collectExistingEvidenceFiles(ledger.release_candidates, root)).size, 0,
      'JPEG with SOI and EOI but no scan/frame cannot pass');
    candidate.visual_evidence_ref = 'review/evidence/001.webp';
    const webp = Buffer.alloc(64);
    webp.write('RIFF', 0); webp.writeUInt32LE(10, 4); webp.write('WEBP', 8);
    await writeFile(join(root, candidate.visual_evidence_ref), webp);
    assert.equal((await collectExistingEvidenceFiles(ledger.release_candidates, root)).size, 0,
      'RIFF length must match the actual file');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('real JPEG and WebP evidence fixtures pass structural preflight', async () => {
  const {manifest, ledger} = fixtures();
  const candidate = valid(manifest.sources[0]);
  ledger.release_candidates.push(candidate);
  const root = await mkdtemp(join(tmpdir(), 'photo-evidence-positive-'));
  try {
    await mkdir(join(root, 'review/evidence'), {recursive: true});
    candidate.visual_evidence_ref = 'review/evidence/001.jpg';
    await writeFile(join(root, candidate.visual_evidence_ref), Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3E//Z', 'base64'));
    assert.ok((await collectExistingEvidenceFiles(ledger.release_candidates, root)).has(candidate.visual_evidence_ref));
    candidate.visual_evidence_ref = 'review/evidence/001.webp';
    await writeFile(join(root, candidate.visual_evidence_ref), Buffer.from('UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAIAAgA0JaACdLoB+AADsAD+8MQL/yC5YXXI1/8gP+QH/ID/+PIAAAA=', 'base64'));
    assert.ok((await collectExistingEvidenceFiles(ledger.release_candidates, root)).has(candidate.visual_evidence_ref));
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});


test('all records sharing a recipe ID are blocked even with distinct valid evidence', () => {
  const {manifest, ledger} = fixtures();
  const first = valid(manifest.sources[0]);
  const second = {...valid(manifest.sources[0]), visual_evidence_ref: 'review/evidence/002.png'};
  ledger.release_candidates.push(first, second);
  const result = auditWithEvidence(manifest, ledger, {records: []},
    new Set(['review/evidence/001.png', 'review/evidence/002.png']));
  assert.equal(result.cleared_for_editorial_release, 0,
    'the first of two duplicate approvals must not be counted as cleared');
  assert.equal(result.blocked_from_release, 100);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every(error => error.includes('duplicate release candidate')));
});
