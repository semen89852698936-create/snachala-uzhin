const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.route('**/open.spotify.com/**',r=>r.abort());
  await page.goto('http://127.0.0.1:8765/#evening',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(600);
  const story=await page.evaluate(()=>{
   const q=s=>document.querySelector(s),st=s=>getComputedStyle(q(s));
   return{
    hero:q('#eveningLanding .du-evening-landing-photo img')?.src||'',
    dinner:q('.du-story-dinner-photo img')?.src||'',
    ending:q('.du-story-after-photo img')?.src||'',
    heroVisible:q('#eveningLanding')?.getBoundingClientRect().height>0,
    dinnerVisible:q('.du-story-dinner')?.getBoundingClientRect().height>0,
    endingVisible:q('.du-story-after')?.getBoundingClientRect().height>0,
    title:st('#eveningLandingTitle').fontFamily,
    body:st('.du-evening-landing-text').fontFamily,
    paragraphSize:parseFloat(st('.du-evening-landing-text').fontSize),
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    cardLinks:[...document.querySelectorAll('.du-evening-inspiration-card')].map(a=>a.getAttribute('href')),
   };
  });
  assert.match(story.hero,/\/6962219\//);
  assert.match(story.dinner,/\/5018980\//);
  assert.match(story.ending,/\/5054097\//);
  assert.equal(new Set([story.hero,story.dinner,story.ending]).size,3);
  assert.ok(story.heroVisible&&story.dinnerVisible&&story.endingVisible,'All three scenes on evening screen');
  assert.match(story.title,/Cormorant|Baskerville|Georgia/);
  assert.match(story.body,/Manrope|Segoe UI|Arial/);
  assert.ok(story.paragraphSize>=16,'Legible copy');
  assert.ok(story.overflow<=2,'No horizontal scrolling: '+story.overflow);
  assert.deepEqual(story.cardLinks,['#recipe=salmon-lemon','#recipe=collection-pasta-01-03','#recipe=chocolate-cake']);
  await page.screenshot({path:'/tmp/our-evening-story-'+width+'.png',fullPage:true,animations:'disabled',timeout:20000});
  await page.locator('.du-story-dinner').screenshot({path:'/tmp/our-evening-dinner-'+width+'.png'});
  await page.goto('http://127.0.0.1:8765/#recipe=salmon-lemon',{waitUntil:'domcontentloaded'});
  await page.locator('#continueEveningBtn').click();
  await page.locator('#eveningPinned').waitFor({state:'visible',timeout:5000});
  assert.match(await page.locator('#eveningPinnedTitle').innerText(),/Лосось/);
  console.log('PASS approved-story',width,JSON.stringify(story));
  await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
