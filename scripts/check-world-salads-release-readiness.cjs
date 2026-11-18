#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../data/editorial/salads');
const names=['russian-first-10','italian-french-spanish-30','greek-turkish-lebanese-30','japanese-thai-american-30'];
const items=names.flatMap(x=>JSON.parse(fs.readFileSync(path.join(root,x+'.json'),'utf8')).recipes);
let complete=0,missingSources=[],missingPhotos=[],unapproved=[];
for(const x of items){
  const checked=[...(x.sourceEvidence||[]),...(x.researchLeads||[])].filter(y=>y.status==='actually_read_and_compared'||y.verificationStatus==='verified').map(y=>y.url);
  let domains=new Set(checked.map(url=>url.match(/^https?:\/\/([^\/]+)/)?.[1]).filter(Boolean));
  if(domains.size<3)missingSources.push(x.id+' '+x.title);
  if(x.photoStatus!=='approved' || !x.photo)missingPhotos.push(x.id+' '+x.title);
  if(x.reviewStatus!=='verified_three_independent_sources')unapproved.push(x.id);
  if(domains.size>=3&&x.photoStatus==='approved'&&x.reviewStatus==='verified_three_independent_sources')complete++;
}
console.log(JSON.stringify({total:items.length,releaseReady:complete,unverifiedCulinaryCards:unapproved.length,insufficientCheckedSources:missingSources.length,unapprovedPhotos:missingPhotos.length},null,2));
if(process.argv.includes('--strict') && (complete!==100||missingPhotos.length||missingSources.length)){
 console.error('NOT READY: do not publish or merge until all checks pass');
 process.exit(1);
}
