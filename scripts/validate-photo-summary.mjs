import {readFileSync} from 'node:fs';
export function audit(summary,curated,csv){
 const errors=[],warnings=[],candidates=curated.sources??[],rows=csv.trim().split(/\r?\n/).slice(1);
 if(rows.length!==summary.totalRecipes)errors.push('CSV has '+rows.length+' rows, expected '+summary.totalRecipes);
 if(curated.candidateCount!==candidates.length)errors.push('curated candidateCount differs from sources.length');
 const ids=new Set();
 for(const c of candidates){
  if(ids.has(c.recipe_id))errors.push('Duplicate candidate recipe_id '+c.recipe_id);ids.add(c.recipe_id);
  if(c.publication_approved&&(!c.photo_downloaded||!c.visually_approved))errors.push('Unsubstantiated publication approval '+c.recipe_id);
  if(c.site_published&&!c.publication_approved)errors.push('Unapproved site publication '+c.recipe_id);
  if(!c.photo_downloaded&&c.visually_approved)errors.push('Visual approval without local image '+c.recipe_id);
  if(/chicken|poultry/i.test(c.source_page??'')&&/свин|говяж|баран/i.test(c.recipe_title??''))warnings.push('Source slug suggests poultry for meat recipe '+c.recipe_id+': '+c.source_page);
 }
 if(summary.distinctImageFilesLocallyConfirmed>summary.totalRecipes)errors.push('Impossible locally confirmed file count');
 if(summary.updatedAt<'2026-11-05')warnings.push('Legacy summary predates current 1001-WebP AI map; do not use as present-day photo completeness metric');
 return {errors,warnings,legacyRows:rows.length,candidates:candidates.length,downloadedCandidates:candidates.filter(c=>c.photo_downloaded).length,approvedCandidates:candidates.filter(c=>c.publication_approved).length};
}
if(process.argv[1]?.endsWith('validate-photo-summary.mjs')){
 const [a,b,c]=process.argv.slice(2);
 if(!c){console.error('Usage: node validate-photo-summary.mjs summary.json curated-images.json recipes-photo-registry.csv');process.exit(2)}
 const result=audit(JSON.parse(readFileSync(a,'utf8')),JSON.parse(readFileSync(b,'utf8')),readFileSync(c,'utf8'));
 console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
}