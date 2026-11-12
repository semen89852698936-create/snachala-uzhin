'use strict';
// End-to-end safety net for «Мои рецепты» and a grocery list shared by several dishes.
// Never relies on external photo/CDN requests.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const entry of ['','full-catalog/']){
      for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
        const page=await browser.newPage({viewport});
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/*',route=>{
          const host=new URL(route.request().url()).hostname;
          return host==='127.0.0.1'?route.continue():route.abort();
        });
        const base='http://127.0.0.1:8765/'+entry;
        const goto=hash=>page.goto((hash==='my-recipes' && entry ? 'http://127.0.0.1:8765/#my-recipes' : base+'#'+hash),{waitUntil:'domcontentloaded'}); // Personal collection is on the home route; assert cross-catalogue persistence.

        // Favorite a real recipe through the same control the reader uses.
        await goto('recipe=tomato-basil-pasta');
        await page.locator('#recipeFav').click();
        await goto('my-recipes');
        await page.locator('[data-my-edit="tomato-basil-pasta"]').click();
        const note=page.locator('[data-my-note="tomato-basil-pasta"]');
        await note.waitFor();
        assert.equal(await page.locator('#myRecipesGrid .du-personal-card').count(),1,
          'Favoriting creates a real personal recipe card');
        const noteText='Больше базилика; подать на тёплых тарелках.';
        await note.fill(noteText);
        await page.locator('[data-my-save="tomato-basil-pasta"]').click();
        await page.reload({waitUntil:'domcontentloaded'});
        assert.equal(await page.locator('[data-my-note="tomato-basil-pasta"]').inputValue(),noteText,
          'Personal note must survive reload');
        assert.equal(await page.locator('#myRecipesGrid .du-personal-card').count(),1,
          'Favorite must survive reload');

        // Add a second favorite and verify both stay distinct after reloading.
        await goto('recipe=lemon-spinach-pasta');
        await page.locator('#recipeFav').click();
        await goto('my-recipes');
        assert.equal(await page.locator('#myRecipesGrid .du-personal-card').count(),2,
          'Two saved dishes must appear without duplicates');
        await page.reload({waitUntil:'domcontentloaded'});
        assert.equal(await page.locator('#myRecipesGrid .du-personal-card').count(),2,
          'Both favorites survive reload');

        // Add both complete dishes from their public recipe pages.
        await goto('recipe=lemon-spinach-pasta');
        await page.locator('#addShopping').click();
        await goto('recipe=tomato-basil-pasta');
        await page.locator('#addShopping').click();
        await page.locator('.shopping-open').first().click();
        assert.equal(await page.locator('#shoppingContents .shop-recipe-line').count(),2,
          'Shopping list must contain two separate chosen recipes');

        // Compute expected aggregated groceries directly from raw catalog data,
        // not from the app's aggregation function under test.
        const expected=await page.evaluate(()=>{
          const data=JSON.parse(document.getElementById('recipeData').textContent);
          const ids=['lemon-spinach-pasta','tomato-basil-pasta'];
          const grouped=new Map();
          for(const id of ids){
            const recipe=data.find(row=>row.id===id);
            if(!recipe)throw Error('Missing real fixture: '+id);
            for(const ingredient of recipe.ingredients){
              const name=ingredient.name.toLocaleLowerCase('ru-RU').replace(/ё/g,'е').normalize('NFKC');
              if(['вода от варки пасты','вода теплая'].includes(name))continue;
              const key=name+'|'+ingredient.unit;
              const row=grouped.get(key)||{name:ingredient.name,unit:ingredient.unit,amount:0};
              row.amount+=ingredient.amount;
              grouped.set(key,row);
            }
          }
          return {count:grouped.size,overlap:
            [...grouped.values()].filter(row=>ids.every(id=>{
              const recipe=data.find(r=>r.id===id);
              return recipe.ingredients.some(i=>i.name===row.name&&i.unit===row.unit);
            })).map(row=>row.name)};
        });
        assert.equal(await page.locator('#shoppingContents .shop-item').count(),expected.count,
          'Repeated ingredients must be merged into one shopping line');
        assert.ok(expected.overlap.length>0,
          'Two recipe fixtures should share at least one exact ingredient to test combining');
        for(const name of expected.overlap){
          assert.equal(await page.locator('#shoppingContents .shop-item span').filter({hasText:name}).count(),1,
            'Shared ingredient must appear once: '+name);
        }
        await page.locator('#closeShopping').click();

        // Re-adding an already selected recipe must not double the total.
        await page.locator('#addShopping').click();
        await page.locator('.shopping-open').first().click();
        assert.equal(await page.locator('#shoppingContents .shop-item').count(),expected.count,
          'Repeated add-to-shopping click must not duplicate products');
        await page.reload({waitUntil:'domcontentloaded'});
        await page.locator('.shopping-open').first().click();
        assert.equal(await page.locator('#shoppingContents .shop-recipe-line').count(),2,
          'Both selected recipes must persist after reload');
        assert.equal(await page.locator('#shoppingContents .shop-item').count(),expected.count,
          'Aggregated grocery list must persist after reload');
        await page.locator('#closeShopping').click();

        // Personal notes must stay attached to their dish, not to list position.
        await goto('my-recipes');
        assert.equal(await page.locator('[data-my-note="tomato-basil-pasta"]').inputValue(),noteText);
        await page.locator('[data-my-remove="tomato-basil-pasta"]').click();
        assert.equal(await page.locator('#myRecipesGrid .du-personal-card').count(),1,
          'Remove favorite updates the collection immediately');
        assert.equal(await page.locator('[data-my-note="tomato-basil-pasta"]').count(),0,
          'Removed favorite must disappear from personal collection');
        await goto('recipe=tomato-basil-pasta');
        await page.locator('#recipeFav').click();
        await goto('my-recipes');
        assert.equal(await page.locator('[data-my-note="tomato-basil-pasta"]').inputValue(),noteText,
          'Saved note remains associated with the recipe when favorited again');

        if(viewport.width<500){
          const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
          assert.ok(overflow<=2,'Personal collection should not overflow mobile viewport: '+overflow);
        }
        assert.deepEqual(errors,[],'No JS exceptions: '+errors.join(', '));
        console.log('PASS',entry||'index.html',viewport.width+'px',
          'favorites, personal notes, two-recipe groceries, deduplication, reload');
        await page.close();
      }
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});