#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'WORLD_100_RECIPES.json'),'utf8'));
const errs=[],arr=data.recipes||[];
if(arr.length!==100||data.total!==100)errs.push('expected exactly 100 recipes');
if(data.source_urls!==300)errs.push('expected 300 source links');
for(let i=0;i<arr.length;i++){
 const x=arr[i],n=i+1;
 if(x.id!==n)errs.push('#'+n+': sequence mismatch');
 if(!x.title||x.title.length<3)errs.push('#'+n+': missing title');
 if(x.servings!==2)errs.push('#'+n+': servings must be 2');
 if(!x.ingredients_text||x.ingredients_text.length<45)errs.push('#'+n+': ingredients missing');
 if(!x.steps_text||x.steps_text.length<140)errs.push('#'+n+': steps missing');
 const count=[...x.steps_text.matchAll(/(?:^|\s)\d+\.\s+\S/g)].length;
 if(count<5)errs.push('#'+n+': fewer than 5 cooking steps');
 if(!x.full_editorial_markdown||x.full_editorial_markdown.length<500)errs.push('#'+n+': editorial manuscript too short');
 if(!Array.isArray(x.recipe_sources)||x.recipe_sources.length!==3)errs.push('#'+n+': must have 3 recipe URLs');
 else {
  const hosts=x.recipe_sources.map(s=>{try{return new URL(s).hostname.replace(/^www\./,'')}catch{return ''}});
  if(hosts.some(h=>!h)||new Set(hosts).size!==3)errs.push('#'+n+': invalid or repeated domains');
 }
}
const titleKeys=arr.map(x=>(x.country_cuisine+'|'+x.title).toLowerCase());
if(new Set(titleKeys).size!==100)errs.push('duplicate soup titles within a cuisine');
const cuisines={};for(let x of arr)cuisines[x.country_cuisine]=(cuisines[x.country_cuisine]||0)+1;
if(Object.keys(cuisines).length!==10||Object.values(cuisines).some(n=>n!==10))errs.push('expected 10 cuisines of 10 recipes each');
console.log(JSON.stringify({total:arr.length,recipe_reference_count:300,cuisines,errors:errs},null,2));
if(errs.length)process.exit(1);
console.log('PASS: 100 recipes assembled into JSON with ingredients, 5+ steps and three distinct recipe-source domains each. Note: independent page content and individual photos require a separate human editorial audit.');
