#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const context={window:{}};
vm.runInNewContext(read('assets/world-soups-10.js'),context,{timeout:1000});
const soups=context.window.WORLD_SOUPS_RECIPES;
assert.equal(soups.length,10,'Exactly 10 new soups');
assert.equal(new Set(soups.map(x=>x.id)).size,10,'Unique ids');
for(let n=1;n<=10;n++){
  const s=soups[n-1];
  assert.equal(s.id,'world-soup-ru-'+String(n).padStart(3,'0'));
  assert.equal(s.category,'soup');
  assert.equal(s.base,2);
  assert.equal(s.photo,'/assets/world-soups/'+String(n).padStart(2,'0')+'.webp');
  assert.ok(s.ingredients.length>=8&&s.ingredients.every(i=>typeof i.name==='string'&&typeof i.amount==='number'&&i.unit));
  assert.ok(s.steps.length>=5&&s.steps.every(t=>t.title&&t.detail&&Number.isInteger(t.timer)&&t.timer>=0));
  assert.ok(s.title&&s.description&&s.warn);
}
const expectedTitles=[
 'Борщ с говядиной','Щи из квашеной капусты с говядиной',
 'Рассольник ленинградский','Солянка мясная сборная','Уха из судака',
 'Окрошка на квасе с говядиной','Зелёные щи со щавелем и яйцом',
 'Ботвинья с рыбой и квасом','Рыбная калья с солёными огурцами',
 'Грибная похлёбка с перловкой'
];
assert.deepEqual(Array.from(soups,x=>x.title),expectedTitles);
for(const p of ['index.html','full-catalog/index.html']){
 const html=read(p);
 const startTag='<script id="recipeData" type="application/json">';
 const start=html.indexOf(startTag);
 assert.ok(start>=0,p+': embedded catalog missing');
 const end=html.indexOf('</script>',start);
 assert.ok(end>start,p+': embedded catalog not closed');
 const data=JSON.parse(html.slice(start+startTag.length,end));
 assert.equal(data.length,801,p+': 901 original minus 100 soups must remain');
 assert.equal(data.filter(x=>x.category==='soup').length,0,p+': old soup records still exist');
 assert.equal(new Set(data.map(x=>x.id)).size,data.length,p+': old duplicate ID');
 assert.ok(html.includes('<script src="/assets/world-soups-10.js"></script>'),p+': soup loader missing');
 assert.ok(html.includes('window.WORLD_SOUPS_RECIPES || []'),p+': soup data not concatenated');
 assert.ok(html.includes("{id:'soup',name:'Супы',emoji:'🍲',photo:'/assets/world-soups/01.webp'}"),p+': soup tile wrong');
 console.log('HTML PASS',p,'remaining core records:',data.length,'new soups:',soups.length);
}
const expectedImageSHA={
 9:'a7780cff27a1f595e4da06563d21f25caea31354335e9f4f5ff58d3079edbba9',
 10:'906333ac681b09f64afbeb2909db3c9168c81db384e890c535b916f70069def3'
};
for(let n=1;n<=10;n++){
 const p=path.join(root,'assets','world-soups',String(n).padStart(2,'0')+'.webp');
 assert.ok(fs.existsSync(p),'Missing approved photograph for #'+n);
 const buffer=fs.readFileSync(p);
 assert.equal(buffer.toString('ascii',0,4),'RIFF');
 assert.equal(buffer.toString('ascii',8,12),'WEBP');
 assert.ok(buffer.byteLength>20000);
 if(expectedImageSHA[n]){
  assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),expectedImageSHA[n],'Unexpected generated photo #'+n);
 }
}
console.log('QA PASS: ten Russian soups, ten WebP images, two catalog variants, 100 old soups excluded.');
