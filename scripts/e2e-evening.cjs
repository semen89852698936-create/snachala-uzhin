const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    for(const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,deviceScaleFactor:1});
      const errors=[];
      // Spotify iframe is a third-party React app. Check our page without its hydration noise.
      await page.route('**/open.spotify.com/**', route=>route.abort());
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(500);
      assert.equal(await page.locator('#evening').isVisible(), false, 'Homepage must not expose huge evening block');
      assert.equal(await page.locator('#eveningLanding').isVisible(), false, 'Landing hidden on homepage');
      assert.equal(await page.locator('#homeView').isVisible(), true, 'Homepage visible');
      await page.goto('http://127.0.0.1:8765/#evening',{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(500);
      assert.equal(await page.locator('#eveningLanding').isVisible(),true,'Evening landing visible');
      assert.equal(await page.locator('#evening').isVisible(),true,'Mood builder visible in evening mode');
      assert.equal(await page.locator('#music').isVisible(),true,'Music accessible in evening mode');
      assert.equal(await page.locator('#catalog').isVisible(),false,'Catalog must not interrupt evening mode');
      assert.equal(await page.locator('#eveningLandingTitle').innerText(),'Наш вечер. ♡');
      await page.goto('http://127.0.0.1:8765/#recipe=salmon-lemon',{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(500);
      assert.equal(await page.locator('#recipeView').isVisible(),true,'Recipe visible');
      assert.equal(await page.locator('#recipeEveningInvite').isVisible(),true,'Compact recipe invite visible');
      await page.locator('#continueEveningBtn').click();
      await page.waitForTimeout(400);
      assert.ok(page.url().endsWith('#evening'),'Invite navigates to evening');
      assert.equal(await page.locator('#eveningPinned').isVisible(),true,'Selected recipe indicator visible');
      assert.ok((await page.locator('#eveningPinnedTitle').innerText()).includes('Лосось'),'Selected recipe carried over');
      assert.ok((await page.locator('#menuPreview').innerText()).includes('Лосось с лимоном'),'Selected dish in evening menu');
      await page.locator('#eveningClearChoice').click();
      assert.equal(await page.locator('#eveningPinned').isVisible(),false,'Selection clear works');
      await page.goto('http://127.0.0.1:8765/#catalog',{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(450);
      assert.equal(await page.locator('#catalog').isVisible(),true,'Catalog works after evening route');
      if(viewport.width<500){
        const overflow = await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        assert.ok(overflow <= 2,'Mobile horizontal overflow: '+overflow);
      }
      await page.screenshot({path:'/tmp/evening-'+viewport.width+'.png',fullPage:false});
      assert.deepEqual(errors,[],'No browser JavaScript runtime exceptions: '+errors.join(', '));
      await page.close();
      console.log('PASS layout + navigation + recipe selection',viewport.width);
    }
  } finally {
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exit(1)});
