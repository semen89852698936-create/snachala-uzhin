const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/open.spotify.com/**',route=>route.abort());
   const base='http://127.0.0.1:8765/';
   await page.goto(base+'#catalog',{waitUntil:'domcontentloaded'});
   await page.locator('#recipeSearch').fill('курица, сливки, грибы');
   assert.match(await page.locator('#resultCount').innerText(),/^6 рецептов$/);
   assert.equal(await page.locator('#recipeGrid .recipe-card').count(),6);
   await page.locator('#recipeGrid [data-fav]').first().click();
   await page.goto(base+'#my-recipes',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#myRecipesGrid .du-personal-card').count(),1);
   assert.equal(await page.locator('[data-my-tab]').count(),3);
   await page.locator('#myRecipesGrid [data-my-note]').first().fill('Меньше соли и больше зелени');
   await page.locator('#myRecipesGrid [data-my-save]').first().click();
   await page.locator('[data-my-tab="notes"]').click();
   assert.equal(await page.locator('#myRecipesGrid .du-personal-card').count(),1,'Saved note visible');
   assert.match(await page.locator('#myRecipesCount').innerText(),/1 заметка/);
   await page.locator('#myRecipesGrid [data-my-open]').first().click();
   await page.locator('#addShopping').click();
   await page.goto(base+'#my-recipes',{waitUntil:'domcontentloaded'});
   await page.locator('[data-my-tab="menus"]').click();
   assert.equal(await page.locator('#myRecipesMenusPanel').isVisible(),true);
   await page.locator('#myMenuName').fill('Наш проверочный ужин');
   await page.locator('#mySaveMenu').click();
   assert.equal(await page.locator('#mySavedMenusList .du-saved-menu').count(),1);
   await page.locator('button.shopping-open').click();
   await page.locator('.shop-recipe-line [data-remove]').first().click();
   await page.locator('#closeShopping').click();
   await page.locator('#mySavedMenusList [data-menu-load]').click();
   assert.equal(await page.locator('.shop-recipe-line').count(),1,'Menu restores shopping list');
   await page.locator('#closeShopping').click();
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('[data-my-tab="menus"]').click();
   assert.equal(await page.locator('#mySavedMenusList .du-saved-menu').count(),1,'Menus survive reload');
   await page.locator('[data-my-tab="notes"]').click();
   assert.equal(await page.locator('#myRecipesGrid .du-personal-card').count(),1,'Notes survive reload');
   if(width===390){
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(overflow>2){
     const offenders=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(el=>({el,box:el.getBoundingClientRect()})).filter(x=>x.box.width>0&&x.box.right>document.documentElement.clientWidth+2).slice(0,25).map(x=>({tag:x.el.tagName,id:x.el.id,cls:String(x.el.className).slice(0,90),left:Math.round(x.box.left),right:Math.round(x.box.right),width:Math.round(x.box.width),scrollWidth:x.el.scrollWidth})));
     console.error('Mobile overflow diagnostics:',JSON.stringify(offenders));
    }
    assert.ok(overflow<=2,'Mobile overflow: '+overflow);
   }
   assert.deepEqual(errors,[],'No JavaScript runtime errors');
   console.log('PASS smart search, favorites, notes, menus, persistence',width);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
