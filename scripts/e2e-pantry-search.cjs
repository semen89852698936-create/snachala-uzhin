'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const entry of ['','full-catalog/']){
   for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const u=new URL(route.request().url());
      return u.hostname==='127.0.0.1'?route.continue():route.abort();
    });
    await page.goto('http://127.0.0.1:8765/'+entry+'#catalog',{waitUntil:'domcontentloaded'});
    await page.locator('#recipeSearch').fill('курица, сливки, грибы');
    await page.waitForFunction(()=>document.getElementById('pantrySummary').textContent.includes('Можно приготовить: 4'));
    assert.equal(await page.locator('#pantryMode').getAttribute('aria-pressed'),'true','Comma-separated input activates pantry mode');
    assert.match(await page.locator('#pantrySummary').innerText(),/Не хватает 1–2 продуктов:/);
    assert.ok(await page.locator('[data-shop-missing]').count()>0,'Missing-only buttons should appear');

    const ragout=page.locator('article[data-recipe]').filter({hasText:'Куриное рагу с шампиньонами и сливками'}).first();
    assert.equal(await ragout.count(),1,'Ragout with one missing ingredient should be visible');
    assert.match(await ragout.innerText(),/Бульон овощной/);
    await ragout.locator('[data-shop-missing]').click();
    await page.locator('.shopping-open').first().click();
    assert.equal(await page.locator('#shoppingDrawer').isVisible(),true,'Shopping drawer should open');
    let bought=await page.locator('#shoppingContents .shop-item span').allInnerTexts();
    assert.deepEqual(bought,['Бульон овощной'],'Only missing broth may be added, not the whole recipe');
    await page.locator('#closeShopping').click();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.shopping-open').first().click();
    bought=await page.locator('#shoppingContents .shop-item span').allInnerTexts();
    assert.deepEqual(bought,['Бульон овощной'],'Missing ingredients should persist after reload');
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#clearShopping').click();
    assert.match(await page.locator('#shoppingContents').innerText(),/Пока пусто/,'Clear shopping must remove missing-only items');
    await page.locator('#closeShopping').click();

    await page.locator('#recipeSearch').fill('курица, сливки, грибы');
    await page.locator('#pantryBasics').uncheck();
    assert.equal(await page.locator('#pantryBasics').isChecked(),false,'Basic pantry switch should work');
    await page.locator('#pantryMode').click();
    assert.equal(await page.locator('#pantryMode').getAttribute('aria-pressed'),'false','User can return to ordinary search');
    await page.locator('#recipeSearch').fill('паста');
    assert.ok(await page.locator('article[data-recipe]').count()>0,'Ordinary search should remain functional');
    if(viewport.width<500){
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      assert.ok(overflow<=2,'Mobile horizontal overflow: '+overflow);
    }
    assert.deepEqual(errors,[],'No browser JavaScript exceptions: '+errors.join(', '));
    console.log('PASS',entry||'index.html',viewport.width+'px','pantry, shopping, reload, clear, legacy search');
    await page.close();
   }
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
