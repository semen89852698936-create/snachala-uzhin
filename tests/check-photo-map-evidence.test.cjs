const assert = require('node:assert/strict');
const {test} = require('node:test');
const {check} = require('../scripts/check-photo-map-evidence.cjs');
const sample = () => ({
  map:{total:1001,photos:Array.from({length:1001},(_,i)=>({n:i+1,recipe_id:'id'+i,path:'/assets/recipes-ai/'+String(i+1).padStart(4,'0')+'-id'+i+'.webp',sha:'a'.repeat(40),bytes:100}))},
  curated:{sources:[{n:21,photo_downloaded:false,visually_approved:false,publication_approved:false}]},
  summary:{updatedAt:'2026-11-01',uniqueCurrentPhotoIdentifiers:29}
});
test('valid metadata does not imply image approval',()=>{const s=sample();const r=check(s.map,s.curated,s.summary);assert.equal(r.errors.length,0);assert.equal(r.staleLegacySummary,true);assert.equal(r.editorialApprovalsNotInferred,true)});
test('reject duplicate paths',()=>{const s=sample();s.map.photos[1].path=s.map.photos[0].path;assert.ok(check(s.map,s.curated,s.summary).errors.some(e=>e.includes('duplicate image paths')))});
test('reject unsupported approval',()=>{const s=sample();s.curated.sources[0].publication_approved=true;assert.ok(check(s.map,s.curated,s.summary).errors.some(e=>e.includes('unsubstantiated approval')))});
