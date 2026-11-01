import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, validateRegistry } from '../validate-registry.mjs';

const csv = 'n,id,title,category,status,image_path,review_status\n' +
  '"1","a","Рататуй","vegetables","pending","","candidate_screened_no_approval"\n' +
  '"2","b","Фокачча","pastry","pending","",""\n';
const summary = {
  total:2,pending:2,approved:0,real_image_files_created:0,review_needed:1,
  recipes_screened:1,visually_reviewed_candidates:1,source_license_metadata_checked:1,
  legal_approved_candidates:0
};
const curated = {candidates:[{
  candidate_id:'one',recipe_id:'a',source_page:'https://commons.wikimedia.org/wiki/File:Example.jpg',
  author:'Example',license:'CC BY 2.0',license_url:'https://creativecommons.org/licenses/by/2.0/',
  source_license_statement_checked:true,visual_reviewed_at:'2026-11-01',legal_approval:false,
  final_approval:false,image_file_path:null
}]};

test('parses quoted CSV and keeps 7 columns', () => {
  assert.equal(parseCsv(csv).length,3);
  assert.equal(parseCsv(csv)[1][2],'Рататуй');
});
test('candidate URL does not count as an image file', () => {
  const result = validateRegistry(csv,summary,curated,()=>false);
  assert.equal(result.ok,true,JSON.stringify(result.errors));
  assert.equal(result.metrics.real_image_files,0);
  assert.equal(result.metrics.approved,0);
});
test('rejects approval without a real local file', () => {
  const bad = csv.replace('"pending","","candidate_screened_no_approval"','"approved","https://example.org/photo.jpg","approved"');
  const result = validateRegistry(bad,{...summary,pending:1,approved:1,review_needed:0,recipes_screened:0},curated,()=>false);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(x=>x.includes('Approved without reviewed local image')));
});
test('rejects duplicate candidate identifiers', () => {
  const result = validateRegistry(csv,{...summary,visually_reviewed_candidates:2,source_license_metadata_checked:2},
    {candidates:[curated.candidates[0],curated.candidates[0]]},()=>false);
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(x=>x.includes('Duplicate candidate ID')));
});
