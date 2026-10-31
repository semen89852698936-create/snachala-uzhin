const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const results = path.join(__dirname, 'results');
fs.mkdirSync(results, { recursive: true });
const reports = [];
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['desktop', 'mobile']) {
      const context = await browser.newContext(mode === 'mobile'
        ? { ...devices['iPhone 13'], reducedMotion: 'reduce' }
        : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const base = 'http://127.0.0.1:8765';
      const resp = await page.goto(base + '/nashe-vecher.html', { waitUntil: 'domcontentloaded' });
      assert.equal(resp.status(), 200);
      await page.waitForFunction(() => document.querySelector('#loadStatus')?.textContent?.includes('1001'), { timeout: 25000 });
      assert.equal(await page.locator('#starter option').count() > 1, true);
      assert.equal(await page.locator('#mainDish option').count() > 1, true);
      assert.equal(await page.locator('#dessert option').count() > 1, true);
      await page.locator('#suggest').click();
      const sum = await page.locator('#menuSummary').textContent();
      assert.match(sum, /Суммарное время/);
      await page.locator('#partner').fill('Аня');
      assert.match(await page.locator('#invitePreview').textContent(), /Аня/);
      assert.match(await page.locator('#invitePreview').textContent(), /Готовьте вместе/);
      await page.locator('#mainDish').selectOption({ index: 1 });
      const first = page.locator('#steps input[type="checkbox"]').first();
      assert.equal(await first.count() > 0, true);
      await first.check();
      await page.locator('#swap').click();
      assert.equal(await page.locator('#steps input[type="checkbox"]').first().isChecked(), true, 'Progress lost after swapping roles');
      const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(width.scroll <= width.viewport + 2, 'Horizontal overflow: ' + JSON.stringify(width));
      assert.deepEqual(errors, [], 'Browser JavaScript exceptions');
      await page.screenshot({ path: path.join(results, mode + '-our-evening.png'), fullPage: true, animations: 'disabled' });
      reports.push({ mode, result: 'PASS', catalog: 1001, tests: ['load', 'menu', 'invitation', 'role progress', 'responsive overflow', 'no JS errors'] });
      await context.close();
    }
    // Published homepage cannot be inferred from a source checkout: this test captures the source branch locally, not production.
    fs.writeFileSync(path.join(results,'report.json'), JSON.stringify({ target: 'review branch local browser', reports }, null, 2));
  } finally { await browser.close(); }
})().catch(err => {
  reports.push({ result: 'FAIL', reason: String(err && err.stack || err) });
  fs.writeFileSync(path.join(results,'report.json'), JSON.stringify({ reports },null,2));
  console.error(err);
  process.exit(1);
});
