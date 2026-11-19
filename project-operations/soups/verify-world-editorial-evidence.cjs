#!/usr/bin/env node
'use strict';
// Strict editorial documentation integrity, NOT a claim that all 300 external pages were read.
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const data=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_RECIPES.json'),'utf8'));
const timer=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_STEP_TIMER_PHASES.json'),'utf8'));
const single=JSON.parse(fs.readFileSync(path.join(dir,'WORLD_100_ONE_SOURCE_REVIEW.json'),'utf8'));
const errors=[];
if(single.policy!=='ONE_SOURCE_PER_RECIPE'||single.recipes?.length!==100)errors.push('Need 100 selected single-source reviews');
const recipes=data.recipes;
if(recipes.length!==100)errors.push('Need 100 recipes');
if(timer.recipes.length!==100)errors.push('Need 100 timer records');
let sources=0,steps=0,phases=0;
for(const [i,r] of recipes.entries()){
 if(r.id!==i+1)errors.push('Wrong ID '+r.id);
 const evidence=r.source_content_evidence;
 const selected=single.recipes[i];
 if(!selected||selected.id!==r.id||!/^https:\/\//.test(selected.url)||!selected.source_title)errors.push('#'+r.id+' no selected original source');
 if(selected?.approved && (selected.ingredient_check!=='PASS'||selected.technique_check!=='PASS'||selected.time_check!=='PASS'))errors.push('#'+r.id+' falsely approved');
 // Historical three-source evidence is retained, but is no longer a pass condition.
 if(!r.recipe_sources.length)errors.push('#'+r.id+' missing source');
 const t=timer.recipes[i];
 if(!t||t.id!==r.id||t.steps.length!==r.steps.length)errors.push('#'+r.id+' timers missing');
 else for(const [j,s] of r.steps.entries()){
   steps++;
   if(t.steps[j].step_text!==s)errors.push('#'+r.id+' step '+(j+1)+' timer drift');
   for(const phase of t.steps[j].phases){
     phases++;
     if(phase.timer_approved!==false||phase.can_auto_start!==false)errors.push('#'+r.id+' timer approved without editorial signoff');
     if(phase.min_seconds<=0||phase.max_seconds<phase.min_seconds)errors.push('#'+r.id+' invalid timer range');
   }
 }
 sources+=r.recipe_sources.length;
}
if(steps!==504||phases!==timer.stats.phases)errors.push('Unexpected totals '+[sources,steps,phases].join('/'));
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('PASS: 100 selected single-source records, 504 synchronized cooking steps, '+phases+' unapproved timer proposals. Source full-text certification is a separate outstanding step.');
