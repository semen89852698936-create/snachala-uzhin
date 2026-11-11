const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const url='https://snachala-uzhin-preview.vercel.app/#recipe=salmon-lemon';
 const results=[];
 for(const v of [{name:'desktop',width:1440,height:1080},{name:'mobile',width:390,height:844}]){
   const page=await browser.newPage({viewport:{width:v.width,height:v.height},deviceScaleFactor:1});
   const record={screen:v.name,url,errors:[]};
   page.on('pageerror',e=>record.errors.push(e.message));
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('#recipeView:not([hidden]) #recipeDetail .recipe-intro h1').waitFor({timeout:40000});
   await page.evaluate(()=>document.fonts.ready);
   await page.locator('#recipeDetail .recipe-intro-photo img').evaluate(async im=>{
     if(!im.complete) await new Promise(resolve=>{im.addEventListener('load',resolve,{once:true}); im.addEventListener('error',resolve,{once:true}); setTimeout(resolve,10000)});
   });
   await page.waitForTimeout(650);
   record.content=await page.evaluate(()=>{
     const intro=document.querySelector('#recipeDetail .recipe-intro');
     const photo=intro.querySelector('img');
     return {
       title:intro.querySelector('h1')?.textContent.trim(),
       description:intro.querySelector('.recipe-intro-copy > p')?.textContent.trim(),
       meta:[...intro.querySelectorAll('.recipe-intro-meta .pill')].map(e=>e.textContent.trim()),
       actions:[...intro.querySelectorAll('.recipe-action-row button')].map(e=>e.textContent.trim()),
       photoUrl:photo?.getAttribute('src'),
       photoLoaded:!!(photo?.complete&&photo.naturalWidth>0),
       ingredients:[...document.querySelectorAll('#recipeDetail .ingredient-check')].map(e=>e.textContent.trim().replace(/\s+/g,' ')),
       steps:[...document.querySelectorAll('#recipeDetail .du-editorial-step')].map(e=>e.querySelector('strong')?.textContent.trim()),
       width:document.documentElement.scrollWidth,viewport:innerWidth
     };
   });
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.waitForTimeout(200);
   await page.screenshot({path:'/tmp/salmon-card-'+v.name+'-viewport.png',fullPage:false});
   await page.locator('#recipeDetail .recipe-intro').screenshot({path:'/tmp/salmon-card-'+v.name+'-intro.png',timeout:30000});
   record.passed=record.content.title==='Лосось с лимоном'&&record.content.photoLoaded&&record.content.ingredients.length>0;
   results.push(record);
   console.log(JSON.stringify(record));
   await page.close();
 }
 fs.writeFileSync('/tmp/salmon-card-details.json',JSON.stringify(results,null,2));
 await browser.close();
 if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
