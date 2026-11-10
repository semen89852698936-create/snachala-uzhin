'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const {width,height,name} of [
   {width:1366,height:900,name:'desktop'},
   {width:820,height:1050,name:'tablet'},
   {width:390,height:844,name:'mobile'}
  ]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   await page.route('**/open.spotify.com/**',route=>route.abort());
   await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
   await page.locator('#homeView .du-hero h1').waitFor({state:'visible'});
   await page.evaluate(()=>document.fonts.ready);
   const x=await page.evaluate(()=>{
    const el=q=>document.querySelector(q);
    const v=q=>{let n=el(q);if(!n)return null;const s=getComputedStyle(n),r=n.getBoundingClientRect();return {
      display:s.display,paddingTop:parseFloat(s.paddingTop),paddingBottom:parseFloat(s.paddingBottom),
      marginBottom:parseFloat(s.marginBottom),rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height}}};
    const h=el('#homeView');
    return {
      cover:v('#homeView > .du-cover-chapters'),
      quote:v('#homeView > .du-quote-strip > .container'),
      categories:v('#homeView > #categories > .du-section-top'),
      favorites:v('#homeView > #my-recipes .du-my-heading'),
      airfryer:v('#homeView #airfryer .du-airfryer-landing .du-section-top'),
      width:document.documentElement.scrollWidth,
      viewport:innerWidth,
      present:!!h
    };
   });
   assert(x.present&&x.cover&&x.quote&&x.categories&&x.favorites,
    'required approved home chapters must be present: '+JSON.stringify(x));
   assert(x.quote.paddingTop>=22&&x.quote.paddingBottom>=22,
    'quiet quotation panel must preserve reading space: '+JSON.stringify(x.quote));
   assert(x.cover.paddingTop>=25&&x.cover.paddingBottom>=35,
    'cover/photo transition needs measured whitespace: '+JSON.stringify(x.cover));
   if(width>920){
     assert(x.categories.marginBottom>=30,
       'desktop category introduction must breathe: '+JSON.stringify(x.categories));
   } else if(width<=760){
     assert(x.categories.marginBottom>=23,
       'mobile rhythm should remain calm: '+JSON.stringify(x.categories));
   }
   const seen=await page.locator('#homeView #categories').isVisible();
   assert(seen,'home page photo categories remain accessible');
   await page.screenshot({path:'/tmp/editorial-rhythm-home-'+name+'-hero.png'});
   await page.locator('#homeView #categories').scrollIntoViewIfNeeded();
   await page.screenshot({path:'/tmp/editorial-rhythm-home-'+name+'-categories.png'});
   const fav=page.locator('#homeView #my-recipes');
   if(await fav.isVisible()){
     await fav.scrollIntoViewIfNeeded();
     await page.screenshot({path:'/tmp/editorial-rhythm-home-'+name+'-favorites.png'});
   }
   console.log('PASS editorial home rhythm '+name,JSON.stringify(x));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
