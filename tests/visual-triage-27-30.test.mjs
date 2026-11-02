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
test('New reviews remain distinct from canonical release ledger',()=>{
 assert.equal(a.base_canonical_reviewed,c.reviewed_images);
 assert.equal(a.combined_unique_reviewed,c.reviewed_images+a.records.length);
 assert.equal(a.combined_rejected,c.clear_mismatch_count+a.addendum_rejected);
 assert.equal(a.combined_unreviewed,m.photo_files-a.combined_unique_reviewed);
 assert.equal(a.license_verified_count,0);
 assert.ok(a.records.every(x=>!c.records.some(y=>y.number===x.number)));
});
