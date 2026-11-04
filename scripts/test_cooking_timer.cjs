'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
for(const file of ['index.html','full-catalog/index.html']){
 const html=fs.readFileSync(file,'utf8');
 const dataStart=html.indexOf('id="recipeData"');
 assert.ok(dataStart>0,file+': missing catalog data');
 const begin=html.indexOf('>',dataStart)+1;
 const recipes=JSON.parse(html.slice(begin,html.indexOf('</script>',begin)));
 assert.equal(recipes.length,1001,file+': 1001 recipes must remain');
 assert.ok(recipes.some(r=>r.steps.some(s=>s.timer)),file+': recipes have no step timers');
 const a=html.indexOf('function saveCookingTimer()');
 const b=html.indexOf('function openCook(id)',a);
 assert.ok(a>=0&&b>a,file+': resilient cooking timer code missing');
 const timer=html.slice(a,b);
 for(const token of ['COOK_TIMER_STORAGE','localStorage.setItem','localStorage.getItem',
  'Date.now()','function finishCookingTimer()','function restoreCookingTimer()',
  "document.addEventListener('visibilitychange'","window.addEventListener('pageshow'",
  "window.addEventListener('focus'","window.addEventListener('storage'",
  'Notification.requestPermission','navigator.serviceWorker.register','showNotification',
  'createOscillator','function pauseCookingTimer()']){
  assert.ok(html.includes(token),file+': missing '+token);
 }
 assert.ok(html.includes('id="timerStatusNote" role="status"'),file+': persistent alarm message missing');
 assert.ok(html.includes('restoreCookingTimer();renderCategories()'),file+': reload restoration missing');
 assert.ok(!html.includes("function closeCook(){clearTimer();"),file+': timer still canceled on closing overlay');
 assert.ok(html.includes('state.timerStatus===\'paused\'?state.timerRemaining:step.timer*60'),file+': pause/resume missing');
 const beginApp=html.lastIndexOf('<script>',a)+8;
 new vm.Script(html.slice(beginApp,html.indexOf('</script>',beginApp)),{filename:file});
 console.log('PASS resilient cooking timer',file,recipes.length,'recipes');
}
const worker=fs.readFileSync('cooking-timer-sw.js','utf8');
assert.ok(worker.includes("notificationclick"),'mobile notification worker missing');
assert.ok(!worker.includes("fetch'"),'notification worker must not change offline/cache behavior');
console.log('PASS mobile notification worker');
