'use strict';
// Browser smoke for the real My Access HTML. All API responses are TEST FIXTURES.
// It does not create payments, accounts or real customer sessions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  fs.mkdirSync('exports',{recursive:true});
  for(const [width,height] of [[1440,900],[390,844]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'ru-RU'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let paid=false;
    await page.route('**/api/me',async route=>{
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        authenticated:paid,has_access:paid,email:paid?'buyer@example.ru':null,
        access_type:paid?'lifetime':null})});
    });
    await page.route('**/api/auth/request-link',async route=>{
      assert.equal(route.request().method(),'POST');
      assert.equal(JSON.parse(route.request().postData()).email,'buyer@example.ru');
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({message:'If subscribed, email sent'})});
    });
    await page.route('**/api/logout',async route=>{
      paid=false;
      await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
    });
    const response=await page.goto('http://127.0.0.1:8777/account.html',{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    await page.locator('#loginForm:not([hidden])').waitFor();
    assert.match(await page.locator('#heading').innerText(),/Войти/);
    await page.locator('#email').fill('buyer@example.ru');
    await page.locator('#sendButton').click();
    await page.waitForFunction(()=>document.querySelector('#sendStatus').textContent.includes('Если на эту почту'));
    paid=true;
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#paid:not([hidden])').waitFor();
    assert.match(await page.locator('#heading').innerText(),/Доступ открыт/);
    assert.equal(await page.locator('#paid a[href="/app"]').count(),1);
    assert.match(await page.locator('#buyerEmail').innerText(),/buyer@example.ru/);
    await page.screenshot({path:path.join('exports','commerce-account-'+width+'.png'),fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    assert.equal(overflow,false,'Horizontal page scroll at width '+width);
    await page.locator('#logoutPaid').click();
    await page.locator('#loginForm:not([hidden])').waitFor();
    assert.match(await page.locator('#heading').innerText(),/Войти/);
    assert.deepEqual(errors,[]);
    console.log('My Access: mobile/desktop login recovery, paid state, logout, viewport '+width+'px OK');
    await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
