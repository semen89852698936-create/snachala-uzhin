'use strict';
// User journey: ingredient checklist, guided cooking, leaving and resuming.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const entry of ['','full-catalog/']){
   for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    const errors=[];
    page.on('pageerror',err=>errors.push(err.message));
    await page.route('**/*',route=>{
     const host=new URL(route.request().url()).hostname;
     return host==='127.0.0.1'?route.continue():route.abort();
    });
    const url='http://127.0.0.1:8765/'+entry+'#recipe=tomato-basil-pasta';
    await page.goto(url,{waitUntil:'domcontentloaded'});
    const checkbox=page.locator('#recipeDetail input[data-ing]').first();
    await checkbox.waitFor();
    await checkbox.check();
    assert.equal(await checkbox.isChecked(),true,'Ingredient can be checked');
    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('#recipeDetail input[data-ing]').first().isChecked(),true,
      'Ingredient checklist must survive refresh');

    await page.locator('#startCooking').click();
    assert.match(await page.locator('#cookContent').innerText(),/Шаг 1 из/);
    await page.locator('#nextStep').click();
    assert.match(await page.locator('#cookContent').innerText(),/Шаг 2 из/);
    await page.locator('#closeCook').click();

    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#startCooking').click();
    assert.match(await page.locator('#cookContent').innerText(),/Шаг 2 из/,
      'Guided cooking must resume on the saved step after refresh');
    await page.locator('#prevStep').click();
    assert.match(await page.locator('#cookContent').innerText(),/Шаг 1 из/,
      'Back returns to the previous step');

    const total=await page.evaluate(()=>{
      const item=JSON.parse(document.querySelector('#recipeData').textContent).find(x=>x.id==='tomato-basil-pasta');
      return item.steps.length;
    });
    assert.ok(total>=3,'Cooking journey fixture has enough real steps');
    for(let i=0;i<total;i++){
      await page.locator('#nextStep').click();
    }
    await page.locator('#finishCook').waitFor();
    await page.locator('#finishCook').click();
    assert.equal(await page.locator('#cookOverlay').isVisible(),false,'Finish closes cooking overlay');

    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#startCooking').click();
    assert.match(await page.locator('#cookContent').innerText(),/Шаг 1 из/,
      'Finishing resets progress, so the next cooking session starts at step one');
    await page.locator('#closeCook').click();
    if(viewport.width<500){
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      assert.ok(overflow<=2,'Mobile recipe must not overflow horizontally: '+overflow);
    }
    assert.deepEqual(errors,[],'No JS errors during cooking journey');
    console.log('PASS',entry||'index.html',viewport.width+'px',
      'ingredients, cooking step resume, back, finish and restart');
    await page.close();
   }
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});