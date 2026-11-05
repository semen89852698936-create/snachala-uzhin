'use strict';
// Negative regression tests for the catalog parity gate. No production HTML is modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const validator = path.resolve(__dirname, 'test_catalog_parity.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-parity-negative-'));
const recipes = () => Array.from({ length: 1001 }, (_, i) => ({
  id: i + 1, title: 'Recipe ' + (i + 1),
  ingredients: ['water'], steps: ['Mix']
}));
function write(name, data) {
  const target = path.join(temp, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '<script id="recipeData" type="application/json">' +
    JSON.stringify(data) + '</script>');
}
function run(main, full, expectedSuccess, message) {
  write('index.html', main);
  write('full-catalog/index.html', full);
  const result = spawnSync(process.execPath, [validator], { cwd: temp, encoding: 'utf8' });
  assert.equal(result.status === 0, expectedSuccess,
    message + ': unexpected status; ' + result.stdout + result.stderr);
}
try {
  const valid = recipes();
  run(valid, structuredClone(valid), true, 'valid catalogs');
  let bad = recipes();
  bad[1].id = '1';
  run(bad, structuredClone(bad), false, 'normalized duplicate IDs');
  bad = recipes();
  bad[0].id = ' 1 ';
  run(bad, structuredClone(bad), false, 'whitespace ID');
  bad = recipes();
  bad[0].id = Number.MAX_SAFE_INTEGER + 1;
  run(bad, structuredClone(bad), false, 'unsafe numeric ID');
  bad = recipes();
  bad[0].title = '  ';
  run(bad, structuredClone(bad), false, 'blank title');
  bad = recipes();
  const drift = structuredClone(bad);
  drift[0].steps = ['Changed step'];
  run(bad, drift, false, 'cross-catalog drift');
  console.log('PASS: catalog validator accepts valid fixtures and rejects five invalid cases');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
