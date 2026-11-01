#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function parseLine(s){let out=[],value='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){out.push(value);value=''}else value+=c}assert.equal(quoted,false,'Unclosed CSV quote');out.push(value);return out}
const raw=read('photo-library/recipes-photo-registry.csv').trimEnd().split(/\r?\n/);
const columns=parseLine(raw.shift());
assert.deepEqual(columns,['n','id','title','category','status','image_path','review_status']);
const rows=raw.map((line,i)=>{const values=parseLine(line);assert.equal(values.length,7,'CSV columns on row '+(i+2));return Object.fromEntries(columns.map((key,j)=>[key,values[j]]))});
assert.equal(rows.length,1001,'Catalog must contain exactly 1001 rows');
assert.equal(new Set(rows.map(x=>x.id)).size,1001,'Recipe IDs must be unique');
assert.equal(new Set(rows.map(x=>x.n)).size,1001,'Recipe numbers must be unique');
const approved=JSON.parse(read('photo-library/approved-webp-20261101.json')).images;
const summary=JSON.parse(read('photo-library/summary.json'));
const curated=JSON.parse(read('photo-library/curated-images.json'));
assert.equal(approved.length,3);
const published=rows.filter(r=>r.status==='published');
assert.equal(published.length,approved.length,'Published rows must match approved manifest');
for(const image of approved){const row=rows.find(r=>r.id===image.recipe_id);assert(row,'Approved recipe absent: '+image.recipe_id);assert.equal(row.status,'published');assert.equal(row.image_path,image.file_path);assert.equal(row.review_status,'owner_approved_webp_verified');const bytes=fs.readFileSync(path.join(root,image.file_path));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),image.sha256,'Image checksum mismatch '+image.recipe_id)}
assert.equal(summary.totalRecipes,rows.length);
assert.equal(summary.distinctImageFilesLocallyConfirmed,approved.length);
assert.equal(summary.photoRegistryPublishedRows,published.length);
assert.equal(curated.candidateCount,curated.sources.length);
assert.equal(curated.needsSourcePages,30-curated.sources.length);
assert.equal(summary.recipesWithoutSourcePage,1001-20-curated.sources.length);
assert.equal(new Set(curated.sources.map(x=>x.n)).size,curated.sources.length);
for(const candidate of curated.sources){assert(rows.some(r=>r.id===candidate.recipe_id),'Unknown candidate recipe');assert.equal(candidate.photo_downloaded,false);assert.equal(candidate.publication_approved,false);assert.equal(candidate.site_published,false);assert(candidate.source_page.startsWith('https://www.pexels.com/photo/'))}
console.log('PASS: 1001 unique recipes, 3 verified WebPs, '+curated.sources.length+' unapproved source leads, reconciled summary.');
