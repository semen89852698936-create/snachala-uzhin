'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const {route,viewport,label} of [
    {route:'/',viewport:{width:1366,height:900},label:'desktop'},
    {route:'/full-catalog/',viewport:{width:390,height:844},label:'mobile'}
  ]){
   const page=await browser.newPage({viewport});
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   await page.goto('http://127.0.0.1:8765'+route+'#recipe=salmon-lemon',{waitUntil:'domcontentloaded'});
   await page.locator('#recipeDetail .du-editorial-step').first().waitFor();
   assert.equal(await page.locator('#recipeDetail .du-editorial-illustration svg').count()>0,true,'illustrated steps missing');
   const css=await page.evaluate(()=>{
     const a=document.getElementById('recipeView');
     const s=getComputedStyle(a);
     return {background:s.backgroundColor,links:[...document.querySelectorAll('link[rel="stylesheet"]')].map(l=>l.href)};
   });
   assert(css.links.some(link=>link.endsWith('/assets/editorial-unified-20261106.css')),'new stylesheet missing');
   assert.equal(css.background,'rgb(247, 236, 223)','approved cream parchment palette not applied');
   await page.screenshot({path:'/tmp/unified-recipe-'+label+'.png'});
   await page.locator('#startCooking').click();
   await page.locator('#cookContent .du-editorial-cook-step').waitFor();
   assert.equal(await page.locator('#cookOverlay').isVisible(),true,'cooking mode not visible');
   await page.screenshot({path:'/tmp/unified-cook-'+label+'.png'});
   await page.locator('#closeCook').click();
   if(label==='mobile'){
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
     assert(overflow<=4,'recipe mobile horizontal overflow '+overflow);
   }
   assert.deepEqual(errors,[],'JS error');
   await page.close();
  }
  for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/open.spotify.com/**',route=>route.abort());
    await page.goto('http://127.0.0.1:8765/#evening',{waitUntil:'domcontentloaded'});
    await page.locator('#eveningLanding').waitFor({state:'visible'});
    assert.equal(await page.locator('#evening').isVisible(),true);
    assert.equal(await page.locator('#music').isVisible(),true);
    const html=await page.locator('#eveningLanding').innerHTML();
    assert(html.includes('evening-approved-photo-20261111.webp'));
    const dinner=await page.locator('.du-evening-invitation img').getAttribute('src');
    assert(dinner.includes('our-evening-invitation-approved-20261102.webp'),'approved invitation changed');
    await page.screenshot({path:'/tmp/unified-evening-'+viewport.width+'.png'});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert(overflow<=4,'evening horizontal overflow '+overflow);
    assert.deepEqual(errors,[],'evening JS error');
    await page.close();
  }
  console.log('PASS unified editorial desktop/mobile recipe, cooking and Our Evening');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
