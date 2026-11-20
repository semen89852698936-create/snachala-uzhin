#!/usr/bin/env node
'use strict';
/**
 * Live source QA. Not a substitute for editorial reading of each recipe.
 * Outputs report to Actions artifact. Uses 5 second timeout per request.
 */
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const review=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_ONE_SOURCE_REVIEW.json'),'utf8'));
if(review.policy!=='ONE_SOURCE_PER_RECIPE'||review.recipes.length!==100)throw Error('Exactly 100 selected sources required');
const jobs=review.recipes.map(x=>({recipe:x.id,position:1,url:x.url}));
const norm=s=>s.toLowerCase().replace(/&[#a-z0-9]+;/g,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,100000);
// Best-effort extraction of recipe data published in JSON-LD, not culinary validation.
function extractSchema(body){
 let cards=[];
 for(const m of body.matchAll(/<script[^>]+type=[\x22\x27]application\/ld\+json[\x22\x27][^>]*>([\s\S]*?)<\/script>/gi)){
  try{
   const obj=JSON.parse(m[1].trim());
   const visit=(v,depth=0)=>{
    if(!v||depth>15)return;
    if(Array.isArray(v)){v.forEach(x=>visit(x,depth+1));return;}
    if(typeof v!=='object')return;
    const t=v['@type'],types=Array.isArray(t)?t:[t];
    if(types.some(x=>String(x).toLowerCase()==='recipe'))cards.push(v);
    if(v['@graph'])visit(v['@graph'],depth+1);
    if(v.mainEntity)visit(v.mainEntity,depth+1);
   };
   visit(obj);
  }catch(_){}
 }
 const c=cards.find(c=>Array.isArray(c.recipeIngredient)&&c.recipeIngredient.length)||cards[0];
 if(!c)return {schema_recipe_found:false,recipe_title:'',ingredient_count:0,ingredients_sample:'',instructions_sample:''};
 const ingredients=Array.isArray(c.recipeIngredient)?c.recipeIngredient:[];
 const inst=Array.isArray(c.recipeInstructions)?c.recipeInstructions:[c.recipeInstructions].filter(Boolean);
 const clean=x=>String(x??'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 return {schema_recipe_found:true,recipe_title:clean(c.name).slice(0,130),ingredient_count:ingredients.length,ingredients_sample:ingredients.slice(0,25).map(clean).join(' / ').slice(0,750),instructions_sample:inst.slice(0,6).map(x=>clean(typeof x==='object'?x.text||x.name||x.itemListElement?.map(y=>y.text).join(' '):x)).join(' / ').slice(0,850)};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(item){
const controller=new AbortController(),t=setTimeout(()=>controller.abort(),6500);
try{
const r=await fetch(item.url,{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; SoupEditorialQA/1.0; +https://github.com/soups)','Accept':'text/html,*/*'}});
const ct=r.headers.get('content-type')||'';
let body='';
if(/html|text/i.test(ct)) body=(await r.text()).slice(0,160000);
const title=(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';
const status=r.status, blocking=/captcha|verify you are human|access denied|just a moment|ddos.guard|request blocked/i.test(title.toLowerCase()) || (body.length<10000 && /verify you are human|access denied|captcha|cloudflare/i.test(body.slice(0,2500)));
return {...item,...extractSchema(body),http_status:status,final_url:r.url,title:norm(title).slice(0,160),bytes:body.length,has_recipe_schema:/recipeIngredient|recipeInstructions|wprm-recipe|tasty-recipes|recipe_card|recipe-card/i.test(body),verdict:status===404||status===410?'NOT_FOUND':blocking||status===403||status===429?'ACCESS_BLOCKED':status>=500?'SERVER_ERROR':r.ok&&body.length>300?'FETCHED_UNREVIEWED':r.ok?'EMPTY_OR_NONHTML':'HTTP_ERROR'};
}catch(e){return {...item,http_status:null,title:'',verdict:e.name==='AbortError'?'TIMEOUT':'NETWORK_ERROR',error:String(e).slice(0,140)}}finally{clearTimeout(t)}
}
const results=Array(jobs.length);let next=0;const workers=Array.from({length:14},async()=>{while(next<jobs.length){const i=next++; results[i]=await check(jobs[i]);}});
(async()=>{await Promise.all(workers);
const summary={total:results.length,by_verdict:{},numbers_with_one_fetched:0,notes:'FETCHED_UNREVIEWED only means a page loaded. It does not establish that the URL is truly a soup recipe or that the recipe is independent.'};
for(let x of results)summary.by_verdict[x.verdict]=(summary.by_verdict[x.verdict]||0)+1;
for(let n=1;n<=100;n++)if(results.some(x=>x.recipe===n&&x.verdict==='FETCHED_UNREVIEWED'))summary.numbers_with_one_fetched++;
fs.writeFileSync(path.join(dir,'WORLD_100_SOURCE_URL_REPORT.json'),JSON.stringify({summary,results},null,2));
console.log(JSON.stringify(summary,null,2));
const failures=results.filter(x=>x.verdict!=='FETCHED_UNREVIEWED');
console.log('non-fetchable examples:',JSON.stringify(failures.slice(0,40).map(x=>({n:x.recipe,u:x.url,v:x.verdict,status:x.http_status}))));
const schemas=results.filter(x=>x.schema_recipe_found);
console.log('RECIPE_SCHEMA_SUMMARY',JSON.stringify({parsed_recipe_schema:schemas.length,loadable_without_recipe_schema:results.filter(x=>x.verdict==='FETCHED_UNREVIEWED'&&!x.schema_recipe_found).length}));
for(const x of results)console.log('RECIPE_EVIDENCE',JSON.stringify({n:x.recipe,source:x.position,verdict:x.verdict,url:x.url,title:x.title,recipe_title:x.recipe_title||'',ingredient_count:x.ingredient_count||0,ingredients_sample:x.ingredients_sample||'',instructions_sample:x.instructions_sample||''}));

})();