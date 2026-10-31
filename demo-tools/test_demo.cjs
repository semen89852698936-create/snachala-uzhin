const {chromium,devices}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const out=path.join(__dirname,'results');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch();const report=[];
try{for(const device of ['desktop','mobile']){
const ctx=await browser.newContext(device==='mobile'?devices['iPhone 13']:{viewport:{width:1440,height:900}});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const home=await page.goto('http://127.0.0.1:8765/demo/index.html',{waitUntil:'domcontentloaded'});
assert.equal(home.status(),200);assert.equal(await page.locator('#our-evening-demo-link').count(),1);
await page.screenshot({path:path.join(out,device+'-home.png'),fullPage:true,timeout:30000});
await page.locator('#our-evening-demo-link').click();
assert.match(page.url(),/nashe-vecher.html/);
await page.waitForFunction(()=>document.querySelector('#loadStatus')?.textContent.includes('1001'),{timeout:30000});
await page.locator('#suggest').click();
assert.match(await page.locator('#menuSummary').textContent(),/Суммарное время/);
await page.locator('#mainDish').selectOption({index:1});const first=page.locator('#steps input[type=checkbox]').first();await first.check();await page.locator('#swap').click();assert.equal(await first.isChecked(),true);
await page.screenshot({path:path.join(out,device+'-evening.png'),fullPage:true,timeout:30000});
assert.deepEqual(errors,[]);
report.push({device,status:'PASS',checks:['approved homepage','demo navigation','1001 recipes','menu','role progress','screenshots']});await ctx.close();
}}finally{await browser.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
