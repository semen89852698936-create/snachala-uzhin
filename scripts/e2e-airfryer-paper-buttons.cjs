'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const desktop=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  desktop.on('pageerror',error=>errors.push(error.message));
  await desktop.goto(BASE+'/#airfryer',{waitUntil:'domcontentloaded'});
  await desktop.locator('#homeView #airfryer .du-airfryer-approved-zone').first().waitFor();
  const zones=desktop.locator('#homeView #airfryer .du-airfryer-approved-zone');
  assert.equal(await zones.count(),8,'expected exactly eight independent category links');
  const sizes=await desktop.evaluate(()=>{
   const board=document.querySelector('#homeView #airfryer .du-airfryer-approved-image');
   const style=getComputedStyle(board);
   return {clip:style.clipPath,boardTransform:style.transform,zoneCount:document.querySelectorAll('.du-airfryer-approved-zone[style*="--du-crop-width"]').length};
  });
  assert.notEqual(sizes.clip,'none','white rectangular background must be clipped to paper silhouette');
  assert.equal(sizes.zoneCount,8,'all eight tiles need matching photo crops');
  const urls=new Set();
  for(let index=0;index<8;index++){
   const zone=zones.nth(index);
   const href=await zone.getAttribute('href');
   assert(href.startsWith('/airfryer/?category='),'category link must open the independent catalogue');
   urls.add(href);
   await zone.hover();
   await desktop.waitForTimeout(280);
   const visual=await zone.evaluate(element=>{
    const after=getComputedStyle(element,'::after');
    const before=getComputedStyle(element,'::before');
    return {
      visible:after.opacity,
      motion:after.transform,
      background:after.backgroundImage,
      border:after.borderTopWidth,
      paper:before.opacity
    };
   });
   assert.equal(visual.visible,'1','hovered tile must be visible');
   assert.notEqual(visual.motion,'none','hovered tile must move independently');
   assert(visual.background.includes('airfryer-newspaper-approved-20261110.webp'),'hover tile must reuse approved original image');
   assert.equal(visual.border,'0px','hover must not draw a rectangular border');
   assert.equal(visual.paper,'1','revealed original image must have paper backing');
  }
  assert.equal(urls.size,8,'each category must have a unique destination');
  assert.equal(errors.length,0,errors.join('\n'));
  await desktop.locator('.du-airfryer-approved-zone').nth(1).click();
  await desktop.waitForURL(/\/airfryer\/\?category=/);
  assert.equal(new URL(desktop.url()).searchParams.get('category'),'Птица');
  await desktop.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  await mobile.goto(BASE+'/#airfryer',{waitUntil:'domcontentloaded'});
  assert.equal(await mobile.locator('#airfryerCategoryGrid .category-card').count(),8,'mobile still has eight clickable categories');
  assert.equal(await mobile.locator('.du-airfryer-approved-image').isVisible(),false,'mobile should use existing readable category grid');
  await mobile.close();
  console.log('PASS eight independent Aerogrill tiles, white canvas clipping, desktop hover/click and mobile links');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1;});
