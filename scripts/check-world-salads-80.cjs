// НАШ ВЕЧЕР - validate Japanese salads 71–80 before publishing to the canonical domain.
// Run: node scripts/check-world-salads-80.cjs
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const previous=JSON.parse(read('data/world-salads-70-for-site.json'));
const current=JSON.parse(read('data/world-salads-80-for-site.json'));
assert.equal(previous.length,70,'Missing the approved first 70 recipes');
assert.equal(current.length,80,'Expected exactly 80 recipes');
assert.deepEqual(current.slice(0,70),previous,'The approved first 70 recipes changed');
assert.equal(new Set(current.map(r=>r.id)).size,80,'Duplicate recipe IDs');
const hashes=["a643eff98f475418252f5d671896209ef177d0bdeccd7e0674d85d9b10a8c1cb","2a7dd107d19948cf12a9525eb7fc2d7166980808c4b13903a880bda755f73ebc","929d5659c7868a32394c037d89461a98487e3efbdcfc38f86ed8f92b81d436f9","59f43bde8f55c3427dd300cf0c6d50190c347483c9264a6f8bc1733ab230d23c","d56ac3ed7284e7e14a5748c5c97d9a6b922847eaa489a4022903b6ee73d9e954","2bfa93cfd86e00419a2b1eced146fe42cb7f7ae38e86cf8cda86ba5e8e062835","f1410389b7a1d5184399330225b54e6fd07c432050d6cce77830159c106b4aec","116b39541b4c7d4f37d622f7e1694a46535294bebb02217ceeef4cb1c259c915","2e8a3a7ea3f597bfd9b6d965348ebb4d1d5203de2d0db983a743362bca35f906","efdefdfb8521a20d6ba4c6c7af3b4836a71ae05c8a5c1b21b5e0f9fd24015e95"];
for(let i=0;i<10;i++){
 const number=71+i;
 const recipe=current[number-1];
 const suffix=String(i+1).padStart(2,'0');
 assert.equal(recipe.id,'world-salad-08-'+suffix);
 assert.equal(recipe.cuisine,'Японская');
 assert.equal(recipe.base,2);
 assert.ok(recipe.ingredients?.length>=3 && recipe.steps?.length>=4,'Recipe incomplete #'+number);
 assert.ok(recipe.steps.every(s=>Number.isInteger(s.timer)&&s.timer>=0),'Timer invalid #'+number);
 const photo='/assets/world-salads/'+number+'_world-salad-08-'+suffix+'.webp';
 assert.equal(recipe.photo,photo,'Incorrect photo association #'+number);
 const full=path.join(root,photo.replace(/^[/]/,''));
 assert.ok(fs.existsSync(full),'Photo not uploaded: '+photo);
 const bytes=fs.readFileSync(full);
 assert.ok(bytes.length>100000,'Photo is unexpectedly small: '+photo);
 assert.equal(bytes.toString('ascii',0,4),'RIFF','Invalid WebP header #'+number);
 assert.equal(bytes.toString('ascii',8,12),'WEBP','Invalid WebP file #'+number);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hashes[i],'Photo differs from user-approved WebP #'+number);
}
const sandbox={window:{}};
vm.runInNewContext(read('assets/world-salads-40.js'),sandbox,{filename:'assets/world-salads-40.js'});
const visible=sandbox.window.WORLD_SALADS_RECIPES;
assert.equal(visible?.length,80,'Browser catalog not exposing 80 salads');
for(let i=0;i<80;i++) assert.equal(visible[i].id,current[i].id,'Browser catalog sequence differs #'+(i+1));
for(const file of ['index.html','full-catalog/index.html']) assert.ok(read(file).includes('world-salads-40.js'),'World salads loader absent in '+file);
console.log('PASS: all 80 salads; original 70 immutable; 10 exact Japanese WebP; photos, ingredients, timers and loaders verified');
