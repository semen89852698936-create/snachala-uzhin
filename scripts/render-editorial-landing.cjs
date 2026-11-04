const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const output=[];
 try{
   fs.mkdirSync('exports',{recursive:true});
   for(const test of [
     {name:'approved-original-desktop',route:'landing.html',width:1440,height:900},
     {name:'editorial-desktop',route:'landing-editorial.html',width:1440,height:900},
     {name:'editorial-mobile',route:'landing-editorial.html',width:390,height:844}
   ]){
     const page=await browser.newPage({viewport:{width:test.width,height:test.height},
       deviceScaleFactor:1,locale:'ru-RU',reducedMotion:'reduce'});
     const failures=[];
     page.on('pageerror',e=>failures.push('script: '+e.message));
     page.on('requestfailed',r=>failures.push('request: '+r.url()));
     const response=await page.goto('http://127.0.0.1:8765/'+test.route,
         {waitUntil:'networkidle',timeout:35000});
     if(!response||response.status()!==200)throw Error('Page not served '+test.route);
     await page.evaluate(async()=>{
        for(const img of document.images)img.loading='eager';
        await document.fonts.ready;
        await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise((ok,bad)=>{
          img.addEventListener('load',ok,{once:true});img.addEventListener('error',bad,{once:true});
        })));
     });
     const actual=await page.evaluate(()=>({
        images:[...document.images].map(i=>({path:new URL(i.src).pathname,loaded:i.naturalWidth>0})),
        width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
        headings:[...document.querySelectorAll('h1')].map(x=>x.textContent.trim())
     }));
     if(actual.images.length!==5||actual.images.some(i=>!i.loaded))throw Error('Approved photos missing: '+JSON.stringify(actual.images));
     if(actual.width>test.width+1)throw Error('Horizontal overflow '+test.name+' width '+actual.width);
     if(failures.length)throw Error('Browser issues '+test.name+': '+failures.join(' / '));
     if(test.route==='landing-editorial.html'){
       for(const anchor of ['inside','demo','evening','price']){
         if(!await page.locator('#'+anchor).count())throw Error('Missing anchor '+anchor);
       }
       const text=await page.locator('body').innerText();
       for(const term of ['1 900 ₽','Готовьте вместе.','Под что продолжить','Наш вечер']){
          if(!text.includes(term))throw Error('Missing approved copy '+term);
       }
     }
     const file='exports/snachala-'+test.name+'.png';
     await page.screenshot({path:file,fullPage:true,animations:'disabled'});
     output.push({file,height:actual.height,images:actual.images.length,width:test.width});
     await page.close();
   }
   console.log('EDITORIAL-LANDING-OK '+JSON.stringify(output));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
