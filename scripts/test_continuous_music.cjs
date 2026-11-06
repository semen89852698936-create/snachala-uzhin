'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'music/licensed-tracks.json'),'utf8'));
const bands={cooking:[120,Infinity],dinner:[80,100],continue:[0,80]};
let count=0;
for(const [phase,range] of Object.entries(bands)){
 const tracks=data.playlists[phase];
 assert(Array.isArray(tracks),phase+' playlist must be array');
 for(const t of tracks){
  assert(Number.isFinite(t.bpm)&&t.bpm>=range[0]&&t.bpm<=range[1],phase+' BPM violation '+t.title);
  assert(t.licenseVerified===true&&/^https:\/\//.test(t.licenseUrl),phase+' missing license '+t.title);
  assert(/^music\/licensed\/[\w.\-]+\.(mp3|m4a|ogg)$/.test(t.src),phase+' bad local path');
  assert(fs.existsSync(path.join(root,t.src)),phase+' local audio missing '+t.src);
  count++;
 }
}
const player=fs.readFileSync(path.join(root,'music/continuous-player.js'),'utf8');
assert(player.includes("addEventListener('ended'"),'Missing automatic advancement');
assert(player.includes('index + 1'),'Missing next song');
for(const [html,reference] of [['index.html','music/continuous-player.js'],['full-catalog/index.html','../music/continuous-player.js']]){
 assert(fs.readFileSync(path.join(root,html),'utf8').includes('<script defer src="'+reference+'"></script>'),html+' missing script');
}
console.log('Continuous music: 3 BPM bands, both catalog references, auto-next; verified audio tracks:',count);
if(!count)console.log('Audio not yet licensed/installed. PR must not be published as a working audio release.');
