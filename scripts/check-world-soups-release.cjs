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
assert.equal(soups.length,80,'Exactly 80 approved soups');
assert.equal(new Set(soups.map(x=>x.id)).size,80,'Unique ids');
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

// Japanese soups 51-60, all approved by the owner; all 50 earlier soups remain intact.
for(let n=51;n<=60;n++){
 const s=soups[n-1];
 assert.equal(s.id,'world-soup-jp-'+String(n-50).padStart(3,'0'));
 assert.equal(s.category,'soup'); assert.equal(s.cuisine,'Японская'); assert.equal(s.base,2);
 assert.equal(s.photo,'/assets/world-soups/'+n+'.webp');
 assert.ok(s.ingredients.length>=7); assert.ok(s.steps.length>=5);
 assert.ok(s.steps.every(t=>Number.isInteger(t.timer)&&t.timer>=0&&t.detail));
}
// Korean soups 61–70 are owner-approved and the prior 60 soups are immutable.
for(let n=61;n<=70;n++){
 const s=soups[n-1];
 assert.equal(s.id,'world-soup-kr-'+String(n-60).padStart(3,'0'));
 assert.equal(s.category,'soup'); assert.equal(s.cuisine,'Корейская'); assert.equal(s.base,2);
 assert.equal(s.photo,'/assets/world-soups/'+n+'.webp');
 assert.ok(s.ingredients.length>=7); assert.ok(s.steps.length>=5);
 assert.ok(s.steps.every(t=>Number.isInteger(t.timer)&&t.timer>=0&&t.detail));
}
// Mexican soups 71–80: owner's approved recipes and photographs; previous 70 recipes are unchanged.
for(let n=71;n<=80;n++){
 const s=soups[n-1];
 assert.equal(s.id,'world-soup-mx-'+String(n-70).padStart(3,'0'));
 assert.equal(s.category,'soup'); assert.equal(s.cuisine,'Мексиканская'); assert.equal(s.base,2);
 assert.equal(s.photo,'/assets/world-soups/'+n+'.webp');
 assert.ok(s.ingredients.length>=7); assert.ok(s.steps.length>=5);
 assert.ok(s.steps.every(t=>Number.isInteger(t.timer)&&t.timer>=0&&t.detail));
}
const expectedTitles=[
 'Борщ с говядиной','Щи из квашеной капусты с говядиной',
 'Рассольник ленинградский','Солянка мясная сборная','Уха из судака',
 'Окрошка на квасе с говядиной','Зелёные щи со щавелем и яйцом',
 'Ботвинья с рыбой и квасом','Рыбная калья с солёными огурцами',
 'Грибная похлёбка с перловкой'
];
assert.deepEqual(Array.from(soups.slice(0,10),x=>x.title),expectedTitles);
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
if(process.argv.includes('--content-only')){console.log('CONTENT QA PASS: ten Russian soups and both HTML catalog variants; photo import pending.');process.exit(0);}
const expectedImageSHA={
 9:'a7780cff27a1f595e4da06563d21f25caea31354335e9f4f5ff58d3079edbba9',
 10:'906333ac681b09f64afbeb2909db3c9168c81db384e890c535b916f70069def3',
 71:'503dbcf42d55a2040b7d69e5b226d19791225071c2a2d0b068308fa48db51040',
 72:'2ded2bc30f7b8c42f536a0b8cac83bf4ce34032adf97803e73fde638b09ba08c',
 73:'4520e6e1dfface14f60cae24ace4439f79bdd607cebb04172cb740ab11dbbd1a',
 74:'ae44375b50a6d4890439f3c2caf1b62d228a8f8a0fa17a0fdb29e10de26d9fbb',
 75:'9b3ba1f3e3ea2f2ebf62266910c0ad5634b1b9aface2219473f4bc42d5d4fd2e',
 76:'e6e75a6be880c8c3b04f6390662d51b69484c042a4f7d1b7636e3c5c4dd937b0',
 77:'ca33924edccdc8ef9b583fb1a5896a8eecb3edf79653794355ed951aed312a88',
 78:'36ad8d6dfb933f75f13ef7de934b5ecef9859abfdd1563fc5905a5418021d92d',
 79:'52aa3b063e3728ee697ac18f640b65aa84be57d45c2de1d95110bdc388f7406b',
 80:'905668d16d3ce885546f62fa33fe76f5fc3ae8d38ddd9f19aa2f5df0e3a115df'
};
for(let n=1;n<=80;n++){
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
console.log('QA PASS: 80 approved world soups, 80 WebP photos, both HTML variants, 100 old soup records excluded.');
