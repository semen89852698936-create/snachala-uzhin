'use strict';
// Non-destructive release gate. Run: node scripts/check-world-salads-40-release.cjs
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const cards=JSON.parse(fs.readFileSync(path.join(root,'data/world-salads-40-for-site.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/world-salads/photo-manifest.json'),'utf8'));
assert.equal(cards.length,40,'Need exactly 40 salad cards');
assert.equal(manifest.files.length,40,'Need 40 photo bindings');
assert.equal(new Set(cards.map(x=>x.id)).size,40,'Duplicate IDs');
const problems=[];
cards.forEach((card,i)=>{
const photo=manifest.files[i],n=i+1;
if(card.category!=='salads'||card.base!==2||card.id!==photo.id||card.photo!==photo.photo)problems.push(n+': malformed recipe mapping');
if(!Array.isArray(card.ingredients)||!card.ingredients.length||!Array.isArray(card.steps)||card.steps.length<4)problems.push(n+': incomplete recipe');
for(const step of card.steps||[])if(!Number.isInteger(step.timer)||step.timer<0)problems.push(n+': bad step timer');
const target=path.resolve(root,'.'+card.photo);
if(!target.startsWith(path.join(root,'assets','world-salads')+path.sep))problems.push(n+': unsafe image path');
else if(!fs.existsSync(target))problems.push(n+': image not present in repository');
if(photo.contentReviewNeeded)problems.push(n+': photo needs culinary visual correction');
});
if(problems.length){console.error('RELEASE BLOCKED: '+problems.length+' defects\n'+problems.join('\n'));process.exitCode=2;}
else console.log('PASS: 40 correctly mapped salad cards and complete photo assets. Still requires deployed UI smoke test.');
