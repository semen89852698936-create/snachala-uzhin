'use strict';
const assert=require('node:assert/strict');
const { chromium }=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const [route,mode,viewport] of [
   ['/', 'desktop',{width:1280,height:850}],
   ['/full-catalog/','mobile',{width:390,height:844}],
   ['/','mobile',{width:375,height:812}],
   ['/full-catalog/','desktop',{width:1366,height:900}]
  ]){
   const page=await browser.newPage({viewport,deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   const prefix='http://127.0.0.1:8765'+route;
   await page.goto(prefix,{waitUntil:'domcontentloaded'});
   const recipe=await page.evaluate(()=>{
    const tag=document.getElementById('recipeData');
    const recipes=JSON.parse(tag.textContent);
    return recipes.find(r=>r.steps.length>1&&r.steps.some(s=>s.timer))||recipes.find(r=>r.steps.length>1);
   });
   assert.ok(recipe,'no usable recipe');
   await page.goto(prefix+'#recipe='+encodeURIComponent(recipe.id),{waitUntil:'domcontentloaded'});
   await page.locator('#recipeDetail .du-editorial-step').first().waitFor();
   assert.equal(await page.locator('#recipeDetail .du-editorial-step').count(),recipe.steps.length,route+': wrong step count');
   assert.equal(await page.locator('#recipeDetail .du-film-card').count(),0,route+': old image filmstrip remains');
   assert.equal(await page.locator('#recipeDetail .du-editorial-illustration svg').count(),recipe.steps.length,route+': hand-drawn recipe action illustrations missing');
   assert.equal(await page.locator('#recipeDetail .recipe-intro-photo img').count(),1,route+': main recipe photo missing');
   const original=Number(await page.locator('#recipeDetail .portion-picker strong').textContent());
   await page.locator('#portionPlus').click();
   assert.equal(Number(await page.locator('#recipeDetail .portion-picker strong').textContent()),original+1,route+': serving controls broken');
   await page.locator('#startCooking').click();
   assert.equal(await page.locator('#cookOverlay').isVisible(),true,route+': cooking dialog hidden');
   assert.equal(await page.locator('#cookContent .du-editorial-cook-step').count(),1,route+': cooking step missing');
   assert.equal(await page.locator('#cookContent .du-cook-master-stage').count(),0,route+': step photo still required');
   await page.locator('#nextStep').click();
   assert.ok((await page.locator('#cookContent .cook-progress-label').textContent()).includes('Шаг 2'),route+': step next broken');
   await page.locator('#prevStep').click();
   assert.ok((await page.locator('#cookContent .cook-progress-label').textContent()).includes('Шаг 1'),route+': step prev broken');
   await page.locator('#closeCook').click();
   assert.equal(await page.locator('#cookOverlay').isVisible(),false,route+': modal close broken');
   assert.deepEqual(errors,[],route+': runtime errors');
   if(mode==='mobile'){
    const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(layout.scroll<=layout.width+4,route+': mobile horizontal overflow '+JSON.stringify(layout));
   }
   console.log('PASS',route,mode,recipe.id,recipe.steps.length,'steps');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
