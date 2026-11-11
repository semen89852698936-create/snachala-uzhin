#!/usr/bin/env node
// Read-only integrity check. Metadata != physical file or editorial approval.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
function check(map, curated, summary) {
  const errors = [];
  const photos = map.photos || [];
  if (map.total !== 1001 || photos.length !== 1001) errors.push('AI map must contain 1001 records');
  if (new Set(photos.map(p => p.recipe_id)).size !== photos.length) errors.push('duplicate recipe IDs');
  if (new Set(photos.map(p => p.path)).size !== photos.length) errors.push('duplicate image paths');
  for (const [i,p] of photos.entries()) {
    if (p.n !== i + 1) errors.push('out-of-order photo '+(i+1));
    if (!p.path.startsWith('/assets/recipes-ai/') || !p.path.endsWith('.webp') || !/^\d{4}-[^/]+\.webp$/.test(p.path.slice('/assets/recipes-ai/'.length))) errors.push('invalid path '+(i+1));
    if (!/^[0-9a-f]{40}$/.test(p.sha || '') || !(p.bytes > 0)) errors.push('invalid metadata '+(i+1));
  }
  for (const c of curated.sources || []) {
    if (c.publication_approved && (!c.photo_downloaded || !c.visually_approved)) errors.push('unsubstantiated approval '+c.n);
  }
  const stale = summary.updatedAt < '2026-11-02' && summary.uniqueCurrentPhotoIdentifiers !== photos.length;
  return {errors,staleLegacySummary:stale,aiMapRecords:photos.length,curatedCandidates:(curated.sources||[]).length,curatedDownloaded:(curated.sources||[]).filter(c=>c.photo_downloaded).length,editorialApprovalsNotInferred:true};
}
if (require.main === module) {
  const result=check(read('photo-library/ai-recipe-photo-map.json'),read('photo-library/curated-images.json'),read('photo-library/summary.json'));
  console.log(JSON.stringify(result,null,2));
  if(result.errors.length) process.exitCode=1;
}
module.exports={check};
