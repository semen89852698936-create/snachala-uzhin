import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseCsv(text) {
  const lines = text.trimEnd().split(/\r?\n/);
  return lines.map(line => {
    const fields = []; let field = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (c === ',' && !quoted) { fields.push(field); field = ''; }
      else field += c;
    }
    if (quoted) throw new Error('Unterminated CSV quote');
    fields.push(field);
    return fields;
  });
}

export function validateRegistry(csvText, summary, curated, fileExists = () => false) {
  const errors = [], rows = parseCsv(csvText);
  const expected = ['n','id','title','category','status','image_path','review_status'];
  if (JSON.stringify(rows[0]) !== JSON.stringify(expected)) errors.push('Unexpected CSV header');
  const records = rows.slice(1), ids = new Set(), candidateIds = new Set();
  let pending = 0, approved = 0, realFiles = 0, reviewNeeded = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.length !== expected.length) { errors.push('Invalid CSV width on row ' + (i + 2)); continue; }
    const [n,id,, ,status,imagePath,reviewStatus] = r;
    if (+n !== i + 1) errors.push('Unexpected sequence at row ' + (i + 2));
    if (!id || ids.has(id)) errors.push('Missing or duplicate recipe id: ' + id);
    ids.add(id);
    if (status === 'pending') pending++;
    if (reviewStatus === 'candidate_screened_no_approval') reviewNeeded++;
    const safeLocal = imagePath && imagePath.startsWith('photo-library/images/') && !imagePath.includes('..') && !imagePath.includes('://');
    const real = safeLocal && fileExists(imagePath);
    if (real) realFiles++;
    if (status === 'approved') {
      approved++;
      if (!real || reviewStatus !== 'approved') errors.push('Approved without reviewed local image: ' + id);
    } else if (status !== 'pending' && status !== 'generated') errors.push('Unknown status: ' + status);
    if (imagePath && !safeLocal) errors.push('Nonlocal or unsafe image path: ' + id);
  }
  const candidates = curated.candidates || [];
  for (const c of candidates) {
    if (!ids.has(c.recipe_id)) errors.push('Candidate references unknown recipe: ' + c.recipe_id);
    if (!c.candidate_id || candidateIds.has(c.candidate_id)) errors.push('Duplicate candidate ID');
    candidateIds.add(c.candidate_id);
    if (!c.source_page || !c.author || !c.license || !c.license_url) errors.push('Incomplete provenance: ' + c.candidate_id);
    if (c.final_approval && (!c.image_file_path || !fileExists(c.image_file_path))) errors.push('Candidate approved without file: ' + c.candidate_id);
  }
  const metrics = {
    total: records.length, pending, approved, real_image_files: realFiles,
    recipes_screened: reviewNeeded, candidates: candidates.length,
    visual_reviews: candidates.filter(c => !!c.visual_reviewed_at).length,
    source_license_metadata_checked: candidates.filter(c => c.source_license_statement_checked).length,
    legal_approved: candidates.filter(c => c.legal_approval === true).length
  };
  for (const [key,actual] of [
    ['total',metrics.total],['pending',pending],['approved',approved],
    ['real_image_files_created',realFiles],['review_needed',reviewNeeded],
    ['recipes_screened',reviewNeeded],['visually_reviewed_candidates',metrics.visual_reviews],
    ['source_license_metadata_checked',metrics.source_license_metadata_checked],
    ['legal_approved_candidates',metrics.legal_approved]
  ]) if (summary[key] !== actual) errors.push('Summary mismatch: ' + key + ' expected ' + actual + ', got ' + summary[key]);
  return { ok: errors.length === 0, errors, metrics };
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = path.join(root, 'photo-library');
  const csv = fs.readFileSync(path.join(dir, 'recipes-photo-registry.csv'), 'utf8');
  const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
  const curated = JSON.parse(fs.readFileSync(path.join(dir, 'curated-images.json'), 'utf8'));
  const result = validateRegistry(csv, summary, curated, p => fs.existsSync(path.join(root, p)));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
