const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
  let anyFailed=false;
  const targets=[
    {name:'checkout',url:'http://127.0.0.1:8765/'},
    {name:'vercel',url:process.env.EVENING_PUBLIC_PREVIEW}
  ].filter(x=>x.url);
  const report=[];
  for(const target of targets)for(const size of [{width:1672,height:941,label:'desktop'},{width:390,height:844,label:'mobile'}]){
    const page=await browser.newPage({viewport:{width:size.width,height:size.height},deviceScaleFactor:1});
    const entry={target:target.name,view:size.label,url:target.url,errors:[]};
    page.on('pageerror',e=>entry.errors.push(e.message));
    try{
      await page.goto(target.url+'#evening',{waitUntil:'domcontentloaded',timeout:40000});
      await page.waitForFunction(()=>document.body.classList.contains('du-evening-mode'),{timeout:16000});
      await page.waitForSelector('#eveningLanding .du-match11-hero',{timeout:16000});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(1400);
      entry.initialHeroY=await page.locator('#eveningLanding .du-match11-hero').evaluate(e=>e.getBoundingClientRect().y);
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.waitForTimeout(220);
      entry.metrics=await page.evaluate(()=>{
        const hero=document.querySelector('#eveningLanding .du-match11-hero');
        const photo=hero?.querySelector('.du-match11-photo img');
        const slogan=hero?.querySelector('.du-match11-slogan');
        const anchors=[...hero.querySelectorAll('.du-match11-actions a')];
        const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null};
        return {
          hero:rect(hero),photo:rect(photo),photoLoaded:!!(photo&&photo.complete&&photo.naturalWidth>0),
          backLink: (()=>{const e=hero?.querySelector('.du-match11-sr-back');return e?{text:e.textContent,href:e.getAttribute('href'),rect:rect(e),display:getComputedStyle(e).display,clip:getComputedStyle(e).clipPath}:null})(),
          titleRect:rect(hero?.querySelector('h1')),
          heading:hero?.querySelector('h1')?.textContent,
          slogan:slogan?.textContent,
          rotation:getComputedStyle(slogan).transform,
          buttons:anchors.map(a=>({text:a.textContent.trim(),href:a.getAttribute('href'),rect:rect(a)})),
          recipeLinks:document.querySelectorAll('#eveningLanding .du-match11-recipe-grid a').length,
          scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth
        };
      });
      const pic='/tmp/approved-evening-'+target.name+'-'+size.label+'.png';
      await page.screenshot({path:pic,fullPage:false});
      entry.screenshot=pic;
      const m=entry.metrics;
      const checks=[
        m.photoLoaded,
        m.heading?.replace(/\s+/g,'').toLowerCase()==='нашвечер',
        m.buttons.length===2,
        m.buttons[0].href==='#eveningBuilder',
        m.buttons[1].href==='#catalog',
        m.recipeLinks===3,
        m.scrollWidth<=m.viewport+6,
        m.rotation.startsWith('matrix(0.984808, -0.173648'),
        m.hero.y >= -2 && m.hero.y < (size.width<700 ? 200 : 120),
        m.backLink?.href==='#home',
        m.backLink?.display!=='none',
        m.backLink?.rect?.w>=110,
        m.backLink?.rect?.h>=38,
        m.backLink?.rect?.y < m.titleRect.y + m.titleRect.h/2,
        m.backLink?.rect?.x + m.backLink?.rect?.w <= m.viewport+1
      ];
      await page.locator('#eveningLanding .du-match11-sr-back').click({timeout:5000});
      await page.waitForTimeout(280);
      entry.backNavigation={hash:await page.evaluate(()=>location.hash),isEvening:await page.evaluate(()=>document.body.classList.contains('du-evening-mode'))};
      checks.push(entry.backNavigation.hash==='#home' && !entry.backNavigation.isEvening);
      entry.passed=checks.every(Boolean);
      if(!entry.passed){entry.errors.push('One or more layout/interaction assertions failed: '+JSON.stringify(checks));anyFailed=true;}
    }catch(e){entry.passed=false;entry.errors.push(String(e));if(target.name==='checkout')anyFailed=true;}
    report.push(entry);await page.close();
  }
  fs.writeFileSync('/tmp/approved-evening-results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
  if(anyFailed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
