import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => JSON.parse(readFileSync(p,'utf8'));
const review = read('review/ai-art-first-five-visual-triage-20261102.json');
const recipes = read('photo-library/recipes.json').recipes;
test('First five visual reviews match distinct generated recipe metadata and remain unpublished', () => {
 assert.deepEqual(review.records.map(x=>x.number),[1,2,3,4,5]);
 assert.equal(review.visually_checked,5);
 assert.equal(new Set(review.records.map(x=>x.recipe_id)).size,5);
 assert.equal(review.approved_for_publication,0);
 for(const x of review.records){
  const recipe=recipes.find(r=>r.n===x.number);
  assert.ok(recipe);
  assert.equal(recipe.id,x.recipe_id);
  assert.equal(recipe.title,x.recipe_title);
  const ident=String(x.number).padStart(4,'0')+'-'+x.recipe_id;
  const meta=read('photo-library/alice-ai-art/records/'+ident+'.json');
  assert.equal(meta.path,x.photo_path);
  assert.equal(meta.sha256,x.metadata_sha256);
  assert.equal(meta.status,'generated_unpublished');
  assert.equal(meta.approved_for_publication,false);
  assert.match(x.photo_git_blob_sha,/^[0-9a-f]{40}$/);
  assert.equal(x.owner_approved,false);
  assert.equal(x.published,false);
  assert.equal(x.license_and_rights_status,'not_verified');
 }
});
test('Cooked salmon recipe image is explicitly rejected pending replacement',()=>{
 const salmon=review.records.find(x=>x.number===5);
 assert.equal(salmon.recipe_id,'salmon-lemon');
 assert.equal(salmon.visual_status,'reject_cooked_recipe_mismatch');
 assert.equal(review.rejected,1);
 assert.equal(review.candidate_unapproved,2);
 assert.equal(review.needs_culinary_review,2);
});
