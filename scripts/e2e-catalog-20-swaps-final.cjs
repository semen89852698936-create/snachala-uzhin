'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
 const browser = await chromium.launch({ headless: true });
 try {
  const scenarios = [
   { route:'/',width:1440,height:900,id:'plov-shadi-bek-quince' },
   { route:'/full-catalog/',width:1366,height:900,id:'plov-mushroom-bell-pepper' },
   { route:'/',width:390,height:844,id:'nd-beef-stroganoff-mushrooms' },
   { route:'/full-catalog/',width:390,height:844,id:'nd-chicken-mushroom-julienne' }
  ];
  for(const scenario of scenarios){
   const page=await browser.newPage({viewport:{width:scenario.width,height:scenario.height}});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    return u.hostname==='127.0.0.1'?route.continue():route.abort();
   });
   const prefix='http://127.0.0.1:8765'+scenario.route;
   await page.goto(prefix+'#recipe='+encodeURIComponent(scenario.id),{waitUntil:'domcontentloaded'});
   const item=await page.evaluate(id=>{
    const recipes=JSON.parse(document.getElementById('recipeData').textContent);
    return {count:recipes.length,unique:new Set(recipes.map(r=>r.id)).size,
      recipe:recipes.find(r=>r.id===id),cats:recipes.reduce((a,r)=>(a[r.category]=(a[r.category]||0)+1,a),{})};
   },scenario.id);
   assert.equal(item.count,1001);
   assert.equal(item.unique,1001);
   assert.ok(item.recipe,'Missing '+scenario.id);
   for(const cat of ['meat','poultry','vegetables'])assert.equal(item.cats[cat],100);
   await page.locator('#recipeDetail .du-editorial-step').first().waitFor({timeout:15000});
   assert.equal(await page.locator('#recipeDetail .du-editorial-step').count(),item.recipe.steps.length);
   const img=page.locator('#recipeDetail .recipe-intro-photo img');
   assert.equal(await img.count(),1);
   assert.ok((await img.getAttribute('src')).includes(scenario.id+'.webp'),'Recipe shows wrong image '+scenario.id);
   const original=Number(await page.locator('#recipeDetail .portion-picker strong').textContent());
   await page.locator('#portionPlus').click();
   assert.equal(Number(await page.locator('#recipeDetail .portion-picker strong').textContent()),original+1);
   await page.locator('#startCooking').click();
   assert.equal(await page.locator('#cookOverlay').isVisible(),true);
   assert.equal(await page.locator('#cookContent .du-editorial-cook-step').count(),1);
   await page.locator('#nextStep').click();
   assert.ok((await page.locator('#cookContent .cook-progress-label').textContent()).includes('Шаг 2'));
   await page.locator('#prevStep').click();
   assert.ok((await page.locator('#cookContent .cook-progress-label').textContent()).includes('Шаг 1'));
   await page.locator('#closeCook').click();
   assert.equal(await page.locator('#cookOverlay').isVisible(),false);
   assert.deepEqual(errors,[], 'JS errors in '+scenario.route+' '+scenario.id+': '+errors.join(' ; '));
   if(scenario.width<500){
    const over=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(over<=4,'Mobile overflows viewport by '+over+'px');
   }
   console.log('PASS',scenario.route,scenario.width+'px',scenario.id,'image / steps / portions / cooking mode');
   await page.close();
  }
 } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1});
