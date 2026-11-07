'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/open.spotify.com/**',route=>route.abort());
   await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await page.locator('#homeView .du-hero h1').waitFor({state:'visible'});
   const timingGuidance=page.locator('.du-airfryer-guidance');
   assert.equal(await timingGuidance.count(),1,'airfryer timing guidance must appear once');
   assert(await timingGuidance.isVisible(),'airfryer timing guidance must be visible on desktop/mobile');
   const timingText=await timingGuidance.innerText();
   assert(timingText.includes('Время приготовления указано ориентировочно'),'approximate time wording missing');
   assert(timingText.includes('инструкцией производителя именно к вашей модели'),'model-specific manual guidance missing');

   assert.equal(await page.locator('#eveningLanding').isVisible(),false,'evening must stay a separate mode');
   const colors=await page.evaluate(()=>{
     const hero=document.querySelector('#homeView .du-hero');
     const css=getComputedStyle(hero);
     return {bg:css.backgroundColor,wordmark:getComputedStyle(document.querySelector('#homeView .du-hero h1')).color};
   });
   assert.equal(colors.bg,'rgb(72, 42, 55)','storefront and recipe palette drifted');
   assert.equal(colors.wordmark,'rgb(255, 248, 243)','hero title contrast regressed');
   assert.equal(await page.locator('#tryCooking').count(),1,'cooking demo CTA missing');
   assert.equal(await page.locator('.du-categories').count(),1,'category navigation missing');
   assert.equal(await page.locator('.du-catalog').count(),1,'catalog missing');
   // The catalog must be a real editorial spread, not just recolored pills.
   await page.goto('http://127.0.0.1:8765/#catalog',{waitUntil:'domcontentloaded'});
   await page.locator('#recipeGrid .recipe-card').first().waitFor({state:'visible'});
   // Hash routing scrolls smoothly; wait until the actual catalog is onscreen before screenshots.
   await page.waitForFunction(()=>Math.abs(document.querySelector('#catalog').getBoundingClientRect().top)<220,null,{timeout:9000});
   assert((await page.locator('#catalog').boundingBox()).y<220,'catalog deep link must visibly scroll to the catalog');
   const catalog=await page.evaluate(()=>{
     const grid=document.querySelector('#recipeGrid');
     const first=grid.querySelector('.recipe-card');
     const heading=document.querySelector('#catalog .du-section-heading h2');
     return {bg:getComputedStyle(document.querySelector('#catalog')).backgroundColor,
       columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
       firstColumnStart:getComputedStyle(first).gridColumnStart,
       firstColumnEnd:getComputedStyle(first).gridColumnEnd,
       firstWidth:first.getBoundingClientRect().width,
       secondWidth:grid.querySelector('.recipe-card:nth-child(2)').getBoundingClientRect().width,
       firstDisplay:getComputedStyle(first).display,
       headingSize:parseFloat(getComputedStyle(heading).fontSize),
       cardImageHeight:first.querySelector('.card-image').getBoundingClientRect().height};
   });
   assert.equal(catalog.bg,'rgb(245, 236, 229)','catalog paper palette missing');
   if(viewport.width>1000){
     assert.equal(catalog.columns,3,'desktop magazine grid should have 3 tracks');
     assert.equal(catalog.firstDisplay,'grid','desktop first recipe not featured');
     assert.equal(catalog.firstColumnStart,'span 2','desktop feature should start with a two-track span');
     assert(catalog.firstWidth>catalog.secondWidth*1.6,'desktop lead recipe should be visibly wider: '+JSON.stringify(catalog));
     assert(catalog.headingSize>70,'magazine masthead too small');
   }else{
     assert.equal(catalog.columns,1,'mobile catalog must be single column');
     assert(catalog.cardImageHeight>230,'mobile cards lack large photographs');
   }
   await page.screenshot({path:'/tmp/editorial-catalog-'+viewport.width+'.png',fullPage:false});
   const input=page.locator('#recipeSearch');
   await input.fill('стейк');
   await page.locator('#recipeGrid .recipe-card').first().waitFor();
   assert((await page.locator('#recipeGrid .recipe-card').count())>0,'catalog search broken');
   await input.fill('');
   assert.equal(await page.locator('#recipeGrid .recipe-card').count()>0,true,'catalog clear search broken');

   const width=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert(width<=4,viewport.width+': horizontal overflow '+width);
   await page.screenshot({path:'/tmp/editorial-home-'+viewport.width+'.png',fullPage:false});
   assert.deepEqual(errors,[],'JS runtime error');
   console.log('PASS editorial storefront',viewport.width);
   await page.close();
  }
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
