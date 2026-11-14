#!/usr/bin/env python3
"""Open the exact published Vercel URL in a real browser and inspect poultry UI."""
import json,shutil,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path("audit/poultry-published-20261115")
OUT.mkdir(parents=True,exist_ok=True)
URL="https://snachala-uzhin-preview-aauuwf5y1-chaika2.vercel.app/full-catalog/"
result={"url":URL,"browser":"chromium","screenshots":[]}
try:
    with sync_playwright() as p:
        kw={"headless":True}
        chrome=shutil.which("google-chrome") or shutil.which("chromium")
        if chrome:kw["executable_path"]=chrome
        browser=p.chromium.launch(**kw)
        for label,width,height in [("desktop",1440,900),("mobile",390,844)]:
            page=browser.new_page(viewport={"width":width,"height":height},device_scale_factor=1,
                                  locale="ru-RU")
            errors=[]
            page.on("pageerror",lambda err:errors.append(str(err)))
            response=page.goto(URL,wait_until="domcontentloaded",timeout=45000)
            page.locator('[data-filter="poultry"]').wait_for(timeout=30000)
            page.locator('[data-filter="poultry"]').click()
            page.wait_for_timeout(1300)
            result[label]={
                "http_status":response.status if response else None,
                "title":page.title(),
                "result_count":page.locator("#resultCount").inner_text(),
                "filter_pressed":page.locator('[data-filter="poultry"]').get_attribute("aria-pressed"),
                "visible_photo_count":page.locator("#recipeGrid img").count(),
                "js_errors":errors
            }
            page.locator("#recipeGrid").scroll_into_view_if_needed()
            page.evaluate("window.scrollBy(0,-125)")
            page.wait_for_timeout(700)
            shot=OUT/f"live-poultry-{label}-top.png"
            page.screenshot(path=str(shot),full_page=False)
            result["screenshots"].append(str(shot))
            page.evaluate("window.scrollBy(0,720)")
            page.wait_for_timeout(400)
            shot=OUT/f"live-poultry-{label}-scroll.png"
            page.screenshot(path=str(shot),full_page=False)
            result["screenshots"].append(str(shot))
            page.close()
        browser.close()
except Exception as exc:
    result["browser_error"]=type(exc).__name__+": "+str(exc)
    result["traceback_end"]=traceback.format_exc()[-1600:]
(OUT/"live-browser-check.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print(json.dumps(result,ensure_ascii=False)[:3000])
