import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const review = read('review/ai-art-six-to-ten-visual-triage-20261102.json');
const firstFive = read('review/ai-art-first-five-visual-triage-20261102.json');
const recipes = read('photo-library/recipes.json').recipes;
const pinnedBlobs = new Map([
 [6,'3f81081c840ef0aa42cb48c0181aab1b0cd47c34'],
 [7,'f64c6458d4657c97755710931726c5df1f06b790'],
 [8,'2d15db7385aec85e17cf13329863239d26e41da3'],
 [9,'80a5c290e5e12163a757e746e4c6bbe8d17b86a7'],
 [10,'367bd80873ecb2d261af0d35936f225d086ad04a']
]);
test('Actual WebP 6-10 visual triage is tied to immutable source and exact recipes', () => {
 assert.equal(review.source_commit,firstFive.source_commit);
 assert.deepEqual(review.records.map(x=>x.number),[6,7,8,9,10]);
 assert.equal(review.visually_checked,5);
 assert.equal(review.sample_size,5);
 assert.equal(new Set([...firstFive.records,...review.records].map(x=>x.number)).size,10);
 assert.equal(review.approved_for_publication,0);
 for(const entry of review.records){
  const recipe=recipes[entry.number-1];
  assert.equal(recipe.n,entry.number);
  assert.equal(recipe.id,entry.recipe_id);
  assert.equal(recipe.title,entry.recipe_title);
  const prefix=String(entry.number).padStart(4,'0')+'-'+entry.recipe_id;
  const meta=read('photo-library/alice-ai-art/records/'+prefix+'.json');
  assert.equal(meta.path,entry.photo_path);
  assert.equal(meta.sha256,entry.metadata_sha256);
  assert.equal(entry.photo_git_blob_sha,pinnedBlobs.get(entry.number));
  assert.match(entry.metadata_git_blob_sha,/^[a-f0-9]{40}$/);
  assert.ok(existsSync(entry.photo_path),'missing physical photo');
  assert.equal(meta.status,'generated_unpublished');
  assert.equal(meta.approved_for_publication,false);
  assert.equal(entry.owner_approved,false);
  assert.equal(entry.published,false);
  assert.equal(entry.license_and_rights_status,'not_verified');
  assert.ok(entry.observed_visual_evidence.length>80);
 }
});
test('Editorial decisions 6-10 are fail-closed and tally correctly',()=>{
 const counts={candidate_visual_match_unapproved:1,needs_culinary_review:2,reject_ingredient_mismatch:1,reject_wrong_dish_type:1};
 for(const [status,n] of Object.entries(counts))assert.equal(review.records.filter(x=>x.visual_status===status).length,n);
 assert.equal(review.candidate_unapproved,1);
 assert.equal(review.needs_culinary_review,2);
 assert.equal(review.rejected,2);
 assert.equal(review.records.find(x=>x.number===8).visual_status,'reject_ingredient_mismatch');
 assert.equal(review.records.find(x=>x.number===9).visual_status,'reject_wrong_dish_type');
});
