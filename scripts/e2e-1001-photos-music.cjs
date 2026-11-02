const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const spotifyIds=['7lvXSaWbmTnJaaTRvBXUB4','6dEbxo2xovdfIQLBeAAO37','2BlyxFmZbKN3HAVk2TZFT6'];
    for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:360,height:800}]) {
      const page=await browser.newPage({viewport});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      // Spotify audio cannot be tested with local mock; verify native iframe placement only.
      await page.route('**/open.spotify.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Spotify placeholder</title>'}));
      await page.route('**/fonts.googleapis.com/**',r=>r.abort());
      await page.route('**/fonts.gstatic.com/**',r=>r.abort());
      await page.goto('http://127.0.0.1:8765/#music',{waitUntil:'domcontentloaded',timeout:30000});
      await page.locator('.du-music-native-player iframe').first().waitFor({state:'attached',timeout:15000});
      const audio=await page.evaluate(()=>{
        const frames=[...document.querySelectorAll('.du-music-native-player iframe')];
        return {
          sources:frames.map(f=>f.getAttribute('src')),
          insideCards:frames.every(f=>!!f.closest('.du-music-card')),
          visible:frames.map(f=>getComputedStyle(f.closest('.du-music-card')).display!=='none'),
          oldPlayer:!!document.querySelector('#du-music-player'),
          oldButtons:document.querySelectorAll('[data-music-track]').length,
          suggestedCount:document.querySelectorAll('.du-music-suggestions ol li').length,
          suggestedGroups:document.querySelectorAll('.du-music-suggestions').length,
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          headerDesktopVisible:getComputedStyle(document.querySelector('.main-nav')).display!=='none',
          mobileNavVisible:getComputedStyle(document.querySelector('.du-evening-nav-mobile')).display!=='none',
        };
      });
      assert.equal(audio.sources.length,3);
      for(let i=0;i<3;i++)assert.ok(audio.sources[i].includes(spotifyIds[i]),audio.sources[i]);
      assert.equal(audio.insideCards,true);
      assert.deepEqual(audio.visible,[true,true,true]);
      assert.equal(audio.oldPlayer,false);
      assert.equal(audio.oldButtons,0);
      assert.equal(audio.suggestedCount,60);
      assert.equal(audio.suggestedGroups,3);
      if(audio.overflow>2){
        const offenders=await page.evaluate(()=>[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,cls:el.className?.toString().slice(0,65),right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left)})).filter(el=>el.right>innerWidth+2||el.left<-2).slice(0,16));
        console.log('Mobile overflow diagnosis',viewport.width,JSON.stringify(offenders));
      }
      assert.ok(audio.overflow<=2,viewport.width+': horizontal overflow '+audio.overflow+'px');
      if(viewport.width>680)assert.ok(audio.headerDesktopVisible);else assert.ok(audio.mobileNavVisible);
      for(const name of ['0001-lemon-spinach-pasta.webp','1001-midnight-mushroom-toasts.webp']){
        const response=await page.request.get('http://127.0.0.1:8765/assets/recipes-ai/'+name);
        assert.equal(response.status(),200,'missing asset '+name);
        assert.equal(response.headers()['content-type'],'image/webp');
      }
      const nav=viewport.width<=680?'.du-evening-nav-mobile':'.main-nav [data-nav="evening"]';
      await page.locator(nav).click();
      await page.waitForTimeout(350);
      assert.equal(new URL(page.url()).hash,'#evening');
      await page.locator('#eveningLanding').waitFor({state:'visible',timeout:5000});
      await page.goto('http://127.0.0.1:8765/#catalog',{waitUntil:'domcontentloaded'});
      await page.locator('.recipe-card').first().waitFor({state:'visible',timeout:8000});
      assert.equal(await page.locator('.recipe-card').count(),24);
      await page.locator('.recipe-card').first().click();
      await page.locator('#recipeView').waitFor({state:'visible',timeout:8000});
      assert.equal(errors.length,0,'page JS errors: '+errors.join(', '));
      await page.screenshot({path:'/tmp/snachala-uzhin-1001-'+viewport.width+'.png',fullPage:false});
      console.log('PASS',viewport.width,'local photos + 3 Spotify embeds + Our Evening + recipe');
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
