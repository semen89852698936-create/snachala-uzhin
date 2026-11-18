#!/usr/bin/env node
'use strict';
/* Standalone editorial preview of 100 draft soups.
   This file does not modify the public НАШ ВЕЧЕР site. */
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname, data=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_RECIPES.json'),'utf8'));
if(data.recipes.length!==100) throw Error('Expected exactly 100 recipes');
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const menu=[...new Set(data.recipes.map(x=>x.country_cuisine))];
const cards=data.recipes.map(x=>{
const links=x.recipe_sources.map((url,i)=>'<a href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">Источник '+(i+1)+'</a>').join('');
return '<article class="recipe" id="recipe-'+x.id+'" data-search="'+esc((x.title+' '+x.country_cuisine+' '+x.ingredients_text).toLowerCase())+'">'+
'<div class="eyebrow">'+esc(x.country_cuisine)+' <span>№ '+x.id+'</span></div>'+
'<h2>'+esc(x.title)+'</h2><p class="portion">На двоих · Редакционная версия, не утверждена</p>'+
'<div class="photo-notice">Фотография для этой карточки ещё не прошла проверку.</div>'+
'<h3>Продукты</h3><ul>'+x.ingredient_items.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>'+
'<h3>Готовим</h3><ol>'+x.steps.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ol>'+
'<h3>Рецептурные источники</h3><div class="links">'+links+'</div>'+
'<p class="fineprint">Три URL указаны для редакционной проверки. Независимое подтверждение содержания и визуальных образцов не завершено.</p></article>';
}).join('\n');
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>НАШ ВЕЧЕР | 100 супов мира | Редакционный просмотр</title><style>'+
':root{font-family:Georgia,"Times New Roman",serif;color:#382a28;background:#f4eadb}*{box-sizing:border-box}body{margin:0}header{background:#581e24;color:#fff3e5;padding:3rem max(5vw,1rem)}h1{font-size:clamp(2rem,5vw,4.5rem);line-height:1;margin:0 0 1rem}header p{max-width:55rem;line-height:1.6}.search{margin:1.4rem 0 0;padding:.85rem 1rem;width:min(100%,35rem);font:inherit;border:0;background:#fffaf3;color:#34221d}main{width:min(1100px,92vw);margin:2rem auto}.summary{line-height:1.5;margin-bottom:2rem}.recipe{background:#fffaf1;margin:0 0:2rem;padding:clamp(1rem,4vw,3rem);border-top:3px solid #79262b;box-shadow:0 8px 32px #3c221114}.recipe h2{font-size:clamp(1.8rem,4vw,2.8rem);margin:.5rem 0}.recipe h3{font-size:1.25rem;margin:1.7rem 0 .5rem}.recipe li{padding:.3rem 0;line-height:1.6}.recipe ol li{padding:.7rem 0}.eyebrow{font-family:system-ui,sans-serif;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#8a2b33;display:flex;justify-content:space-between}.portion{color:#65554d;font-style:italic}.photo-notice{padding:1rem;border-left:2px solid #8c7061;background:#f1e5d5;margin:1rem 0;font-family:system-ui,sans-serif;font-size:.82rem}.links{display:flex;gap:1rem;flex-wrap:wrap}.links a{color:#81262b}.fineprint{font-family:system-ui,sans-serif;font-size:.72rem;color:#80736c;margin-top:1rem}footer{text-align:center;padding:2rem;font-size:.8rem;color:#80736c}@media print{header{color:#382a28;background:white}.search{display:none}.recipe{break-inside:avoid;box-shadow:none}}'+
'</style></head><body><header><h1>НАШ ВЕЧЕР<br>100 супов мира</h1><p>10 кухонь · по 10 супов · на двоих. Черновое редакционное издание. Не заменяет утверждённый сайт.</p><input id="search" class="search" placeholder="Найти суп или ингредиент…" aria-label="Поиск"></header><main><p class="summary">'+esc(menu.join(' · '))+'</p>'+cards+'</main><footer>Редакционная сборка. Не для публичной продажи или размещения.</footer><script>const s=document.querySelector("#search");s.addEventListener("input",()=>{const q=s.value.trim().toLowerCase();document.querySelectorAll(".recipe").forEach(e=>e.hidden=!e.dataset.search.includes(q))});</script></body></html>';
const out=path.join(dir,'dist');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),html,'utf8');
if([...html.matchAll(/class="recipe"/g)].length!==100)throw Error('Missing cards in HTML');
console.log('PASS: generated standalone preview for 100 recipes ('+Buffer.byteLength(html)+' bytes).');
