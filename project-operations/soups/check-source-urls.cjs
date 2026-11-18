#!/usr/bin/env node
'use strict';
/**
 * Live source QA. Not a substitute for editorial reading of each recipe.
 * Outputs report to Actions artifact. Uses 5 second timeout per request.
 */
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const groups=[['russian-01-03.md',1,3],['russian-04.md',4,4],['russian-05-10.md',5,10],['italian-11-20.md',11,20],['french-21-30.md',21,30],['spanish-31-40.md',31,40],['turkish-41-50.md',41,50],['japanese-51-60.md',51,60],['korean-61-70.md',61,70],['mexican-71-80.md',71,80],['vietnamese-81-90.md',81,90],['chinese-91-100.md',91,100]];
const jobs=[];
for(const [file] of groups){
const txt=fs.readFileSync(path.join(dir,file),'utf8'),heads=[...txt.matchAll(/(?:^|\n)#{1,3}\s+№(\d+)\.\s*/g)];
for(let i=0;i<heads.length;i++){
const n=Number(heads[i][1]),section=txt.slice(heads[i].index,heads[i+1]?.index??txt.length);
const urls=[...section.matchAll(/https:\/\/[^\s)\]<>]+/g)].map(x=>x[0].replace(/[.,;:]$/,''));
for(let j=0;j<Math.min(urls.length,3);j++) jobs.push({recipe:n,position:j+1,url:urls[j]});
}}
const norm=s=>s.toLowerCase().replace(/&[#a-z0-9]+;/g,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,100000);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(item){
const controller=new AbortController(),t=setTimeout(()=>controller.abort(),6500);
try{
const r=await fetch(item.url,{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; SoupEditorialQA/1.0; +https://github.com/soups)','Accept':'text/html,*/*'}});
const ct=r.headers.get('content-type')||'';
let body='';
if(/html|text/i.test(ct)) body=(await r.text()).slice(0,160000);
const title=(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
const status=r.status, blocking=/captcha|verify you are human|access denied|just a moment|cloudflare|robot|request blocked/i.test((title+' '+body.slice(0,4000)).toLowerCase());
return {...item,http_status:status,final_url:r.url,title:norm(title).slice(0,160),bytes:body.length,verdict:status===404||status===410?'NOT_FOUND':blocking||status===403||status===429?'ACCESS_BLOCKED':status>=500?'SERVER_ERROR':r.ok&&body.length>300?'FETCHED_UNREVIEWED':r.ok?'EMPTY_OR_NONHTML':'HTTP_ERROR'};
}catch(e){return {...item,http_status:null,title:'',verdict:e.name==='AbortError'?'TIMEOUT':'NETWORK_ERROR',error:String(e).slice(0,140)}}finally{clearTimeout(t)}
}
const results=Array(jobs.length);let next=0;const workers=Array.from({length:14},async()=>{while(next<jobs.length){const i=next++; results[i]=await check(jobs[i]);}});
(async()=>{await Promise.all(workers);
const summary={total:results.length,by_verdict:{},numbers_with_three_fetched:0,notes:'FETCHED_UNREVIEWED only means a page loaded. It does not establish that the URL is truly a soup recipe or that the recipe is independent.'};
for(let x of results)summary.by_verdict[x.verdict]=(summary.by_verdict[x.verdict]||0)+1;
for(let n=1;n<=100;n++)if(results.filter(x=>x.recipe===n&&x.verdict==='FETCHED_UNREVIEWED').length===3)summary.numbers_with_three_fetched++;
fs.writeFileSync(path.join(dir,'WORLD_100_SOURCE_URL_REPORT.json'),JSON.stringify({summary,results},null,2));
console.log(JSON.stringify(summary,null,2));
const failures=results.filter(x=>x.verdict!=='FETCHED_UNREVIEWED');
console.log('non-fetchable examples:',JSON.stringify(failures.slice(0,40).map(x=>({n:x.recipe,u:x.url,v:x.verdict,status:x.http_status}))));
})();