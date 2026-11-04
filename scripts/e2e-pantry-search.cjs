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
    // Real-browser regression: three common pantry combinations previously
    // appeared empty or misleading because of missing morphology and recipes.
    for(const protein of ['говядина','курица','индейка']){
      await page.locator('#recipeSearch').fill(protein+', картофель');
      await page.waitForFunction(()=>document.getElementById('pantrySummary').textContent.includes('В коллекции пока нет одного рецепта'));
      assert.equal(await page.locator('#pantryMode').getAttribute('aria-pressed'),'true','Comma input activates pantry mode');
      const groups=await page.locator('#recipeGrid .du-pantry-group-title').allInnerTexts();
      assert.deepEqual(groups,['Блюда с продуктом «'+protein+'»','Блюда с продуктом «картофель»'],protein+': main + garnish groups');
      const cards=page.locator('#recipeGrid article[data-recipe]');
      assert.ok(await cards.count()>=8,protein+': suggestions from real recipes must be visible');
      assert.match(await page.locator('#pantrySummary').innerText(),/Ниже блюда с каждым продуктом отдельно/,protein+': no false combined-recipe promise');
    }
    if(viewport.width<500){
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
      if(overflow>2){
        const offenders=await page.evaluate(()=>[...document.querySelectorAll('body *')].map(el=>({element:el,rect:el.getBoundingClientRect()})).filter(x=>x.rect.width>0&&x.rect.right>innerWidth+2).sort((a,b)=>b.rect.right-a.rect.right).slice(0,12).map(x=>({tag:x.element.tagName,id:x.element.id,class:String(x.element.className).slice(0,85),right:Math.round(x.rect.right),left:Math.round(x.rect.left),width:Math.round(x.rect.width)})));
        console.log('MOBILE OVERFLOW DIAGNOSTIC',JSON.stringify(offenders));
        const header=await page.evaluate(()=>{
          const sels=['.container','.header','.header-inner','.header-inner>.brand','.du-brand-words','.du-brand-mark','.header-actions','.shopping-open','.shop-button-label','#categoryFilters','.category-filters'];
          return sels.map(sel=>{const el=document.querySelector(sel);if(!el)return {sel,missing:true};const r=el.getBoundingClientRect(),c=getComputedStyle(el);return {sel,left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),display:c.display,grid:c.gridTemplateColumns,minWidth:c.minWidth,flex:c.flex,overflow:c.overflow};});
        });
        console.log('MOBILE HEADER BOXES',JSON.stringify(header));
      }
      assert.ok(overflow<=2,'Mobile horizontal overflow: '+overflow);
    }
    assert.deepEqual(errors,[],'No browser JavaScript exceptions: '+errors.join(', '));
    console.log('PASS',entry||'index.html',viewport.width+'px','pantry, shopping, reload, clear, legacy search');
    await page.close();
   }
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
