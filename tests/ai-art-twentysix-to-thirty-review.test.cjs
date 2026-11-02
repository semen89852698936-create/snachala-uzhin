'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const review = read('review/ai-art-twentysix-to-thirty-visual-triage-20261103.json');
const briefs = read('photo-library/ai-art-replacement-briefs-26-30-20261103.json');
const map = read('photo-library/ai-recipe-photo-map.json');
const release = read('photo-library/meat-14-site-release-20261103.json');
const csv = fs.readFileSync(path.join(root, 'photo-library/recipe-photo-registry.csv'), 'utf8');
const allowed = new Set(['candidate_visual_match_unapproved','needs_culinary_review','rejected_visual_mismatch']);
test('five current physical WebP reviews are mapped to correct titles and Git blobs', () => {
  assert.equal(map.total, 1001);
  assert.equal(map.photos.length, 1001);
  assert.deepEqual(review.review_range,[26,30]);
  assert.equal(review.sample_size,5);
  assert.equal(review.visually_checked,5);
  assert.equal(review.records.length,5);
  assert.deepEqual(review.records.map(r=>r.number),[26,27,28,29,30]);
  assert.match(review.source_commit,/^[a-f0-9]{40}$/);
  assert.equal(review.approved_for_publication,0);
  assert.equal(review.production_delivery_verified,false);
  for(const r of review.records){
    const p=map.photos[r.number-1];
    assert.equal(p.n,r.number);
    assert.equal(p.recipe_id,r.recipe_id);
    assert.equal(p.path,'/'+r.photo_path);
    assert.equal(p.sha,r.photo_git_blob_sha);
    assert.match(r.photo_git_blob_sha,/^[a-f0-9]{40}$/);
    assert.ok(fs.existsSync(path.join(root,r.photo_path)), 'Physical WebP absent: '+r.number);
    const line=csv.split(/\r?\n/).find(x=>x.startsWith(r.number+','+r.recipe_id+','));
    assert.ok(line,'Recipe row absent: '+r.number);
    assert.equal(line.split(',')[2],r.recipe_title);
    assert.ok(allowed.has(r.visual_status));
    assert.ok(r.observed_visual_evidence.length>110);
    assert.ok(r.visual_limitations.length>90);
    assert.equal(r.rights_status,'not_verified');
    assert.equal(r.owner_approved,false);
    assert.equal(r.publication_authorization_from_this_review,false);
    assert.equal(r.recipe_catalog_blob_sha,review.source_recipe_catalog_blob_sha);
  }
});
test('editorial decisions have corresponding replacement briefs but no release authorization',()=>{
  const count=s=>review.records.filter(r=>r.visual_status===s).length;
  assert.equal(review.candidate_unapproved,count('candidate_visual_match_unapproved'));
  assert.equal(review.needs_culinary_review,count('needs_culinary_review'));
  assert.equal(review.rejected,count('rejected_visual_mismatch'));
  assert.equal(review.candidate_unapproved+review.needs_culinary_review+review.rejected,5);
  assert.deepEqual(briefs.items.map(x=>x.number),review.records.filter(x=>x.visual_status==='rejected_visual_mismatch').map(x=>x.number));
  assert.equal(briefs.publication_allowed,false);
  assert.equal(briefs.cost_approval_required,true);
  for(const b of briefs.items){
    const r=review.records.find(x=>x.number===b.number);
    assert.equal(b.recipe_id,r.recipe_id);
    assert.equal(b.rejected_photo_blob_sha,r.photo_git_blob_sha);
    assert.ok(b.must_show.length>=3&&b.must_avoid.length>=3);
    assert.equal(b.rights_status,'unverified');
    assert.equal(b.status,'brief_only_no_physical_replacement');
  }
});
test('review uses exact current regenerated meat assets, preserving original #29',()=>{
  const rel=new Map(release.photos.map(x=>[x.number,x]));
  for(const r of review.records.filter(x=>x.number!==29)){
    const p=rel.get(r.number);
    assert.ok(p,'Regenerated release missing '+r.number);
    assert.equal('/'+r.photo_path,p.new_path);
    assert.equal(r.photo_git_blob_sha,p.new_blob_sha);
    assert.ok(fs.existsSync(path.join(root,p.original_path.slice(1))));
  }
  assert.equal(rel.has(29),false);
  assert.equal(review.records.find(x=>x.number===29).photo_path,'assets/recipes-ai/0029-collection-meat-02-01.webp');
});
