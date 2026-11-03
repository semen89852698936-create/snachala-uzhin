const test = require('node:test');
const assert = require('node:assert/strict');
const {validatePhotoMap} = require('../scripts/validate_ai_photo_map');
const map = require('../photo-library/ai-recipe-photo-map.json');
test('current 1001-photo map is structurally consistent', () => {
  assert.deepEqual(validatePhotoMap(map), []);
});
test('duplicate photo mapping is rejected', () => {
  const changed = structuredClone(map);
  changed.photos[1].path = changed.photos[0].path;
  assert.match(validatePhotoMap(changed).join(' '), /duplicate asset path/);
});
test('missing recipe is rejected', () => {
  const changed = structuredClone(map);
  changed.photos.pop();
  assert.match(validatePhotoMap(changed).join(' '), /photos length must be 1001/);
});
test('missing file metadata is rejected', () => {
  const changed = structuredClone(map);
  changed.photos[0].bytes = 0;
  assert.match(validatePhotoMap(changed).join(' '), /invalid byte count/);
});
