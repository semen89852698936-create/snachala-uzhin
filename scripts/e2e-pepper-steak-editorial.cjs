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
   await page.goto('http://127.0.0.1:8765'+scenario.route+'#recipe=pepper-steak',{waitUntil:'domcontentloaded'});
   await page.locator('#recipeDetail .du-editorial-step').first().waitFor();
   const spread=await page.evaluate(()=>{
    const detail=document.querySelector('#recipeDetail');
    const intro=detail.querySelector('.recipe-intro');
    const photo=detail.querySelector('.recipe-intro-photo');
    const h1=detail.querySelector('h1');
    return {
     photoStyle:photo.getAttribute('style'),
     introColumns:getComputedStyle(intro).gridTemplateColumns.split(' ').length,
     introDisplay:getComputedStyle(intro).display,
     introDirection:getComputedStyle(intro).flexDirection,
     photoTop:photo.getBoundingClientRect().top,
     headingTop:h1.getBoundingClientRect().top,
     photoHeight:photo.getBoundingClientRect().height,
     titleSize:parseFloat(getComputedStyle(h1).fontSize),
     photoLabel:getComputedStyle(photo,'::after').content,
     hasHasSupport:CSS.supports('selector(:has(*))')
    };
   });
   assert(spread.hasHasSupport,'target browser lacks :has selector support');
   assert(spread.photoStyle.includes('0003-pepper-steak.webp'),'approved local recipe image not loaded');
   assert(spread.photoLabel.includes('ГОТОВИМ НА ДВОИХ'),'editorial photo label missing');
   assert(spread.photoHeight>300,'hero photo too small: '+JSON.stringify(spread));
   assert(spread.titleSize>(scenario.name==='desktop'?60:45),'magazine heading did not receive editorial typography');
   if(scenario.name==='desktop'){
     assert.equal(spread.introDisplay,'grid','desktop recipe spread must use magazine grid');
     assert.equal(spread.introColumns,2,'desktop recipe spread must have two columns');
   }else{
     assert.equal(spread.introDisplay,'flex','mobile recipe spread must stack vertically');
     assert.equal(spread.introDirection,'column','mobile recipe reading order incorrect');
     assert(spread.photoTop<spread.headingTop,'mobile food photograph must precede recipe heading');
   }
   const stepCopy=await page.locator('#recipeDetail .du-editorial-step-copy').first().evaluate(el=>({width:el.getBoundingClientRect().width,word:el.innerText.slice(0,100)}));
   assert(stepCopy.width>(scenario.name==='desktop'?245:190),'recipe instructions squeezed into a narrow column: '+JSON.stringify(stepCopy));
   assert(await page.locator('#recipeDetail .ingredient-check').count()>=5,'steak ingredients missing');
   const before=await page.locator('#recipeDetail .ingredient-check strong').first().innerText();
   await page.locator('#portionPlus').click();
   const after=await page.locator('#recipeDetail .ingredient-check strong').first().innerText();
   assert.notEqual(before,after,'serving adjustment failed');
   assert.equal(await page.locator('#recipeDetail .portion-picker strong').innerText(),'3','portion picker did not update');
   await page.screenshot({path:'/tmp/editorial-pepper-recipe-'+scenario.name+'.png'});
   await page.locator('#startCooking').click();
   await page.locator('#cookContent .du-editorial-cook-step').waitFor();
   assert(await page.locator('#cookOverlay').isVisible(),'guided cooking did not open');
   let cookSize=await page.locator('#cookContent .du-editorial-cook-step h2').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
   assert(cookSize>35,'step heading must stay readable');
   await page.locator('#nextStep').click();
   await page.locator('#nextStep').click();
   assert(await page.locator('#timerStart').isVisible(),'existing timer lost on timed step');
   assert((await page.locator('.cook-progress-label').innerText()).includes('3 из'),'step progress not updated');
   await page.screenshot({path:'/tmp/editorial-pepper-cook-'+scenario.name+'.png'});
   await page.locator('#prevStep').click();
   assert((await page.locator('.cook-progress-label').innerText()).includes('2 из'),'back navigation broken');
   await page.locator('#closeCook').click();
   assert.equal(await page.locator('#cookOverlay').isVisible(),false,'close guided cooking broken');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert(overflow<=4,'horizontal document overflow: '+overflow);
   assert.deepEqual(errors,[],'JavaScript errors');
   console.log('PASS pepper steak editorial',scenario.name);
   await page.close();
  }
 } finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
