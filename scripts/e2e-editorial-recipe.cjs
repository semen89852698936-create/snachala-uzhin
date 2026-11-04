/* Browser regression: real 1001-recipe data, zero extra step photos. */
const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const outcomes=[];
 try{
  fs.mkdirSync('exports',{recursive:true});
  for(const route of ['index.html','full-catalog/index.html']){
   for(const viewport of [{name:'desktop',width:1440,height:900},{name:'phone',width:390,height:844}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},locale:'ru-RU',reducedMotion:'reduce'});
    const problems=[];
    page.on('pageerror',err=>{problems.push(String(err));console.error('PAGEERROR',route,viewport.name,String(err));});
    page.on('response',res=>{if(res.url().includes('editorial-recipe'))console.log('ASSET RESPONSE',res.status(),res.url());});
    const response=await page.goto('http://127.0.0.1:8769/'+route+'#recipe=focaccia',{waitUntil:'domcontentloaded',timeout:35000});
    if(!response||response.status()!==200)throw Error(route+' not served');
    await page.waitForTimeout(1800);
    console.log('BOOT DIAGNOSTIC',route,viewport.name,await page.evaluate(()=>({
      hash:location.hash,recipeViewHidden:document.getElementById('recipeView')?.hidden,
      detailLength:document.getElementById('recipeDetail')?.innerHTML.length,
      existing:document.querySelectorAll('#recipeDetail .du-film-card').length,
      editorial:document.querySelectorAll('#recipeDetail .er-overview-number').length,
      renderRecipe:typeof window.renderRecipe,renderCook:typeof window.renderCook,
      link:!!document.querySelector('link[href*="editorial-recipe"]'),
      script:!!document.querySelector('script[src*="editorial-recipe"]')
    })));
    await page.waitForSelector('#recipeDetail .er-overview-number',{timeout:3000});
    const overview=await page.evaluate(()=>({
      steps:document.querySelectorAll('#recipeDetail .du-film-card').length,
      ordinal:document.querySelectorAll('#recipeDetail .er-overview-number').length,
      placeholders:document.querySelectorAll('#recipeDetail .du-film-placeholder').length,
      image:document.querySelector('#recipeDetail .recipe-intro-photo img')?.getAttribute('src'),
      width:document.documentElement.scrollWidth
    }));
    if(overview.steps!==5||overview.ordinal!==5||overview.placeholders!==0)
      throw Error('Focaccia overview still contains fake step photos '+JSON.stringify(overview));
    if(overview.width>viewport.width+1)throw Error('Overview overflow '+route+' '+viewport.name+' '+overview.width);
    await page.locator('#startCookingBottom').click();
    await page.locator('#cookContent .er-cook-grid').waitFor({timeout:8000});
    const first=await page.evaluate(()=>({
      image:document.querySelector('#cookContent .er-cook-photo img')?.getAttribute('src'),
      loaded:document.querySelector('#cookContent .er-cook-photo img')?.naturalWidth||0,
      heading:document.querySelector('#cookContent .er-cook-step h2')?.textContent,
      active:document.querySelector('#cookContent [aria-current="step"]')?.textContent,
      timer:!!document.getElementById('timerStart'),
      width:document.documentElement.scrollWidth
    }));
    if(first.heading!=='Замеси тесто'||first.active!=='1'||first.timer)
      throw Error('First step wrong '+JSON.stringify(first));
    if(first.image!==overview.image)throw Error('Hero and step photo differ: '+JSON.stringify(first));
    await page.locator('#nextStep').click();
    const second=await page.evaluate(()=>({
      image:document.querySelector('#cookContent .er-cook-photo img')?.getAttribute('src'),
      heading:document.querySelector('#cookContent .er-cook-step h2')?.textContent,
      active:document.querySelector('#cookContent [aria-current="step"]')?.textContent,
      timer:!!document.getElementById('timerStart')
    }));
    if(second.heading!=='Дай подняться'||second.active!=='2'||!second.timer||second.image!==first.image)
      throw Error('Step 2 does not retain the finished food image '+JSON.stringify(second));
    await page.locator('#prevStep').click();
    if((await page.locator('#cookContent .er-cook-step h2').innerText())!=='Замеси тесто')throw Error('Back does not work');
    await page.locator('#cookContent .er-progress-button').nth(4).click();
    if((await page.locator('#cookContent .er-cook-step h2').innerText())!=='Испеки')throw Error('Direct navigation fails');
    const stepsImages=await page.locator('#cookContent .er-cook-photo img').count();
    if(stepsImages!==1)throw Error('More than one photo in cooking UI');
    await page.locator('#nextStep').click();
    if(!await page.locator('#cookContent .done-title').count())throw Error('Done state missing');
    await page.locator('#restartCook').click();
    if((await page.locator('#cookContent .er-cook-step h2').innerText())!=='Замеси тесто')throw Error('Restart fails');
    await page.locator('#closeCook').click();
    if(!await page.locator('#cookOverlay').isHidden())throw Error('Close fails');
    if(problems.length)throw Error('Browser JS errors: '+problems.join('; '));
    await page.locator('#startCookingBottom').click();
    await page.locator('#cookContent .er-cook-photo img').evaluate(img=>img.decode().catch(()=>{}));
    const screenshot='exports/recipe-editorial-'+(route==='index.html'?'main':'full')+'-'+viewport.name+'.png';
    await page.screenshot({path:screenshot,fullPage:false,animations:'disabled'});
    const layout=await page.evaluate(()=>({
      viewport:window.innerWidth,
      scrollWidth:document.documentElement.scrollWidth,
      cookWidth:document.querySelector('#cookOverlay .cook-sheet').scrollWidth,
      frameWidth:document.querySelector('#cookOverlay .cook-sheet').clientWidth,
      photoLoaded:document.querySelector('#cookContent .er-cook-photo img').naturalWidth>0
    }));
    if(layout.scrollWidth>viewport.width+1||layout.cookWidth>layout.frameWidth+2||!layout.photoLoaded)
       throw Error('Viewport/photo failure '+route+' '+JSON.stringify(layout));
    outcomes.push({route,viewport:viewport.name,screenshot,overview,layout});
    await page.close();
   }
  }
  // Ensure 1001 original recipes are unchanged in each HTML variant.
  const res=await fetch('http://127.0.0.1:8769/index.html');
  const html=await res.text();
  const raw=html.match(/<script[^>]*id="recipeData"[^>]*>([\s\S]*?)<\/script>/);
  if(!raw||JSON.parse(raw[1]).length!==1001)throw Error('1001-recipe data integrity failed');
  console.log('EDITORIAL_RECIPE_PASS '+JSON.stringify(outcomes));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
