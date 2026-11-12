'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'music/native-player-manifest.json'),'utf8'));
const groups={kitchen:[9,b=>b>=120],dinner:[15,b=>b>=80&&b<=100],after:[16,b=>b<=80]};
const seen=new Set();
let total=0;
for(const [phase,[expected,validBpm]] of Object.entries(groups)){
 const list=manifest.playlists[phase].tracks;
 assert.equal(list.length,expected,phase+' count');
 for(const t of list){
  assert.match(t.id,/^USUAN\d+$/);
  assert(!seen.has(t.id),'duplicate ISRC '+t.id);
  seen.add(t.id);
  assert.equal(t.artist,'Kevin MacLeod');
  assert(validBpm(t.bpm),'bad BPM '+t.title);
  assert(t.durationSeconds>=45,'invalid duration '+t.title);
  assert(t.src.startsWith('https://incompetech.com/music/royalty-free/mp3-royaltyfree/'),'bad mp3 URL');
  assert(t.src.endsWith('.mp3'));
  assert.equal(t.license.id,'CC-BY-4.0');
  assert.equal(t.license.streamingAllowed,true);
  assert.equal(t.license.creditRequired,true);
  assert(t.source.endsWith('isrc='+t.id));
  total++;
 }
}
assert.equal(total,40);
const credits=fs.readFileSync(path.join(root,'music/credits.html'),'utf8');
for(const phase of Object.keys(groups))for(const t of manifest.playlists[phase].tracks){
 assert(credits.includes(t.title.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')),'missing credit '+t.title);
}
const js=fs.readFileSync(path.join(root,'assets/native-music-player-20261112.js'),'utf8');
assert(js.includes('state.audio.addEventListener(\'ended\''));
assert(js.includes('Аудиозапись не имеет разрешённого источника.'));
assert(js.includes('/music/credits.html'));
assert(!js.includes('Слушать демо'));
console.log('Kevin MacLeod licensed playlist PASS: '+total+' tracks, 3 BPM ranges, CC BY 4.0 links and required credit.');
