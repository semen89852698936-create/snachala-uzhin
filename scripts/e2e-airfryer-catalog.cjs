'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const entry of ['','full-catalog/']){
   for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
     const u=new URL(route.request().url());
     return u.hostname==='127.0.0.1'?route.continue():route.abort();
    });
    await page.goto('http://127.0.0.1:8765/'+entry+'#airfryer',{waitUntil:'domcontentloaded'});
    await page.locator('#airfryerGrid .du-airfryer-card').first().waitFor();
    assert.equal(await page.locator('#airfryerGrid .du-airfryer-card').count(),100,'All 100 airfryer cards must render');
    assert.equal(await page.locator('#airfryerCount').innerText(),'100 рецептов');
    const firstImage=page.locator('#airfryerGrid .du-airfryer-card img').first();
    await firstImage.scrollIntoViewIfNeeded();
    await firstImage.evaluate(async img=>{img.loading='eager';if(!img.complete)await new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});});});
    assert.ok(await firstImage.evaluate(img=>img.naturalWidth>0),'Local airfryer photo must load: '+await firstImage.getAttribute('src'));
    await page.locator('[data-airfryer-filter="Птица"]').click();
    assert.equal(await page.locator('#airfryerGrid .du-airfryer-card').count(),20,'Poultry filter must show 20 recipes');
    await page.locator('[data-airfryer-filter="Все блюда"]').click();
    await page.locator('#airfryerSearch').fill('клюква');
    assert.equal(await page.locator('#airfryerGrid .du-airfryer-card').count(),1,'Ingredient search should find cranberry turkey medallions');
    await page.locator('[data-airfryer-open="af-turkey-medallions-cranberry-2"]').click();
    await page.locator('#recipeView').waitFor({state:'visible'});
    assert.match(await page.locator('#recipeDetail').innerText(),/Режим приготовления в аэрогриле/);
    assert.match(await page.locator('#recipeDetail').innerText(),/Температура/);
    assert.match(await page.locator('#recipeDetail').innerText(),/клюквенно-апельсиновым соусом/i);
    assert.ok(await page.locator('#recipeDetail .ingredient-check').count()>=5,'Ingredients must render');
    assert.ok(await page.locator('#recipeDetail .du-editorial-step').count()>=4,'Cooking steps must render');
    await page.locator('#startCooking').click();
    assert.equal(await page.locator('#cookOverlay').isVisible(),true,'Step-by-step cooking overlay must open');
    assert.ok(await page.locator('#cookContent').innerText().then(t=>t.includes('Шаг 1')),'First cooking step should be visible');
    await page.locator('#closeCook').click();
    assert.deepEqual(errors,[],entry+' page errors at '+viewport.width+'px');
    await page.close();
   }
  }
  console.log('Airfryer browser smoke passed: 100 cards, category filter, ingredient search, recipe detail and cooking mode on desktop/mobile in both HTML variants.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
