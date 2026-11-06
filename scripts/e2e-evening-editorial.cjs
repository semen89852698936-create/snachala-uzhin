'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const scenario of [
    {route:'/',viewport:{width:1366,height:900},name:'desktop'},
    {route:'/full-catalog/',viewport:{width:390,height:844},name:'mobile'}
  ]){
   const page=await browser.newPage({viewport:scenario.viewport});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:8765'+scenario.route+'#evening',{waitUntil:'domcontentloaded'});
   await page.locator('#eveningLanding').waitFor({state:'visible'});
   assert(await page.locator('#evening').isVisible(),'builder must remain visible');
   assert(await page.locator('#music').isVisible(),'music must remain visible');
   const story=await page.evaluate(()=>{
    const pick=sel=>document.querySelector(sel);
    const src=sel=>pick(sel).getAttribute('src');
    return {
      hero:src('#eveningLanding .du-evening-landing-photo img'),
      dinner:src('#eveningLanding .du-story-dinner-photo img'),
      after:src('#evening .du-story-after-photo img'),
      together:src('#evening .du-evening-together > img'),
      invitation:src('#evening .du-evening-invitation-photo img'),
      titleSize:parseFloat(getComputedStyle(pick('#eveningLandingTitle')).fontSize),
      dinnerColumns:getComputedStyle(pick('#eveningLanding .du-story-dinner')).gridTemplateColumns.split(' ').length,
      afterColumns:getComputedStyle(pick('#evening .du-story-after')).gridTemplateColumns.split(' ').length,
      musicCards:document.querySelectorAll('#music .du-music-card').length,
      musicTracks:document.querySelectorAll('#music .du-bpm-track').length
    };
   });
   assert(story.hero.includes('our-evening-hero-hq.avif'),'approved first scene changed');
   assert(story.dinner.includes('our-evening-dinner-hq.avif'),'approved dinner photo changed');
   assert(story.after.includes('our-evening-after-hq.avif'),'approved after-dinner photo changed');
   assert(story.together.includes('our-evening-together-approved.webp'),'approved together photo changed');
   assert(story.invitation.includes('our-evening-invitation-approved-20261102.webp'),'approved invitation changed');
   assert(story.titleSize>(scenario.name==='desktop'?80:65),'magazine headline too small');
   assert.equal(story.dinnerColumns,scenario.name==='desktop'?2:1,'dinner spread layout');
   assert.equal(story.afterColumns,scenario.name==='desktop'?2:1,'after-dinner layout');
   assert.equal(story.musicCards,3,'three music chapters required');
   assert.equal(story.musicTracks,60,'20+20+20 curated tracks required');
   assert.equal(await page.locator('#eveningLanding .du-evening-inspiration-card').count(),3,'real-recipe suggestions missing');
   await page.screenshot({path:'/tmp/editorial-evening-story-'+scenario.name+'.png'});
   await page.locator('#evening [data-mood="spark"]').click();
   assert.equal(await page.locator('#evening [data-mood="spark"]').getAttribute('aria-pressed'),'true','mood selector broke');
   await page.locator('#swapEveningRoles').click();
   assert((await page.locator('#eveningRoleStatus').innerText()).length>0,'role selector broke');
   await page.locator('#evening .du-story-after').scrollIntoViewIfNeeded();
   await page.screenshot({path:'/tmp/editorial-evening-after-'+scenario.name+'.png'});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert(overflow<=4,'horizontal overflow: '+overflow);
   assert.deepEqual(errors,[],'JavaScript errors');
   console.log('PASS editorial Our Evening',scenario.name);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
