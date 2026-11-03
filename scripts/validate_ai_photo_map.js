#!/usr/bin/env node
// Read-only structural validation. This is NOT a visual, culinary or licensing review.
const fs = require('node:fs');
const path = require('node:path');

function validatePhotoMap(map) {
  const errors = [];
  if (!map || !Array.isArray(map.photos)) return ['photos must be an array'];
  if (map.total !== 1001) errors.push('total must be 1001');
  if (map.photos.length !== 1001) errors.push('photos length must be 1001');
  const numbers = new Set(), ids = new Set(), paths = new Set();
  for (const photo of map.photos) {
    const n = photo.n;
    if (!Number.isInteger(n) || n < 1 || n > 1001) errors.push('invalid n: ' + n);
    if (numbers.has(n)) errors.push('duplicate n: ' + n);
    numbers.add(n);
    if (!photo.recipe_id || ids.has(photo.recipe_id)) errors.push('missing/duplicate recipe_id at n=' + n);
    ids.add(photo.recipe_id);
    if (!photo.path || !/^\\/assets\\/recipes-ai\\/\\d{4}-[a-z0-9-]+\\.webp$/.test(photo.path)) errors.push('invalid asset path at n=' + n);
    if (paths.has(photo.path)) errors.push('duplicate asset path: ' + photo.path);
    paths.add(photo.path);
    if (typeof photo.sha !== 'string' || !/^[a-f0-9]{40}$/.test(photo.sha)) errors.push('invalid Git blob SHA at n=' + n);
    if (!Number.isSafeInteger(photo.bytes) || photo.bytes <= 0) errors.push('invalid byte count at n=' + n);
  }
  for (let n=1; n<=1001; n++) if (!numbers.has(n)) errors.push('missing n: ' + n);
  return errors;
}

if (require.main === module) {
  const file = process.argv[2] || path.join(__dirname, '..', 'photo-library', 'ai-recipe-photo-map.json');
  try {
    const errors = validatePhotoMap(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (errors.length) { console.error(errors.join('\\n')); process.exitCode=1; }
    else console.log('PASS: 1001 unique photo mappings, paths, IDs and metadata structurally valid. NOT a file/visual/license check.');
  } catch (err) { console.error(err.message); process.exitCode=1; }
}
module.exports = { validatePhotoMap };
