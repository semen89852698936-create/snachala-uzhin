// Проверка выпуска «НАШ ВЕЧЕР»: 40 существующих + 10 греческих салатов.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname,'..');
const r40 = JSON.parse(fs.readFileSync(path.join(root,'data/world-salads-40-for-site.json'),'utf8'));
const r50 = JSON.parse(fs.readFileSync(path.join(root,'data/world-salads-50-for-site.json'),'utf8'));
assert.equal(r40.length,40);
assert.equal(r50.length,50);
assert.deepEqual(r50.slice(0,40),r40,'First approved 40 changed');
assert.equal(new Set(r50.map(r=>r.id)).size,50);
const names=['Хорьятики','Критский дакос','Марулосалата','Хорта','Панцаросалата','Пататосалата','Фасолия салата','Политики салата','Ампелофасула','Салат из черноглазой фасоли'];
r50.slice(40).forEach((r,i)=>{
 assert.equal(r.title,names[i]);
 assert.equal(r.cuisine,'Греческая');
 assert.equal(r.base,2);
 assert.ok(r.steps.length>0 && r.ingredients.length>0);
 assert.ok(r.steps.every(s=>Number.isInteger(s.timer)&&s.timer>=0));
 const file=path.join(root,r.photo.replace(/^\\/,'').replace(/^\//,''));
 assert.ok(fs.existsSync(file),'Missing approved photo '+file);
 assert.ok(fs.statSync(file).size>20000,'Suspiciously small photo '+file);
 const header=fs.readFileSync(file).subarray(0,12);
 assert.equal(header.toString('ascii',0,4),'RIFF');
 assert.equal(header.toString('ascii',8,12),'WEBP');
});
const htmls=['index.html','full-catalog/index.html'];
for(const name of htmls){const src=fs.readFileSync(path.join(root,name),'utf8'); assert.ok(src.includes('world-salads-40.js'),name+' missing salads script');}
console.log('PASS: 50 recipes, first 40 untouched, 10 Greek cards and WebP found, 2 HTML loaders present.');
