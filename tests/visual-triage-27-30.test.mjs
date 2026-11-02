import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => JSON.parse(readFileSync(p,'utf8'));
const a=read('review/visual-triage-addendum-20261102-1140.json'),m=read('photo-library/batch-100-20261101/manifest.json'),c=read('review/visual-triage-20261102.json');
test('Four unique directly inspected WebP records match the immutable archive',()=>{
 assert.deepEqual(a.records.map(x=>x.number),[27,28,29,30]);
 assert.equal(a.source_manifest_blob_sha,c.archive_manifest_blob_sha);
 assert.equal(a.source_commit,c.archive_commit_sha);
 assert.equal(a.addendum_reviewed,a.records.length);
 assert.equal(a.addendum_rejected,a.records.filter(x=>x.visual_status==='reject_for_recipe').length);
 assert.equal(a.addendum_partial,a.records.filter(x=>x.visual_status==='partial_match_needs_recipe_review').length);
 for(const x of a.records){const y=m.sources.find(z=>z.number===x.number);assert.ok(y);assert.equal(x.recipe_id,y.recipe_id);assert.equal(x.recipe_title,y.title);assert.equal(x.archive_path,'photo-library/batch-100-20261101/'+y.file);assert.equal(x.image_sha256,y.sha256);assert.equal(x.source_page,y.source_page);assert.match(x.git_blob_sha,/^[0-9a-f]{40}$/);assert.equal(x.source_license_status,'not_verified');assert.equal(x.archive_file_provenance_verified,false);assert.equal(x.publication_approved,false);}
});
test('New reviews are integrated exactly once with no release approval',()=>{
 assert.equal(a.base_canonical_reviewed+a.addendum_reviewed,c.reviewed_images);
 assert.equal(a.combined_unique_reviewed,c.reviewed_images);
 assert.equal(a.combined_rejected,c.clear_mismatch_count);
 assert.equal(a.combined_unreviewed,m.photo_files-c.reviewed_images);
 assert.equal(c.reviewed_images,29);
 assert.equal(c.clear_mismatch_count,25);
 assert.equal(c.partial_match_count,3);
 assert.equal(c.possible_match_count,1);
 assert.equal(c.license_verified_count,0);
 assert.equal(new Set(c.records.map(x=>x.number)).size,c.records.length);
 const b=read('review/replacement-briefs-20261102.json');
 assert.equal(b.rejected_count,25);
 for(const x of a.records){
  const matches=c.records.filter(y=>y.number===x.number);
  assert.equal(matches.length,1,'Canonical '+x.number);
  assert.equal(matches[0].image_sha256,x.image_sha256);
  assert.equal(matches[0].git_blob_sha,x.git_blob_sha);
  assert.equal(matches[0].visual_status,x.visual_status);
  assert.equal(matches[0].observed_visual_evidence,x.observed_visual_evidence);
  assert.equal(matches[0].source_license_status,'not_verified');
  assert.equal(matches[0].archive_file_provenance_verified,false);
  assert.equal(matches[0].publication_approved,false);
  const briefs=b.briefs.filter(y=>y.number===x.number);
  assert.equal(briefs.length,x.visual_status==='reject_for_recipe'?1:0);
  if(briefs.length){assert.equal(briefs[0].rejected_archive_photo.sha256,x.image_sha256);assert.equal(briefs[0].replacement_status,'not_found');assert.equal(briefs[0].license_status,'not_verified');}
 }
});
