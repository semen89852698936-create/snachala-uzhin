// QA gate: НАШ ВЕЧЕР / approved Turkish salads 51–60.
// Run: node scripts/check-world-salads-60.cjs
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT,p),'utf8');
const old50 = JSON.parse(read('data/world-salads-50-for-site.json'));
const all60 = JSON.parse(read('data/world-salads-60-for-site.json'));
assert.equal(old50.length,50,'50 previous approved salads must be present');
assert.equal(all60.length,60,'expected exactly 60 salads');
assert.deepEqual(all60.slice(0,50),old50,'approved salads 1–50 must not change');
assert.equal(new Set(all60.map(x=>x.id)).size,60,'duplicate recipe IDs');
const names = ['Чобан салатасы','Гавурдагы','Пияз','Кысыр','Аджылы эзме','Патлыджан салатасы','Портулак с чесночным йогуртом','Турецкий картофельный салат','Красная капуста с лимоном','Морковь с чесночным йогуртом'];
for(let i=0;i<10;i++){
 const r=all60[i+50];
 assert.equal(r.title,names[i]);
 assert.equal(r.id,'world-salad-06-'+String(i+1).padStart(2,'0'));
 assert.equal(r.cuisine,'Турецкая');
 assert.equal(r.base,2);
 assert.ok(Array.isArray(r.steps)&&r.steps.length>=4,'missing steps '+r.id);
 assert.ok(Array.isArray(r.ingredients)&&r.ingredients.length>0,'missing ingredients '+r.id);
 assert.ok(r.steps.every(s=>Number.isInteger(s.timer)&&s.timer>=0),'invalid timer '+r.id);
 const expected='/assets/world-salads/'+(51+i)+'_world-salad-06-'+String(i+1).padStart(2,'0')+'.webp';
 assert.equal(r.photo,expected,'wrong photo association '+r.id);
 const img=path.join(ROOT,r.photo.replace(/^[/]/,''));
 assert.ok(fs.existsSync(img),'missing approved photo: '+expected);
 const data=fs.readFileSync(img);
 assert.ok(data.length>100000,'photo missing content: '+expected);
 assert.equal(data.toString('ascii',0,4),'RIFF','invalid WebP header: '+expected);
 assert.equal(data.toString('ascii',8,12),'WEBP','invalid WebP format: '+expected);
}
const ctx={window:{}};
vm.runInNewContext(read('assets/world-salads-40.js'),ctx,{filename:'assets/world-salads-40.js'});
assert.equal(ctx.window.WORLD_SALADS_RECIPES.length,60,'site script must expose 60 salads');
for(let i=0;i<60;i++)assert.equal(ctx.window.WORLD_SALADS_RECIPES[i].id,all60[i].id,'site script catalog mismatch #'+(i+1));
for(const p of ['index.html','full-catalog/index.html']){
 assert.ok(read(p).includes('world-salads-40.js'),p+' missing world salads loader');
}
console.log('PASS: 60 cards; first 50 untouched; 10 Turkish original WebP present; timers valid; site loader exposes 60');
