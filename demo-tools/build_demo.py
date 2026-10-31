#!/usr/bin/env python3
"""Build isolated demo from owner-approved live homepage; never overwrite production index."""
from pathlib import Path
from urllib.request import Request, urlopen
import re, shutil
root=Path(__file__).resolve().parents[1]
demo=root/"demo"
demo.mkdir(exist_ok=True)
url="https://snachala-uzhin-preview.vercel.app/"
request=Request(url,headers={"User-Agent":"SnachalaUzhin-DemoQA/1.0"})
with urlopen(request,timeout=45) as response:
    if response.status!=200: raise RuntimeError(f"Approved baseline HTTP {response.status}")
    source=response.read().decode("utf-8")
if len(source)<100000 or 'recipeData' not in source or '1001' not in source:
    raise RuntimeError("Approved baseline missing expected catalog; abort")
if not re.search(r"</body>",source,re.I): raise RuntimeError("Baseline lacks closing body")
nav='''<a id="our-evening-demo-link" href="nashe-vecher.html" aria-label="Открыть Наш вечер" style="position:fixed;right:16px;bottom:16px;z-index:9999;background:#7f3d51;color:white;padding:13px 20px;border-radius:999px;font:700 16px/1.4 Arial,sans-serif;text-decoration:none;box-shadow:0 8px 25px #39242c55">🍷 Наш вечер</a>'''
source=re.sub(r"</body>",nav+"\n</body>",source,count=1,flags=re.I)
(demo/"index.html").write_text(source,encoding="utf-8")
shutil.copyfile(root/"nashe-vecher.html",demo/"nashe-vecher.html")
print("Prepared demo homepage and evening page from live approved source")
