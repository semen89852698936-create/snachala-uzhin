#!/usr/bin/env node
'use strict';
// Validate curated manual timer reminders. Never overwrite human-edited approval data.
const fs=require('node:fs'),path=require('node:path');
const base=__dirname;
const recipes=JSON.parse(fs.readFileSync(path.join(base,'WORLD_100_RECIPES.json'),'utf8')).recipes;
const timer=JSON.parse(fs.readFileSync(path.join(base,'WORLD_100_STEP_TIMER_PHASES.json'),'utf8'));
const expr=/(\\d+(?:[.,]\\d+)?)(?:\\s*[–-]\\s*(\\d+(?:[.,]\\d+)?))?\\s*(секунд(?:ы|у)?|минут(?:ы|у)?|мин\\.?|час(?:а|ов)?)/gi;
const seconds=(x,unit)=>Math.round(Number(x.replace(',','.'))*(unit.startsWith('час')?3600:unit.startsWith('сек')?1:60));
const errors=[];let phases=0,steps=0;
if(recipes.length!==100||timer.recipes.length!==100)errors.push('100 recipes required');
for(const [i,r] of recipes.entries()){
 const t=timer.recipes[i];
 if(!t||t.id!==r.id||t.steps.length!==r.steps.length){errors.push('Recipe '+r.id+' step mismatch');continue;}
 for(const [j,txt] of r.steps.entries()){
  steps++;const s=t.steps[j],matches=[...txt.matchAll(expr)];
  if(s.step_text!==txt||s.phases.length!==matches.length)errors.push('Recipe '+r.id+' step '+(j+1)+' text/phase drift');
  if(s.auto_advance_after_timer!==false||s.completion_requires_user_confirmation!==true)errors.push('Auto-complete forbidden '+r.id+':'+(j+1));
  for(const [k,m] of matches.entries()){
   const p=s.phases[k];phases++;
   if(!p||p.quoted_duration!==m[0]||p.min_seconds!==seconds(m[1],m[3])||p.max_seconds!==seconds(m[2]||m[1],m[3]))errors.push('Duration drift '+r.id+':'+(j+1)+':'+(k+1));
   if(!p||p.timer_approved!==true||p.approval_scope!=='MANUAL_COUNTDOWN_REMINDER_ONLY'||p.can_auto_start!==false||p.can_auto_advance!==false||p.requires_manual_start!==true||p.requires_manual_step_completion!==true)errors.push('Unsafe approval '+r.id+':'+(j+1)+':'+(k+1));
  }
 }
}
if(steps!==504||phases!==296||timer.stats.phases!==296)errors.push('Expected 504 steps and 296 phases');
if(errors.length){console.error(errors.join('\\n'));process.exit(1)}
console.log('PASS: 100 recipes, 504 steps, 296 approved manual countdown reminders, zero automatic starts/transitions. A timer is not proof of food safety.');
