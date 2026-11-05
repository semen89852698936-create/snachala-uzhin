'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  // Exercise both catalogs at desktop and mobile widths, not just one route per viewport.
  for(const route of ['/','/full-catalog/']) for(const viewport of [{width:1280,height:820},{width:390,height:844}]){
   const page=await browser.newPage({viewport});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const url='http://127.0.0.1:8765'+route;
   await page.goto(url,{waitUntil:'domcontentloaded'});
   const id=await page.evaluate(()=>{
    const tag=document.getElementById('recipeData');
    const list=JSON.parse(tag.textContent);
    return list.find(r=>r.steps.some(s=>s.timer)&&r.steps.length>1).id;
   });
   await page.goto(url+'#recipe='+encodeURIComponent(id),{waitUntil:'domcontentloaded'});
   await page.locator('#startCooking').click();
   let timerStep=await page.evaluate(()=>{
    const step=byId(state.recipe).steps.findIndex(s=>s.timer);
    stepTo(step);
    return step;
   });
   await page.locator('#timerStart').click();
   let st=await page.evaluate(()=>JSON.parse(localStorage.getItem('su-active-cooking-timer-v1')));
   assert.equal(st.status,'running',route+': timer did not start');
   assert.equal(st.stepIndex,timerStep,route+': wrong timer step');
   await page.locator('#closeCook').click();
   st=await page.evaluate(()=>JSON.parse(localStorage.getItem('su-active-cooking-timer-v1')));
   assert.equal(st.status,'running',route+': closing cooking must not cancel running countdown');
   await page.locator('#startCooking').click();
   assert.equal(await page.locator('#timerStart').textContent(),'Ⅱ Пауза',route+': reopen must show running timer');
   await page.locator('#timerStart').click();
   st=await page.evaluate(()=>JSON.parse(localStorage.getItem('su-active-cooking-timer-v1')));
   assert.equal(st.status,'paused',route+': pause did not persist');
   const paused=st.remaining;
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#startCooking').click();
   assert.equal(await page.locator('#timerStart').textContent(),'▶ Продолжить',route+': pause did not survive reload');
   assert.equal(await page.evaluate(()=>state.timerRemaining),paused,route+': paused remaining changed');
   await page.locator('#timerStart').click();
   assert.equal(await page.locator('#timerStart').textContent(),'Ⅱ Пауза',route+': resume button failed');
   await page.evaluate(()=>{
    state.timerEnd=Date.now()-1; // simulated sleep / delayed browser callback
    tickTimer();
   });
   await page.locator('#timerStatusNote.du-timer-done').waitFor();
   assert.match(await page.locator('#timerStatusNote').textContent(),/Время вышло/,route+': no completion message');
   st=await page.evaluate(()=>JSON.parse(localStorage.getItem('su-active-cooking-timer-v1')));
   assert.equal(st.status,'finished',route+': finish not persisted');
   assert.equal(st.notified,true,route+': notification guard not persisted');
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#startCooking').click();
   assert.match(await page.locator('#timerStatusNote').textContent(),/Время вышло/,route+': completion not restored after reload');
   await page.locator('#nextStep').click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('su-active-cooking-timer-v1')),null,route+': moving step should clean up timer');
   assert.deepEqual(errors,[],route+': uncaught page errors');
   console.log('PASS',route,viewport.width+'px','pause/reload/sleep/reopen/finished/clear');
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
