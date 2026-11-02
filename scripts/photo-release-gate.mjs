#!/usr/bin/env node
/** Editorial and rights release preflight. No image download or hash computation. */
import { open, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const isUrl = (s) => typeof s === 'string' && /^https:\/\/[^\s]+$/.test(s);
const hasText = (s) => typeof s === 'string' && s.trim().length >= 3;
// Evidence is a local, review-only image, never an external URL or path traversal.
const isEvidenceRef = (s) => typeof s === 'string' && /^review\/evidence\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.(?:png|jpe?g|webp)$/i.test(s);

export async function collectExistingEvidenceFiles(records, root = '.') {
  const existing = new Set();
  for (const record of records) {
    const ref = record?.visual_evidence_ref;
    if (!isEvidenceRef(ref)) continue;
    try {
      const info = await stat(join(root, ref));
      if (!info.isFile() || info.size < 12) continue;
      const handle = await open(join(root, ref), 'r');
      try {
        const header = Buffer.alloc(12);
        const {bytesRead} = await handle.read(header, 0, 12, 0);
        const png = ref.toLowerCase().endsWith('.png') && header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpeg = /\.jpe?g$/i.test(ref) && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
        const webp = /\.webp$/i.test(ref) && header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
        if (bytesRead === 12 && (png || jpeg || webp)) existing.add(ref);
      } finally { await handle.close(); }
    } catch { /* A missing or unreadable file is never evidence. */ }
  }
  return existing;
}
// A different URL is not automatically a license: only official terms pages count
// as terms evidence. This still does NOT prove rights to the individual photo.
function isOfficialLicenseTermsUrl(value, license) {
  if (!isUrl(value)) return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  if (license === 'Unsplash License') return host === 'unsplash.com' && path === '/license';
  if (license === 'Pexels License') return host === 'pexels.com' && path === '/license';
  if (license === 'CC0') return host === 'creativecommons.org' &&
    (path === '/publicdomain/zero/1.0' || path.startsWith('/publicdomain/zero/1.0/'));
  const match = /^CC (BY(?:-SA)?) (\d\.\d)$/.exec(license ?? '');
  if (!match || host !== 'creativecommons.org') return false;
  const prefix = '/licenses/' + match[1].toLowerCase() + '/' + match[2];
  return path === prefix || path.startsWith(prefix + '/');
}

const KNOWN_LICENSES = new Set(['Unsplash License', 'Pexels License', 'CC0', 'CC BY 2.0', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 2.0', 'CC BY-SA 4.0']);

export function auditRelease(manifest, ledger, triage = {records: []}, evidenceFiles = new Set()) {
  const sources = manifest?.sources;
  if (!Array.isArray(sources) || sources.length !== 100) throw new Error('Expected 100 source records');
  if (ledger?.schema_version !== 1 || !Array.isArray(ledger?.release_candidates))
    throw new Error('Invalid release ledger schema');
  const byId = new Map(sources.map((x) => [x.recipe_id, x]));
  if (byId.size !== 100) throw new Error('Duplicate recipe IDs in manifest');
  if (new Set(sources.map(x => x.number)).size !== 100) throw new Error('Duplicate image numbers in manifest');
  if (new Set(sources.map(x => x.sha256)).size !== 100) throw new Error('Duplicate image SHA-256 in manifest');
  const rejected = new Set((triage.records || []).filter(x => x.visual_status === 'reject_for_recipe').map(x => x.recipe_id + ':' + x.image_sha256));
  const seen = new Set();
  // A screenshot of one dish cannot serve as proof for multiple distinct files.
  const evidenceUsage = new Map();
  for (const candidate of ledger.release_candidates) {
    const ref = candidate?.visual_evidence_ref;
    if (isEvidenceRef(ref)) evidenceUsage.set(ref, (evidenceUsage.get(ref) ?? 0) + 1);
  }
  const errors = [];
  const cleared = [];
  for (const record of ledger.release_candidates) {
    const id = record?.recipe_id;
    if (!hasText(id)) { errors.push('Missing recipe_id in release candidate'); continue; }
    if (seen.has(id)) { errors.push(id + ': duplicate release candidate'); continue; }
    seen.add(id);
    const item = byId.get(id);
    if (!item) { errors.push(id + ': unknown recipe_id'); continue; }
    const missing = [];
    if (rejected.has(id + ':' + item.sha256)) missing.push('visual_triage_rejected_archive_copy');
    if (record.reviewed_image_sha256 !== item.sha256) missing.push('reviewed_image_sha256 does not match archive');
    if (record.reviewed_source_page !== item.source_page) missing.push('reviewed_source_page does not match manifest');
    if (record.visual_match_confirmed !== true) missing.push('visual_match_confirmed');
    if (!isEvidenceRef(record.visual_evidence_ref)) missing.push('visual_evidence_ref must be a local review/evidence image');
    else if (!evidenceFiles.has(record.visual_evidence_ref)) missing.push('visual_evidence_file_missing_or_empty');
    if (isEvidenceRef(record.visual_evidence_ref) && evidenceUsage.get(record.visual_evidence_ref) > 1)
      missing.push('visual_evidence_ref reused across distinct candidates');
    if (!hasText(record.ingredient_review_notes)) missing.push('ingredient_review_notes');
    if (!hasText(record.reviewer)) missing.push('reviewer');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.reviewed_date ?? '')) missing.push('reviewed_date');
    if (record.license_terms_reviewed !== true) missing.push('license_terms_reviewed');
    if (!KNOWN_LICENSES.has(item.license)) missing.push('unrecognized_archive_license');
    if (!isUrl(record.license_evidence_url)) missing.push('license_evidence_url');
    else if (record.license_evidence_url === item.source_page) missing.push('license_evidence_url must link to independent license terms, not just the image source page');
    else if (!isOfficialLicenseTermsUrl(record.license_evidence_url, item.license))
      missing.push('license_evidence_url must be an official license terms page');
    if (record.verified_license !== item.license) missing.push('verified_license does not match manifest');
    if (record.modifications_disclosed !== true) missing.push('modifications_disclosed');
    if (/^CC BY/.test(item.license ?? '')) {
      if (record.author_verified !== true) missing.push('author_verified');
      if (!hasText(record.attribution_text)) missing.push('attribution_text');
      if (!isUrl(record.verified_license_url)) missing.push('verified_license_url');
      if (record.verified_license_url !== item.license_url) missing.push('license URL mismatch');
    }
    if (/^CC BY-SA/.test(item.license ?? '') && record.share_alike_obligations_reviewed !== true)
      missing.push('share_alike_obligations_reviewed');
    // Production-approved copies #6, #10 and #20 have DIFFERENT bytes.
    if ([6, 10, 20].includes(item.number) && record.explicit_archive_copy_reapproval !== true)
      missing.push('explicit_archive_copy_reapproval');
    if (missing.length) errors.push(id + ': ' + missing.join(', '));
    else cleared.push(id);
  }
  return {
    archive_total: sources.length,
    release_candidates: ledger.release_candidates.length,
    cleared_for_editorial_release: cleared.length,
    blocked_from_release: sources.length - cleared.length,
    cleared_recipe_ids: cleared,
    errors,
    note: 'Evidence ledger preflight only. Human visual/legal review and owner publication approval remain separate.'
  };
}

async function main() {
  const manifest = JSON.parse(await readFile('photo-library/batch-100-20261101/manifest.json', 'utf8'));
  const ledger = JSON.parse(await readFile('review/photo-release-decisions.json', 'utf8'));
  const triage = JSON.parse(await readFile('review/visual-triage-20261102.json', 'utf8'));
  const evidenceFiles = await collectExistingEvidenceFiles(ledger.release_candidates);
  const result = auditRelease(manifest, ledger, triage, evidenceFiles);
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length || (process.argv.includes('--require-ready') && result.blocked_from_release > 0))
    process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  await main();
