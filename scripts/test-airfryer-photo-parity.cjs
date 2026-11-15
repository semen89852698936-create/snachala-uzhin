#!/usr/bin/env node
'use strict';
// Read-only integrity gate. A valid file is NOT an editorially approved photo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const errors = [];
const seen = new Set();
const recipes = [];
for (let batch = 1; batch <= 10; batch++) {
  const suffix = String(batch).padStart(2, '0');
  const filename = path.join(root, 'data', 'airfryer-recipes-batch-' + suffix + '.json');
  const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (!Array.isArray(data.recipes) || data.recipes.length !== 10) errors.push('batch ' + suffix + ': expected 10 recipes');
  for (const recipe of data.recipes || []) {
    if (typeof recipe.id !== 'string' || !/^af-[a-z0-9-]+$/.test(recipe.id) || seen.has(recipe.id)) {
      errors.push('invalid or duplicate recipe ID: ' + recipe.id);
      continue;
    }
    seen.add(recipe.id);
    recipes.push(recipe);
  }
}
const assetDir = path.join(root, 'assets', 'airfryer');
const recordDir = path.join(root, 'photo-library', 'airfryer', 'records');
const assets = fs.readdirSync(assetDir).filter(x => x.endsWith('.webp'));
const records = fs.readdirSync(recordDir).filter(x => x.endsWith('.json'));
const expected = new Set(recipes.map(x => x.id));
if (recipes.length !== 100) errors.push('expected 100 unique recipes, found ' + recipes.length);
const approvedEditorialImages = new Set(['airfryer-newspaper-approved-20261110.webp']);
for (const file of assets) if (!expected.has(file.slice(0, -5)) && !approvedEditorialImages.has(file)) errors.push('orphan WebP: ' + file);
for (const file of records) if (!expected.has(file.slice(0, -5))) errors.push('orphan record: ' + file);
for (const recipe of recipes) {
  const expectedPath = 'assets/airfryer/' + recipe.id + '.webp';
  if (recipe.photo_path !== expectedPath) errors.push('recipe photo_path mismatch: ' + recipe.id);
  if (recipe.publication_status !== 'not_published') errors.push('unexpected recipe publication status: ' + recipe.id);
  const webp = path.join(assetDir, recipe.id + '.webp');
  const recordFile = path.join(recordDir, recipe.id + '.json');
  if (!fs.existsSync(webp) || !fs.existsSync(recordFile)) {
    errors.push('missing WebP or record: ' + recipe.id);
    continue;
  }
  const record = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  const bytes = fs.readFileSync(webp);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (record.recipe_id !== recipe.id || record.path !== 'assets/airfryer/' + recipe.id + '.webp') errors.push('record identity/path mismatch: ' + recipe.id);
  if (record.sha256 !== digest || record.bytes !== bytes.length) errors.push('record hash/size mismatch: ' + recipe.id);
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') errors.push('invalid WebP header: ' + recipe.id);
  if (record.approved_for_publication !== false || record.status !== 'generated_unpublished') errors.push('unexpected publication approval/status: ' + recipe.id);
}
console.log('Airfryer photo parity: ' + recipes.length + ' recipes, ' + assets.length + ' WebP, ' + records.length + ' records');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('PASS: files, IDs, SHA-256, byte lengths, WebP headers and unpublished status. No visual approval implied.');
