const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
   await page.route('**/open.spotify.com/**', r=>r.abort());
   await page.goto('http://127.0.0.1:8765/#evening',{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(900);
   const images=await page.evaluate(()=>{
    const get=sel=>document.querySelector(sel)?.getAttribute('src')||'';
    return {
     landing:get('#eveningLanding .du-evening-landing-photo img'),
     cooking:get('#evening .du-evening-together > img'),
     invitation:get('#evening .du-evening-invitation-photo img'),
     recipe:get('#recipeEveningInvite .du-recipe-evening-photo img')
    };
   });
   assert.match(images.landing,/\/11368688\//,'Hero should use home editorial photo');
   assert.match(images.cooking,/\/5424608\//,'Kitchen photo should be unique');
   assert.match(images.invitation,/\/36305242\//,'Romantic invitation should retain original photo');
   assert.match(images.recipe,/\/29110845\//,'Recipe banner should show separate romantic table');
   assert.equal(new Set(Object.values(images)).size,4,'No repeated imagery in evening experience and recipe invitation');
   const style=await page.evaluate(()=>{
    const style=sel=>getComputedStyle(document.querySelector(sel));
    const hero=style('#eveningLandingTitle'),lead=style('.du-evening-landing-text'),
          mood=style('#evening .du-mood small'),section=style('#evening .du-section-heading h2');
    return {heroFont:hero.fontFamily,heroSize:parseFloat(hero.fontSize),
      leadFont:lead.fontFamily,leadSize:parseFloat(lead.fontSize),
      moodSize:parseFloat(mood.fontSize),sectionFont:section.fontFamily,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   assert.match(style.heroFont,/Cormorant|Baskerville|Georgia/i);
   assert.match(style.sectionFont,/Cormorant|Baskerville|Georgia/i);
   assert.match(style.leadFont,/Manrope|Segoe|Arial/i);
   assert.ok(style.leadSize>=16,'Small description should match site readability');
   assert.ok(style.moodSize>=13,'Mood captions should be readable');
   assert.ok(style.overflow<=2,'No horizontal overflow: '+style.overflow);
   await page.screenshot({path:'/tmp/evening-visual-'+width+'.png',fullPage:false,animations:'disabled'});
   await page.goto('http://127.0.0.1:8765/#recipe=salmon-lemon',{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(350);
   await page.locator('#recipeEveningInvite').screenshot({path:'/tmp/evening-recipe-visual-'+width+'.png'});
   await page.locator('#continueEveningBtn').click();
   await page.waitForFunction(()=>location.hash==='#evening'&&!document.getElementById('eveningPinned').hidden,null,{timeout:5000});
   assert.equal(await page.locator('#eveningPinned').isVisible(),true,'Recipe should carry into evening');
   console.log('PASS responsive photos and type:',width,JSON.stringify(style));
   await page.close();
  }
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
