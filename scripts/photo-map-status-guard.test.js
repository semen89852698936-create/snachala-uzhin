const test = require('node:test');
const assert = require('node:assert/strict');
const {audit} = require('./photo-map-status-guard.js');
function fixture() {
 const photos = Array.from({length:1001},(_,i)=>({n:i+1,recipe_id:'recipe-'+(i+1),path:'/assets/recipes-ai/'+(i+1)+'.webp',sha:'a'.repeat(40),bytes:100}));
 return [{total:1001,photos},{totalRecipes:1001,distinctImageFilesLocallyConfirmed:3}];
}
test('1001 mapped paths do not imply approvals',()=>{const [map,legacy]=fixture();const r=audit(map,legacy);assert.equal(r.mappedPaths,1001);assert.equal(r.approvedThisRun,0);assert.equal(r.unverifiedVisualCount,null);assert.equal(r.legacySummaryIsCurrent,false)});
test('duplicate path is rejected',()=>{const [map,legacy]=fixture();map.photos[1].path=map.photos[0].path;assert.throws(()=>audit(map,legacy),/duplicate path/)});
test('missing photo rejected',()=>{const [map,legacy]=fixture();map.photos.pop();assert.throws(()=>audit(map,legacy),/length mismatch/)});
test('invalid blob SHA rejected',()=>{const [map,legacy]=fixture();map.photos[0].sha='unverified';assert.throws(()=>audit(map,legacy),/Git blob SHA/)});
