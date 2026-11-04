const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async function() {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({
    viewport:{width:1440,height:900},
    deviceScaleFactor:1,
    locale:'ru-RU',
    reducedMotion:'reduce'
  });
  const errors=[];
  page.on('pageerror',e => errors.push(String(e)));
  const response = await page.goto('http://127.0.0.1:8765/landing.html',{waitUntil:'networkidle'});
  if (!response || response.status()!==200) throw Error('Real landing not served');
  await page.evaluate(async()=>{
    for (const img of document.images) img.loading='eager';
    await document.fonts.ready;
    await Promise.all([...document.images].map(async img => {
      if (!img.complete) await new Promise((resolve,reject)=>{
        img.addEventListener('load',resolve,{once:true});
        img.addEventListener('error',()=>reject(Error(img.src)),{once:true});
      });
      if (img.naturalWidth===0) throw Error('Missing image: '+img.src);
    }));
  });
  const assets=await page.locator('img').evaluateAll(images => images.map(img => ({
    src: new URL(img.src).pathname, width:img.naturalWidth,height:img.naturalHeight
  })));
  if (assets.length < 5) throw Error('Expected actual approved photos missing');
  if (errors.length) throw Error('Browser errors: '+errors.join('; '));
  fs.mkdirSync('exports',{recursive:true});
  await page.screenshot({path:'exports/snachala-uzhin-landing-exact-desktop.png',fullPage:true,animations:'disabled'});
  const pageHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
  console.log(JSON.stringify({source:'landing.html',width:1440,height:pageHeight,assets},null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
