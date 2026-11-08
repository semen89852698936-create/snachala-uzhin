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
   assert.equal(colors.bg,'rgb(37, 16, 15)','approved dark full-photograph magazine cover not applied');
   assert.equal(colors.wordmark,'rgb(255, 244, 230)','approved ivory type must be printed over the steak photograph');
   await page.evaluate(()=>document.fonts.ready);
   const featuredPhoto=await page.evaluate(async ()=>{
     const art=document.querySelector('#homeView .du-hero-art');
     const image=getComputedStyle(art).backgroundImage;
     if(!image.includes('home-hero-steak-wine-20261108.webp')){
       return {image,loaded:false};
     }
     const response=await fetch('/assets/home-hero-steak-wine-20261108.webp');
     const blob=await response.blob();
     const bitmap=await createImageBitmap(blob);
     const result={image,loaded:response.ok,width:bitmap.width,height:bitmap.height,type:blob.type};
     bitmap.close();
     return result;
   });
   assert(featuredPhoto.loaded && featuredPhoto.width===1400 && featuredPhoto.height===900,
     'Meat + two wine glasses hero is missing, undecodable or wrong sized: '+JSON.stringify(featuredPhoto));
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
     assert(coverBlend.artLeft===0 && coverBlend.copyRight>coverBlend.artLeft,
       'mobile steak photo must remain FULL BLEED beneath the editorial type: '+JSON.stringify(coverBlend));
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
   const photoCover=await page.evaluate(()=>{
     const hero=document.querySelector('#homeView .du-hero');
     const art=document.querySelector('#homeView .du-hero-art');
     const text=document.querySelector('#homeView .du-hero-copy');
     const h1=document.querySelector('#du-hero-title');
     const kicker=document.querySelector('#homeView .du-kicker');
     const slogan=document.querySelector('#homeView .du-hero-slogan');
     const occasion=document.querySelector('#homeView .du-hero-occasion');
     const paperButton=document.querySelector('#homeView .du-hero-actions .du-btn-primary');
     const chapters=document.querySelector('#homeView .du-cover-chapters');
     const bounds=x=>({left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right,
       top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom});
     return {
       mainHeading:h1.innerText.trim().replace(/\\s+/g,' '),
       kicker:kicker.innerText.trim(),
       slogan:slogan.innerText.trim(),
       occasion:occasion?.innerText.trim(),
       headerOnPhoto:bounds(art).left<=bounds(h1).left&&bounds(art).right>=bounds(h1).right&&
         bounds(art).top<=bounds(h1).top&&bounds(art).bottom>=bounds(h1).bottom,
       heroWidth:hero.getBoundingClientRect().width,
       photoWidth:art.getBoundingClientRect().width,
       contentBg:getComputedStyle(text).backgroundColor,
       underline:getComputedStyle(slogan,'::after').backgroundColor,
       paperClip:getComputedStyle(paperButton).clipPath,
       paperColor:getComputedStyle(paperButton).backgroundColor,
       chapters:chapters?[...chapters.querySelectorAll('a')].map(a=>({text:a.innerText.trim(),href:a.getAttribute('href')})):[],
       photoOverlap:bounds(art).left<bounds(text).right
     };
   });
   assert(photoCover.mainHeading.includes('СНАЧАЛА') && photoCover.mainHeading.includes('УЖИН'),
     'Live homepage title is missing from photographic spread: '+JSON.stringify(photoCover));
   assert.equal(photoCover.kicker,'КУЛИНАРНЫЙ ЖУРНАЛ');
   assert.equal(photoCover.slogan,'Рецепты, которые объединяют');
   assert.equal(photoCover.occasion,'1001 повод остаться');
   assert(photoCover.headerOnPhoto && Math.abs(photoCover.photoWidth-photoCover.heroWidth)<3 && photoCover.photoOverlap,
     'Approved photo must occupy WHOLE cover behind live typography, no pale left column: '+JSON.stringify(photoCover));
   assert.equal(photoCover.contentBg,'rgba(0, 0, 0, 0)',
     'Copy must be transparent and sit directly over the photograph');
   assert.equal(photoCover.underline,'rgb(164, 32, 59)',
     'Reference wine-red underline is missing');
   assert(photoCover.paperClip.startsWith('polygon('),
     'Live CTA must have a torn paper edge, not a rounded rectangle: '+JSON.stringify(photoCover));
   assert.equal(photoCover.paperColor,'rgb(255, 240, 221)',
     'CTA must use real ivory parchment color');
   const balance=await page.evaluate(()=>{
     const rect=sel=>document.querySelector(sel).getBoundingClientRect();
     const paper=rect('#homeView .du-cover-chapters');
     const hero=rect('#homeView .du-hero');
     const para=document.querySelector('#homeView .du-hero-description');
     return {paperTop:paper.top,heroBottom:hero.bottom,
       photoHeight:hero.height,
       descriptionColor:getComputedStyle(para).color,
       descriptionText:para.innerText.trim(),
       hasDemo:getComputedStyle(document.querySelector('.demo-strip')).display!=='none'};
   });
   assert.equal(balance.descriptionColor,viewport.width<=760?'rgb(255, 241, 226)':'rgb(255, 242, 230)',
     'Long-form copy over the dark photograph is not legible');
   assert(!balance.hasDemo,'Approved magazine cover has no unrelated demo strip above the photograph');
   if(viewport.width>1000){
     assert(balance.photoHeight<=760,
       'Cover grew too tall and hides the torn-paper lower third: '+JSON.stringify(balance));
     assert(balance.paperTop<viewport.height-50,
       'Torn-paper chapter strip must enter the first desktop viewport: '+JSON.stringify(balance));
   }
   assert.deepEqual(photoCover.chapters.map(x=>x.href),['#catalog','#airfryer','#evening'],
     'All three added editorial magazine links must navigate to real site sections');
 
   const featurePhotos=await page.evaluate(async ()=>{
     const photos=[...document.querySelectorAll('#homeView .du-cover-chapters .du-cover-chapters-photo')];
     for(const photo of photos){photo.loading='eager';await photo.decode();}
     return photos.map(photo=>({width:photo.naturalWidth,height:photo.naturalHeight,url:photo.currentSrc}));
   });
   assert.equal(featurePhotos.length,2,'magazine footer needs real visible food photographs');
   assert(featurePhotos.every(p=>p.width>=100&&p.height>=100),'footer food photography not loaded: '+JSON.stringify(featurePhotos));
   await page.locator('#homeView .du-cover-chapters').screenshot({
     path:'/tmp/editorial-home-chapters-'+viewport.width+'.png',
     animations:'disabled'
   });   await page.screenshot({path:'/tmp/editorial-home-cover-'+viewport.width+'.png',fullPage:false});
   const masthead=await page.evaluate(()=>{
     const nav=document.querySelector('.header .main-nav');
     const evening=nav?.querySelector('a[data-nav="evening"]');
     const airfryer=nav?.querySelector('a[data-nav="airfryer"]');
     const svg=document.querySelector('.header .du-brand-mark .du-wine-icon');
     const brand=document.querySelector('.header .du-brand-words');
     const bounds=x=>({left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right,
       width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height});
     return {
       hasEvening:!!evening,hasAirfryer:!!airfryer,
       glassPresent:!!svg && bounds(svg).width>19 && bounds(svg).height>20 &&
         getComputedStyle(svg).visibility==='visible' && getComputedStyle(svg).opacity==='1',
       name:brand?.innerText.trim().replace(/\\s+/g,' '),
       navVisible:!!nav && getComputedStyle(nav).display!=='none',
       navOrder:nav?[...nav.querySelectorAll(':scope > a')]
         .map(a=>({name:a.dataset.nav||'',order:Number(getComputedStyle(a).order),
           left:a.getBoundingClientRect().left,right:a.getBoundingClientRect().right,
           visible:getComputedStyle(a).display!=='none'})):[],
       eveningBg:evening?getComputedStyle(evening).backgroundColor:'',
       eveningColor:evening?getComputedStyle(evening).color:'',
       airfryerBorder:airfryer?getComputedStyle(airfryer).borderTopWidth:'',
       airfryerColor:airfryer?getComputedStyle(airfryer).color:'',
       eveningBox:evening?bounds(evening):null,
       airfryerBox:airfryer?bounds(airfryer):null
     };
   });
   assert(masthead.glassPresent,'original wine-glass mark must remain visible in masthead');
   assert(masthead.name?.includes('СНАЧАЛА') && masthead.name?.includes('УЖИН'),
     'original brand wordmark must remain visible: '+JSON.stringify(masthead));
   assert(masthead.hasEvening && masthead.hasAirfryer,
     'both approved special navigation buttons must exist');
   assert.equal(masthead.eveningBg,'rgb(113, 28, 46)',
     'Our Evening must be highlighted as a deep-wine button');
   assert.equal(masthead.airfryerColor,'rgb(113, 28, 46)',
     'Air Fryer must have a wine-colored outlined button');
   assert.equal(masthead.airfryerBorder,'1px',
     'Air Fryer must have the restored outline');
   if(viewport.width>680){
     const navLinks=masthead.navOrder.filter(a=>a.visible)
       .sort((a,b)=>a.order-b.order);
     assert.equal(navLinks[0]?.name,'evening',
       'Our Evening must be the leftmost navigation item: '+JSON.stringify(masthead));
     assert.equal(navLinks[navLinks.length-1]?.name,'airfryer',
       'Air Fryer must be the rightmost navigation item: '+JSON.stringify(masthead));
     assert(masthead.eveningBox.left<masthead.airfryerBox.left,
       'header navigation order must be correct in real browser geometry');
   }
   const presentation=await page.evaluate(()=>{
     const button=document.querySelector('#homeView .du-hero-actions .du-btn-outline');
     const mark=document.querySelector('.header .du-brand-mark');
     const letters=document.querySelector('.header .du-brand-words');
     return {ctaColor:getComputedStyle(button).color,markBg:getComputedStyle(mark).backgroundColor,
       brandDirection:getComputedStyle(letters).flexDirection};
   });
   assert.equal(presentation.ctaColor,'rgb(101, 25, 43)','approved wine-colored type on torn cream paper CTA is missing');
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
