'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const scenario of [
    {route:'/',viewport:{width:1536,height:960},name:'desktop-1536'},
    {route:'/',viewport:{width:1366,height:900},name:'desktop-1366'},
    {route:'/',viewport:{width:1024,height:850},name:'tablet-1024'},
    {route:'/',viewport:{width:820,height:860},name:'tablet-820'},
    {route:'/',viewport:{width:390,height:844},name:'mobile'}
  ]){
   const page=await browser.newPage({viewport:scenario.viewport});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   // The Our Evening experience belongs to the main site; the legacy full-catalog
   // HTML has recipe-only routing and no eveningLanding section.
   await page.goto('http://127.0.0.1:8765'+scenario.route+'#evening',{waitUntil:'domcontentloaded'});
   await page.locator('#eveningLanding').waitFor({state:'visible'});
   await page.evaluate(()=>document.fonts.ready);
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
   assert(story.titleSize>(scenario.viewport.width>820?60:65),'magazine headline too small');
   assert.equal(story.dinnerColumns,scenario.viewport.width>820?2:1,'dinner spread layout');
   assert.equal(story.afterColumns,scenario.viewport.width>820?2:1,'after-dinner layout');

   // The approved magazine layout puts the text to the LEFT of the hero photo.
   // On mobile it becomes text FIRST and photo SECOND. Verify real geometry.
   const geometry=await page.evaluate(()=>{
     const bounds=sel=>{
       const el=document.querySelector(sel),r=el.getBoundingClientRect();
       return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
     };
     return {
       photo:bounds('#eveningLanding > .du-evening-landing-photo'),
       image:bounds('#eveningLanding > .du-evening-landing-photo > img'),
       copy:bounds('#eveningLanding > .du-evening-landing-content'),
       heading:bounds('#eveningLandingTitle'),
       italicWord:bounds('#eveningLandingTitle em'),
       lead:bounds('#eveningLanding .du-evening-landing-lead'),
       text:bounds('#eveningLanding .du-evening-landing-text'),
       cta:bounds('#eveningLanding .du-evening-landing-cta'),
       inspiration:bounds('#eveningLanding .du-evening-inspiration'),
       viewportWidth:innerWidth
     };
   });
   assert(geometry.image.right<=geometry.photo.right+2,
     scenario.name+': photo exceeds its column: '+JSON.stringify(geometry));
   if(scenario.viewport.width>820){
     for(const name of ['copy','heading','italicWord','lead','text','cta','inspiration']){
       assert(geometry[name].right<=geometry.photo.left+2,
         scenario.name+': left-paper text overlaps the photo: '+name+': '+JSON.stringify(geometry));
     }
   }else{
     assert(geometry.copy.bottom<=geometry.photo.top+2,
       scenario.name+': approved mobile reading order must be copy before photo: '+JSON.stringify(geometry));
   }
   for(const name of ['heading','italicWord','lead','text','cta','inspiration']){
     assert(geometry[name].right<=geometry.viewportWidth+2,
       scenario.name+': '+name+' spills out of viewport: '+JSON.stringify(geometry));
   }
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
