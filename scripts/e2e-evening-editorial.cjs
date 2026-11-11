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
   // Approved magazine is a new real DOM spread, not the previous two-column mock.
   const editorial=await page.evaluate(()=>{
     const root=document.querySelector('#duApprovedEvening');
     const rect=selector=>{
       const el=document.querySelector(selector);const r=el.getBoundingClientRect();
       return {w:r.width,h:r.height,top:r.top,left:r.left,right:r.right,bottom:r.bottom};
     };
     const imgs=[...root.querySelectorAll('img')];
     return {
       visible:getComputedStyle(root).display!=='none',
       copy:root.innerText,
       firstDisplay:getComputedStyle(root.querySelector('.du-approved-scene-one')).display,
       firstLayout:getComputedStyle(root.querySelector('.du-approved-scene-one')).gridTemplateColumns.split(' ').length,
       scene1:rect('.du-approved-scene-one'),
       scene2:rect('.du-approved-scene-two'),
       scene3:rect('.du-approved-scene-three'),
       caption:rect('.du-approved-scene-one-caption'),
       images:imgs.map(im=>({src:im.getAttribute('src'),ok:im.complete&&im.naturalWidth>0})),
       musicLinks:[...root.querySelectorAll('.du-approved-music-item')].map(a=>a.href)
     };
   });
   assert(editorial.visible,scenario.name+': new approved spread not visible');
   assert(editorial.copy.includes('Готовим вместе')&&editorial.copy.includes('Ужинаем вдвоём')&&editorial.copy.includes('Продолжаем'),'three editorial acts missing');
   assert(editorial.scene1.h>300&&editorial.scene2.h>250&&editorial.scene3.h>250,'editorial scenes too small');
   assert(editorial.scene2.top>=editorial.scene1.top,'editorial stage order broken');
   assert(editorial.scene3.top>editorial.scene2.top,'editorial third stage order broken');
   assert(editorial.firstDisplay===(scenario.viewport.width>760?'grid':'flex'),'responsive stage one layout');
   assert.equal(editorial.images.length,4,'four photographic scenes must be present');
   assert(editorial.images.every(img=>img.ok),scenario.name+': editorial image failed to load '+JSON.stringify(editorial.images));
   assert.equal(editorial.musicLinks.length,3,'all three playlist links must be interactive');
   assert(editorial.musicLinks.every(link=>link.startsWith('https://open.spotify.com/playlist/')),'playlist destinations missing');
   assert.equal(story.musicCards,3,'three music chapters required');
   assert.equal(story.musicTracks,60,'20+20+20 curated tracks required');
   assert.equal(await page.locator('#eveningLanding .du-evening-inspiration-card').count(),3,'real-recipe suggestions missing');
   await page.screenshot({path:'/tmp/editorial-approved-spread-'+scenario.name+'.png',fullPage:true});
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
