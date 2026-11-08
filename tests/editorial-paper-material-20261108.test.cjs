// Regression guard for the owner-approved fibrous cover (08 Nov 2026).
// Run: node --test tests/editorial-paper-material-20261108.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'assets/editorial-unified-20261106.css'), 'utf8');
const read = (name) => fs.readFileSync(path.join(root, 'assets', name), 'utf8');

test('all four local paper resources exist and are SVG, not remote images', () => {
  for (const name of [
    'editorial-paper-fibres-20261108.svg',
    'editorial-paper-tear-mask-20261108.svg',
    'editorial-paper-torn-bottom-20261108.svg',
    'editorial-paper-panel-mask-20261108.svg',
  ]) {
    const svg = read(name);
    assert.match(svg, /<svg\b/);
    assert.match(svg, /<\/svg>/);
    assert.match(svg, /<path\b|<rect\b/);
    assert.ok(!/https?:\/\//.test(svg.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')));
    assert.ok(css.includes('/assets/' + name), name + ' must be used by the stylesheet');
  }
});

test('approved fibrous override follows earlier geometric fallback', () => {
  const marker = css.lastIndexOf('ORGANIC_FIBRE_TORN_PAPER_CONTROLS_20261108');
  assert.ok(marker > 0);
  const final = css.slice(marker);
  assert.match(final, /#homeView \.du-hero-art::after\s*\{/);
  assert.match(final, /editorial-paper-torn-bottom-20261108\.svg/);
  assert.match(final, /clip-path:\s*none/);
  assert.match(final, /mask-image:\s*var\(--du-ripped-paper-mask\)/);
  assert.match(final, /MOBILE_PANEL_INTERIOR_SAFE_TORN_MASK_20261108/);
  assert.match(final, /mask-image:\s*url\('\/assets\/editorial-paper-panel-mask-20261108\.svg'\)/);
  assert.doesNotMatch(final, /clip-path:\s*polygon\(/);
});

test('cover typography retains the approved tilt and left-side occasion', () => {
  assert.match(css, /SLOGAN_PARALLEL_TO_EXISTING_RED_LINE_20261108/);
  assert.match(css, /\.du-hero-slogan-type\s*\{[^}]*rotate\(-3deg\)/s);
  assert.match(css, /MOVE_COPY_TO_FEATURED_AREA_AND_DOUBLE_1001_20261108/);
  assert.match(css, /\.du-hero-occasion\s*\{[^}]*font-size:\s*clamp\(46px,5\.1vw,72px\)/s);
});
