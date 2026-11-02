import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const root = 'photo-library/alice-ai-art';
const audit = read('photo-library/ai-art-rights-provenance-review-20261102.json');
const recipes = read('photo-library/recipes.json').recipes;
const filenames = readdirSync(root + '/records').filter(name => name.endsWith('.json')).sort();
const generator = readFileSync('photo-pipeline/generate_yandexart.py', 'utf8');

test('AI Studio provenance is documented, but no individual commercial rights are invented', () => {
  assert.equal(audit.source_commit, 'a1c30f0be8745b8996577da7e7a4a3c2b3f2f028');
  assert.equal(audit.provider_service, 'Yandex Cloud AI Studio Image Generation API');
  assert.equal(audit.model, 'aliceai-image-art-3.0');
  assert.equal(audit.api_url, 'https://ai.api.cloud.yandex.net/v1/images/generations');
  assert.match(generator, /API_URL = "https:\/\/ai\.api\.cloud\.yandex\.net\/v1\/images\/generations"/);
  assert.match(generator, /MODEL = "aliceai-image-art-3\.0"/);
  assert.equal(audit.provider_general_policy_status, 'commercial_use_permitted_subject_to_applicable_law');
  assert.ok(audit.provider_faq_url.startsWith('https://aistudio.yandex.ru/'));
  assert.equal(audit.provider_specific_contract_checked, false);
  assert.equal(audit.individual_rights_verified, 0);
  assert.equal(audit.owner_publication_approvals, 0);
  assert.equal(audit.publication_allowed, false);
  assert.equal(audit.review_scope, 'metadata_and_official_general_faq_only');
  assert.ok(audit.remaining_legal_steps.length >= 3);
});

test('1001 physical AI image records have traceable model, prompt, date and blocked release', () => {
  assert.equal(recipes.length, 1001);
  assert.equal(filenames.length, 1001);
  assert.equal(audit.expected_record_count, 1001);
  const paths = new Set();
  for (let i = 0; i < filenames.length; i++) {
    const m = read(root + '/records/' + filenames[i]);
    const recipe = recipes[i];
    assert.equal(m.n, i + 1, filenames[i]);
    assert.equal(m.recipe_id, recipe.id, filenames[i]);
    assert.equal(m.title, recipe.title, filenames[i]);
    assert.equal(m.model, audit.model, filenames[i]);
    assert.ok(m.prompt.includes('ТОЧНОЕ блюдо: ' + recipe.title), filenames[i]);
    assert.ok(Number.isFinite(Date.parse(m.generated_at)), filenames[i]);
    assert.match(m.sha256, /^[a-f0-9]{64}$/, filenames[i]);
    assert.equal(m.path, root + '/photos/' + filenames[i].replace(/\.json$/, '.webp'));
    assert.ok(!paths.has(m.path), 'duplicate photo path ' + m.path);
    paths.add(m.path);
    assert.equal(m.status, 'generated_unpublished', filenames[i]);
    assert.equal(m.approved_for_publication, false, filenames[i]);
  }
});

test('all 15 existing visual reviews remain unapproved and legally uncleared', () => {
  const sources = [
    'review/ai-art-first-five-visual-triage-20261102.json',
    'review/ai-art-six-to-ten-visual-triage-20261102.json',
    'review/ai-art-eleven-to-fifteen-visual-triage-20261102.json'
  ];
  const records = sources.flatMap(path => read(path).records);
  assert.deepEqual(records.map(x => x.number).sort((a,b) => a-b),
    Array.from({length: 15}, (_, i) => i + 1));
  assert.equal(audit.visual_reviews_so_far, 15);
  for (const entry of records) {
    assert.equal(entry.license_and_rights_status, 'not_verified');
    assert.equal(entry.owner_approved, false);
    assert.equal(entry.published, false);
    assert.match(entry.photo_git_blob_sha, /^[a-f0-9]{40}$/);
  }
});
