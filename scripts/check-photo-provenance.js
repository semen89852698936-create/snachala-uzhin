#!/usr/bin/env node
// Read-only consistency check. Never treats candidate URLs as created image files.
const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const summary=read('photo-library/summary.json');
const curated=read('photo-library/curated-images.json');
const approved=read('photo-library/approved-webp-20261101.json');
const sources=curated.sources||[];
const images=approved.images||[];
const assert=(condition,message)=>{if(!condition)throw Error(message)};
assert(summary.totalRecipes===1001,'Unexpected recipe count');
assert(sources.length===curated.candidateCount,'Candidate count does not match sources');
assert(new Set(sources.map(x=>x.n)).size===sources.length,'Duplicate candidate recipe number');
assert(sources.every(x=>!x.publication_approved || (x.photo_downloaded && x.visually_approved)),'Unverified candidate marked approved');
assert(images.every(x=>x.file_path && x.webp_verified && x.owner_approved),'Approved file missing verification metadata');
const locallyPresent=images.filter(x=>fs.existsSync(path.join(root,x.file_path)));
const report={totalRecipes:summary.totalRecipes,candidateSourcePages:sources.length,approvedManifestEntries:images.length,approvedFilesPresentInCheckout:locallyPresent.length,missingApprovedFiles:images.filter(x=>!fs.existsSync(path.join(root,x.file_path))).map(x=>x.file_path),summaryOutdated:summary.updatedAt<'2026-11-04',unverifiedRemainder:summary.totalRecipes-images.length};
console.log(JSON.stringify(report,null,2));
if(report.missingApprovedFiles.length)process.exitCode=1;
