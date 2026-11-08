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
   assert.equal(await page.locator('#eveningLanding').isVisible(),false,'evening must stay a separate mode');
   const colors=await page.evaluate(()=>{
     const hero=document.querySelector('#homeView .du-hero');
     const css=getComputedStyle(hero);
     return {bg:css.backgroundColor,wordmark:getComputedStyle(document.querySelector('#homeView .du-hero h1')).color};
   });
   assert.equal(colors.bg,'rgb(247, 236, 223)','approved reference parchment storefront not applied');
   assert.equal(colors.wordmark,'rgb(40, 27, 27)','approved ink typography not applied');
   await page.evaluate(()=>document.fonts.ready);
   const coverBlend=await page.evaluate(()=>{
     const art=document.querySelector('#homeView .du-hero-art');
     const copy=document.querySelector('#homeView .du-hero-copy');
     const paper=getComputedStyle(art,'::before');
     const rect=el=>el.getBoundingClientRect();
     return {artLeft:rect(art).left,copyRight:rect(copy).right,
       seam:paper.backgroundImage,artMask:getComputedStyle(art).maskImage};
   });
   if(viewport.width>820){
     assert(coverBlend.artLeft<coverBlend.copyRight-55,
       'home photo must extend UNDER headline, not stop at a hard column edge: '+JSON.stringify(coverBlend));
     assert(coverBlend.seam.includes('gradient'),
       'home cover must blend image into parchment: '+JSON.stringify(coverBlend));
   } else {
     assert(coverBlend.artMask.includes('gradient'),
       'mobile cover must fade into parchment: '+JSON.stringify(coverBlend));
   }
   const featuredCard=await page.evaluate(()=>{
     const el=document.querySelector('#homeView .du-hero-recipe');
     const art=document.querySelector('#homeView .du-hero-art');
     return {position:getComputedStyle(el).position,
       cardBottom:el.getBoundingClientRect().bottom,
       artBottom:art.getBoundingClientRect().bottom,
       cardTop:el.getBoundingClientRect().top,
       artTop:art.getBoundingClientRect().top};
   });
   assert.equal(featuredCard.position,'absolute','featured recipe CTA must not enter normal cover flow');
   assert(featuredCard.cardBottom>featuredCard.artBottom-130 && featuredCard.cardBottom<featuredCard.artBottom+10,
      'featured recipe CTA must stay near the photograph bottom edge: '+JSON.stringify(featuredCard));
   await page.screenshot({path:'/tmp/editorial-home-cover-'+viewport.width+'.png',fullPage:false});
   const presentation=await page.evaluate(()=>{
     const button=document.querySelector('#homeView .du-hero-actions .du-btn-outline');
     const mark=document.querySelector('.header .du-brand-mark');
     const letters=document.querySelector('.header .du-brand-words');
     return {ctaColor:getComputedStyle(button).color,markBg:getComputedStyle(mark).backgroundColor,
       brandDirection:getComputedStyle(letters).flexDirection};
   });
   assert.equal(presentation.ctaColor,'rgb(85, 37, 50)','outlined CTA cannot be read on cream background');
   assert.equal(presentation.markBg,'rgba(0, 0, 0, 0)','brand wine glass must not have the old pink disk');
   assert.equal(presentation.brandDirection,'row','brand must read as one editorial wordmark');
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
   assert.equal(catalog.bg,'rgb(247, 236, 223)','catalog paper palette missing');
   const imageFusion=await page.locator('#recipeGrid .recipe-card .card-image').first().evaluate(
     el=>getComputedStyle(el).maskImage||getComputedStyle(el).webkitMaskImage);
   assert(imageFusion.includes('gradient'),'catalog photographs must blend into editorial paper');
   if(viewport.width>1000){
     assert.equal(catalog.columns,3,'desktop magazine grid should have 3 editorial tracks');
     assert.equal(catalog.firstDisplay,'grid','desktop first recipe not featured');
     assert.equal(catalog.firstColumnStart,'span 2','desktop feature should start with a two-track span');
     assert(catalog.firstWidth>catalog.secondWidth*1.6,'desktop lead recipe should be visibly wider: '+JSON.stringify(catalog));
     assert(catalog.headingSize>70,'magazine masthead too small');
   }else{
     assert.equal(catalog.columns,1,'mobile catalog must be a legible single column');
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
