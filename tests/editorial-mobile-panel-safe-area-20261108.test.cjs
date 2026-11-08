// Safeguard the owner-approved mobile paper panel against clipped first/last lines.
// Run: node --test tests/editorial-mobile-panel-safe-area-20261108.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const assets = path.join(__dirname, '..', 'assets');
const panel = fs.readFileSync(path.join(assets, 'editorial-paper-panel-mask-20261108.svg'), 'utf8');
const css = fs.readFileSync(path.join(assets, 'editorial-unified-20261106.css'), 'utf8');

test('mobile panel mask retains a full-height interior with shallow organic tears', () => {
  assert.match(panel, /viewBox="0 0 320 112"/);
  assert.match(panel, /feTurbulence\b/);
  assert.match(panel, /feDisplacementMap\b/);
  const shape = panel.match(/<path\s+fill="#fff"[^>]*\bd="([^"]+)"/);
  assert.ok(shape, 'white mask silhouette must exist');
  const d = shape[1];
  assert.match(d, /M0 6\b/, 'top edge begins within 6 SVG units');
  assert.match(d, /319 106|310 108/, 'bottom edge remains near the full height');
  assert.match(d, /6 111/, 'left bottom corner preserves text-safe depth');
  assert.doesNotMatch(panel, /<polygon\b|clip-path:\s*polygon\(/);
});

test('final mobile override uses the dedicated panel mask, not the button mask', () => {
  const marker = css.lastIndexOf('MOBILE_PANEL_INTERIOR_SAFE_TORN_MASK_20261108');
  assert.ok(marker >= 0, 'mobile text-safe override must remain');
  const tail = css.slice(marker);
  assert.match(tail, /editorial-paper-panel-mask-20261108\.svg/);
  assert.doesNotMatch(tail, /clip-path:\s*polygon\(/);
});
