'use strict';
/* Regression: separate airfryer page, distinct large-category photos and Russian noun/adjective equivalence. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {matches,filterRecipes}=require('../assets/airfryer-experience-20261110.js');
const fixture=(title,cat,ingredients=[])=>({title,description:'',airfryer:{sourceCategory:cat},ingredients:ingredients.map(name=>({name}))});
assert.equal(matches(fixture('Говяжьи медальоны','Мясо'),'говядина'),true);
assert.equal(matches(fixture('Свинина под горчицей','Мясо'),'свиные'),true);
assert.equal(matches(fixture('Куриные крылья','Птица'),'курица'),true);
assert.equal(matches(fixture('Индюшиные колбаски','Птица'),'индейка'),true);
assert.equal(matches(fixture('Картофель с розмарином','Овощи и гарниры'),'картошка'),true);
assert.equal(matches(fixture('Говяжьи медальоны с грибами','Мясо',['Картофель']),'говядина, картошка'),true);
assert.equal(matches(fixture('Свиной шницель','Мясо'),'говядина'),false);
assert.equal(filterRecipes([fixture('Свиной шницель','Мясо'),fixture('Куриные крылья','Птица')],'Птица','').length,1);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
     const u=new URL(route.request().url());
     return u.hostname==='127.0.0.1'?route.continue():route.abort();
   });
   for(const entry of ['','full-catalog/']){
     await page.goto('http://127.0.0.1:8765/'+entry+'#airfryer',{waitUntil:'domcontentloaded'});
     const cards=page.locator('#airfryerCategoryGrid .category-card');
     await cards.first().waitFor();
     assert.equal(await cards.count(),8,'Home shows eight large category links rather than 100 recipe cards');
     assert.equal(await page.locator('#airfryerGrid').count(),0,'Recipe grid only belongs to the dedicated page');
     const airPhotos=await cards.locator('img').evaluateAll(images=>images.map(img=>new URL(img.src).pathname));
     const mainPhotos=await page.locator('#categoryGrid .category-card img').evaluateAll(images=>images.map(img=>new URL(img.src).pathname));
     assert.equal(new Set(airPhotos).size,8,'All eight airfryer entry photos are distinct');
     assert.ok(airPhotos.every(src=>!mainPhotos.includes(src)),'Do not reuse the original 1001-category photos');
     assert.equal(await cards.first().getAttribute('href'),'/airfryer/?category='+encodeURIComponent('Все блюда'));
   }
   await page.goto('http://127.0.0.1:8765/airfryer/?category='+encodeURIComponent('Птица'),{waitUntil:'domcontentloaded'});
   await page.locator('#airfryerGrid .du-airfryer-card').first().waitFor();
   assert.equal(await page.locator('#airfryerGrid .du-airfryer-card').count(),20,'Deep link applies the poultry filter');
   assert.ok(await page.locator('.du-airfryer-home-link').isVisible(),'Back-to-home link exists');
   await page.locator('[data-airfryer-filter="Все блюда"]').click();
   assert.equal(await page.locator('#airfryerGrid .du-airfryer-card').count(),100,'All 100 recipes are intact');
   const pic=page.locator('#airfryerGrid .du-airfryer-card img').first();
   await pic.scrollIntoViewIfNeeded();
   await pic.evaluate(async img=>{img.loading='eager';if(!img.complete)await new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});});});
   assert.ok(await pic.evaluate(img=>img.naturalWidth>0),'Airfryer recipe photo loads on the dedicated route');
   const search=page.locator('#airfryerSearch');
   async function equivalent(first,second){
     await search.fill(first);
     const n=await page.locator('#airfryerGrid .du-airfryer-card').count();
     assert.ok(n>0,first+' should find recipes');
     await search.fill(second);
     assert.equal(await page.locator('#airfryerGrid .du-airfryer-card').count(),n,'Word forms should match: '+first+' / '+second);
   }
   await equivalent('говядина','говяжьи');
   await equivalent('свинина','свиные');
   await equivalent('курица','куриные');
   await equivalent('индейка','индюшиные');
   await equivalent('картофель','картошка');
   await search.fill('клюква');
   assert.equal(await page.locator('#airfryerGrid .du-airfryer-card').count(),1,'Cranberry identifies turkey medallions');
   const modelNote='Время и температура могут отличаться в зависимости от модели аэрогриля. Ориентируйтесь на инструкцию производителя именно вашего прибора.';
   const runtime=await page.evaluate(note=>({count:window.AIRFRYER_RECIPES.length,allNotes:window.AIRFRYER_RECIPES.every(r=>String(r.warn||'').includes(note))}),modelNote);
   assert.equal(runtime.count,100);
   assert.equal(runtime.allNotes,true);
   await page.locator('[data-airfryer-open="af-turkey-medallions-cranberry-2"]').click();
   await page.locator('#recipeView').waitFor({state:'visible'});
   assert.equal(await page.locator('#recipeDetail .du-airfryer-specs').count(),1);
   assert.equal(await page.locator('#recipeDetail .du-airfryer-spec strong').first().innerText(),'185 °C');
   assert.ok((await page.locator('#recipeDetail .allergen-text').innerText()).includes(modelNote));
   const text=await page.locator('#recipeDetail').innerText();
   for(const forbidden of ['Источник:','Статус испытаний:','Открыть источник рецепта'])
     assert.ok(!text.includes(forbidden),'Internal editorial annotation must not appear: '+forbidden);
   assert.equal(await page.locator('#recipeDetail .portion-picker button').count(),0,'Portions remain fixed at two');
   await page.locator('#startCooking').click();
   assert.equal(await page.locator('#cookOverlay').isVisible(),true);
   await page.locator('#closeCook').click();
   await page.locator('#backCatalog').click();
   await page.locator('#airfryerGrid .du-airfryer-card').first().waitFor();
   assert.ok(page.url().includes('/airfryer/'),'Recipe back button stays within airfryer catalogue');
   assert.deepEqual(errors,[],'No JavaScript page errors at '+viewport.width+'px');
   await page.close();
  }
  console.log('Airfryer UX PASS: two home variants, distinct image categories, 100 recipes, RU word forms, recipe and cooking flow (desktop/mobile).');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
