#!/usr/bin/env node
'use strict';
/* Standalone editorial preview of 100 draft soups.
   This file does not modify the public НАШ ВЕЧЕР site. */
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname, data=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_RECIPES.json'),'utf8'));
if(data.recipes.length!==100) throw Error('Expected exactly 100 recipes');
const briefs=JSON.parse(fs.readFileSync(path.join(dir,'PHOTO_PRODUCTION_BRIEFS_100.json'),'utf8')).specifications;
if(briefs.length!==100)throw Error('Missing unique photo briefs');
const photoMap=new Map(briefs.map(b=>[b.id,b]));
const timerData=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_STEP_TIMER_PHASES.json'),'utf8'));
if(timerData.recipes.length!==100||timerData.stats.steps!==504)throw Error('Timer plan must cover 100 recipes and 504 steps');
const timerMap=new Map(timerData.recipes.map(b=>[b.id,b]));
if(timerData.recipes.some(x=>x.steps.length!==data.recipes[x.id-1].steps.length))throw Error('Timer to recipe step count mismatch');
const duration=s=>s>=3600?(s/3600).toFixed(s%3600?1:0)+' ч':s>=60?Math.round(s/60)+' мин':s+' сек';
const timerBadge=(phase,id,step)=>'<button class="timer-control" type="button" data-timer-id="'+id+'-'+step+'-'+phase.phase+'" data-seconds="'+phase.min_seconds+'" aria-label="Запустить таймер '+esc(phase.quoted_duration)+'">'+
'⏱ '+esc(phase.quoted_duration)+' · запустить</button>'+
(phase.start_mode==='RELATIVE_TO_OTHER_ACTION'?'<small class="timer-warning">Запуск только в указанной стадии действия.</small>':'')+
(phase.max_seconds>phase.min_seconds?'<small class="timer-hint">Сначала '+duration(phase.min_seconds)+', верхняя граница '+duration(phase.max_seconds)+'. Проверить готовность.</small>':'');

for(const r of data.recipes){if(!photoMap.has(r.id)||photoMap.get(r.id).title!==r.title)throw Error('Photo brief mismatch '+r.id)}
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const menu=[...new Set(data.recipes.map(x=>x.country_cuisine))];
const cards=data.recipes.map(x=>{
const links=x.recipe_sources.map((url,i)=>'<a href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">Источник '+(i+1)+'</a>').join('');
return '<article class="recipe" id="recipe-'+x.id+'" data-search="'+esc((x.title+' '+x.country_cuisine+' '+x.ingredients_text).toLowerCase())+'">'+
'<div class="eyebrow">'+esc(x.country_cuisine)+' <span>№ '+x.id+'</span></div>'+
'<h2>'+esc(x.title)+'</h2><p class="portion">На двоих · Редакционная версия, не утверждена</p>'+
'<div class="photo-notice"><strong>Требования к будущей фотографии:</strong> '+esc(photoMap.get(x.id).required_appearance)+'<br><small>Изображение для публикации не создано и не утверждено.</small></div>'+
'<h3>Продукты</h3><ul>'+x.ingredient_items.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>'+
'<h3>Готовим</h3><ol>'+x.steps.map((i,n)=>'<li>'+esc(i)+(timerMap.get(x.id).steps[n].phases.length?'<div class="timers">'+timerMap.get(x.id).steps[n].phases.map(p=>timerBadge(p,x.id,n+1)).join('')+'</div>':'')+(timerMap.get(x.id).steps[n].completion_condition==='CHECK_PRODUCT_READINESS'?'<small class="timer-warning">Проверить готовность по тексту шага, не только по секундомеру.</small>':'')+'</li>').join('')+'</ol>'+
'<h3>Рецептурные источники</h3><div class="links">'+links+'</div>'+
'<p class="fineprint">Три URL указаны для редакционной проверки. Независимое подтверждение содержания и визуальных образцов не завершено.</p></article>';
}).join('\n');
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>НАШ ВЕЧЕР | 100 супов мира | Редакционный просмотр</title><style>'+
':root{font-family:Georgia,"Times New Roman",serif;color:#382a28;background:#f4eadb}*{box-sizing:border-box}body{margin:0}header{background:#581e24;color:#fff3e5;padding:3rem max(5vw,1rem)}h1{font-size:clamp(2rem,5vw,4.5rem);line-height:1;margin:0 0 1rem}header p{max-width:55rem;line-height:1.6}.search{margin:1.4rem 0 0;padding:.85rem 1rem;width:min(100%,35rem);font:inherit;border:0;background:#fffaf3;color:#34221d}main{width:min(1100px,92vw);margin:2rem auto}.summary{line-height:1.5;margin-bottom:2rem}.recipe{background:#fffaf1;margin:0 0 2rem;padding:clamp(1rem,4vw,3rem);border-top:3px solid #79262b;box-shadow:0 8px 32px #3c221114}.recipe h2{font-size:clamp(1.8rem,4vw,2.8rem);margin:.5rem 0}.recipe h3{font-size:1.25rem;margin:1.7rem 0 .5rem}.recipe li{padding:.3rem 0;line-height:1.6}.recipe ol li{padding:.7rem 0}.timers{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin:.6rem 0}.timer-control{border:1px solid #a96f6f;background:#fff1e7;color:#5d2025;border-radius:.25rem;padding:.45rem .7rem;cursor:pointer;font:600 .82rem system-ui,sans-serif}.timer-control:focus-visible{outline:2px solid #581e24}.timer-control[data-active=running]{background:#f0cdb1}.timer-control[data-active=complete]{background:#dfe8d9}.timer-warning,.timer-hint{font: .72rem system-ui,sans-serif;color:#735547}.timer-hint{display:inline-block}.eyebrow{font-family:system-ui,sans-serif;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#8a2b33;display:flex;justify-content:space-between}.portion{color:#65554d;font-style:italic}.photo-notice{padding:1rem;border-left:2px solid #8c7061;background:#f1e5d5;margin:1rem 0;font-family:system-ui,sans-serif;font-size:.82rem}.links{display:flex;gap:1rem;flex-wrap:wrap}.links a{color:#81262b}.fineprint{font-family:system-ui,sans-serif;font-size:.72rem;color:#80736c;margin-top:1rem}footer{text-align:center;padding:2rem;font-size:.8rem;color:#80736c}@media print{header{color:#382a28;background:white}.search{display:none}.recipe{break-inside:avoid;box-shadow:none}}'+
'</style></head><body><header><h1>НАШ ВЕЧЕР<br>100 супов мира</h1><p>10 кухонь · по 10 супов · на двоих. Черновое редакционное издание. Не заменяет утверждённый сайт.</p><input id="search" class="search" placeholder="Найти суп или ингредиент…" aria-label="Поиск"></header><main><p class="summary">'+esc(menu.join(' · '))+'</p>'+cards+'</main><footer>Редакционная сборка. Не для публичной продажи или размещения.</footer><script>const s=document.querySelector("#search");s.addEventListener("input",()=>{const q=s.value.trim().toLowerCase();document.querySelectorAll(".recipe").forEach(e=>e.hidden=!e.dataset.search.includes(q))});const clocks=new Map();function fmt(t){t=Math.max(0,Math.ceil(t/1000));return String(Math.floor(t/3600)).padStart(2,"0")+":"+String(Math.floor(t%3600/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0")}function redraw(){const now=Date.now();for(const [id,state]of clocks){const b=Array.from(document.querySelectorAll(".timer-control")).find(e=>e.dataset.timerId===id);if(!b)continue;if(state.paused){b.textContent="▶ Продолжить "+fmt(state.remaining);b.dataset.active="paused";continue}const left=state.end-now;if(left<=0){b.textContent="✓ Время: проверь готовность";b.dataset.active="complete";clocks.delete(id);continue}b.textContent="⏸ Пауза "+fmt(left);b.dataset.active="running"}}document.addEventListener("click",ev=>{const b=ev.target.closest(".timer-control");if(!b)return;const id=b.dataset.timerId,old=clocks.get(id),now=Date.now();if(!old){clocks.set(id,{end:now+Number(b.dataset.seconds)*1000,paused:false,remaining:0})}else if(old.paused){old.end=now+old.remaining;old.paused=false}else{old.remaining=Math.max(0,old.end-now);old.paused=true}redraw()});setInterval(redraw,1000);</script></body></html>';
const out=path.join(dir,'dist');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),html,'utf8');
if([...html.matchAll(/class="recipe"/g)].length!==100)throw Error('Missing cards in HTML');
console.log('PASS: generated standalone preview for 100 recipes ('+Buffer.byteLength(html)+' bytes).');
