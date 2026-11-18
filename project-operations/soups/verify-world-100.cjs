#!/usr/bin/env node
'use strict';
/**
 * Editorial structural gate, NOT external-source fact checking or photo acceptance.
 * No external packages. Runs on Node.js 20+.
 */
const fs=require('node:fs');
const path=require('node:path');
const here=__dirname;
const chunks=[
  ['russian-01-03.md',1,3,'Русская'],['russian-04.md',4,4,'Русская'],
  ['russian-05-10.md',5,10,'Русская'],
  ['italian-11-20.md',11,20,'Итальянская'],
  ['french-21-30.md',21,30,'Французская'],
  ['spanish-31-40.md',31,40,'Испанская'],
  ['turkish-41-50.md',41,50,'Турецкая'],
  ['japanese-51-60.md',51,60,'Японская'],
  ['korean-61-70.md',61,70,'Корейская'],
  ['mexican-71-80.md',71,80,'Мексиканская'],
  ['vietnamese-81-90.md',81,90,'Вьетнамская'],
  ['chinese-91-100.md',91,100,'Китайская']
];
const errors=[], rows=[];
for(const [fname,start,end,cuisine] of chunks){
  const filename=path.join(here,fname);
  if(!fs.existsSync(filename)){errors.push('Missing '+fname);continue;}
  const file=fs.readFileSync(filename,'utf8');
  if(!file || file.length<400){errors.push('Empty '+fname);continue;}
  const head=[...file.matchAll(/(?:^|\n)#{1,3}\s+№(\d+)\.\s*/g)];
  if(head.length!==end-start+1)errors.push(fname+': expected '+(end-start+1)+' entries, got '+head.length);
  for(let i=0;i<head.length;i++){
    const no=Number(head[i][1]);
    const sec=file.slice(head[i].index,head[i+1]?.index??file.length);
    const links=[...sec.matchAll(/https:\/\/[^\s)\]<>]+/g)].map(m=>m[0].replace(/[.,;:]$/,''));
    const hosts=new Set(links.map(url=>url.slice(8).split('/')[0].replace(/^www\./,'')));
    const cookingBody=sec.split(/\*\*(?:Для фотографии|Фото:|Внешний вид:|Как выглядит|Вид готового|Точный вид|Источники|Независимые рецептурные источники)/i)[0];\n    const numbered=[...cookingBody.matchAll(/(?:^|\\s)[1-9]\\d?\\.\\s+\\S/g)].length;
    if(no!==start+i)errors.push(fname+': wrong number '+no+' expected '+(start+i));
    if(links.length<3)errors.push('#'+no+': fewer than 3 source URLs');
    if(hosts.size<3)errors.push('#'+no+': fewer than 3 unique source domains');
    if(numbered<5)errors.push('#'+no+': fewer than 5 numbered cooking steps');
    if(!/На двоих|на двоих|2 порц/i.test(sec) && !/на двоих|На двоих/i.test(file.slice(0,head[0].index)))errors.push('#'+no+': no 2-portion mark');
    if(!/ингредиент|понадобит|Что нужно|Что понадобится|Продукты/i.test(sec))errors.push('#'+no+': no ingredient section');
    if(!/внешн|фото|выгляд|вид блюда|вид готов/i.test(sec))errors.push('#'+no+': no appearance guidance');
    if(sec.length<650)errors.push('#'+no+': unusually short recipe');
    rows.push({number:no,cuisine,file:fname,steps:numbered,source_domains:hosts.size,source_urls:links.length,structural_check:'PASS',independent_page_review:'PENDING',multiple_photo_review:'PENDING',individual_photo:'PENDING',user_approval:'PENDING'});
  }
}
if(rows.length!==100)errors.push('Expected 100 recipes, found '+rows.length);
if(new Set(rows.map(r=>r.number)).size!==100 || rows.some((r,i)=>r.number!==i+1))errors.push('Sequence must be 1..100 exactly');
const report={generated_at_utc:new Date().toISOString(),structural_pass:errors.length===0,recipes:rows.length,source_url_occurrences:rows.reduce((n,r)=>n+r.source_urls,0),note:'URL/host count and recipe structure only. Does NOT prove external pages are reachable, independent, accurate, visually reviewed, photographed or approved.',errors,rows};
fs.writeFileSync(path.join(here,'WORLD_100_QA_REPORT.json'),JSON.stringify(report,null,2)+'\n');
if(errors.length){console.error('FAIL:\n'+errors.join('\n'));process.exit(1);}
console.log('PASS: all 100 soup drafts present, exactly 10 per cuisine, each has 3 source domains and at least 5 written steps. External content and images NOT validated.');
