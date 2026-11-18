#!/usr/bin/env node
// Editorial QA for the first ten Russian soups. Runs without packages.
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname);
const files = ['russian-01-03.md','russian-04.md','russian-05-10.md'];
const text = files.map(f => fs.readFileSync(path.join(base, f),'utf8')).join('\n\n');
const sections = [...text.matchAll(/(?:^|\n)#{1,3} №(\d+)\. /g)];
const failures = [];
if (sections.length !== 10) failures.push('Expected 10 numbered recipe headings, got '+sections.length);
const numbers = sections.map(m=>Number(m[1]));
if (numbers.join(',') !== '1,2,3,4,5,6,7,8,9,10') failures.push('Recipe numbering is not sequential 1..10');
for (let i=0; i<sections.length; i++) {
  const section=text.slice(sections[i].index, sections[i+1]?.index ?? text.length);
  const urls=[...section.matchAll(/https:\/\/[^\s)]+/g)].map(m=>m[0].replace(/[.,]$/,''));
  const hosts=new Set(urls.map(u=>u.slice(8).split('/')[0].replace(/^www\./,'')));
  const actions=[...section.matchAll(/(?:^|\s)(\d+)\.\s/g)].length;
  const n=numbers[i];
  if (hosts.size < 3) failures.push('#'+n+': fewer than three independent recipe source hosts');
  if (actions < 5) failures.push('#'+n+': fewer than five written cooking steps');
  if (section.length < 900) failures.push('#'+n+': recipe looks incomplete');
  if (!/фото|выгляд|визуаль/i.test(section)) failures.push('#'+n+': no visual brief');
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('PASS: 10 sequential soup recipes, 3+ independent source domains, 5+ steps and visual briefs.');
