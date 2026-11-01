#!/usr/bin/env python3
"""Fetch three explicitly approved Pexels photos, store local WebP, and patch the site.
This runs only on the dedicated photo-library branch, never automatically on production.
"""
from io import BytesIO
from pathlib import Path
import csv, hashlib, json, re, time
from urllib.request import Request, urlopen
from PIL import Image, ImageOps, ImageFilter

P = Path
branch = 'photo-library-1001-registry-20261101-1323'
items = [
    {'recipe_id':'med-fish','num':6,'pexels_id':12653398,'file':'white-fish-tomatoes.webp','title':'Белая рыба с томатами','author':'Sylwester Ficek','url':'https://www.pexels.com/photo/close-up-of-gourmet-meal-12653398/','center':(0.5,0.5)},
    {'recipe_id':'pancakes','num':10,'pexels_id':7855285,'file':'kefir-oladki.webp','title':'Пышные оладьи на кефире','author':'Anna Pyshniuk','url':'https://www.pexels.com/photo/mini-pancakes-on-a-plate-7855285/','center':(0.43,0.47)},
    {'recipe_id':'syrniki','num':20,'pexels_id':10254478,'file':'syrniki-lemon-zest.webp','title':'Домашние сырники с лимонной цедрой','author':'Yulia Ilina','url':'https://www.pexels.com/photo/close-up-shot-of-syrniki-10254478/','center':(0.5,0.5)}
]
html_path=P('index.html')
html=html_path.read_text(encoding='utf-8')
old_fn="const photo=id=>/^https:\\/\\//.test(id)?id:`https://images.unsplash.com/${id}?w=760&fit=crop&q=78&auto=format`;"
new_fn="const photo=id=>id.startsWith('assets/')?id:(/^https:\\/\\//.test(id)?id:`https://images.unsplash.com/${id}?w=760&fit=crop&q=78&auto=format`);"
assert old_fn in html or new_fn in html, 'Unknown photo URL function'
html=html.replace(old_fn,new_fn,1)
approved=[]
for p in items:
    url=f"https://images.pexels.com/photos/{p['pexels_id']}/pexels-photo-{p['pexels_id']}.jpeg?auto=compress&cs=tinysrgb&w=1800"
    for attempt in range(3):
        try:
            request=Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; approved recipe gallery)'})
            with urlopen(request,timeout=35) as response:
                data=response.read()
                assert response.headers.get('Content-Type','').startswith('image/'), 'Not an image'
            break
        except Exception:
            if attempt==2: raise
            time.sleep(3*(attempt+1))
    image=Image.open(BytesIO(data)).convert('RGB')
    if image.width>=image.height:
        image=ImageOps.fit(image,(1200,900),method=Image.Resampling.LANCZOS,centering=p['center'])
    else:
        background=ImageOps.fit(image,(1200,900),method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(36))
        background=Image.blend(background,Image.new('RGB',(1200,900),'#4a433f'),0.13)
        foreground=ImageOps.contain(image,(850,900),method=Image.Resampling.LANCZOS)
        background.paste(foreground,((1200-foreground.width)//2,(900-foreground.height)//2))
        image=background
    path=P('assets')/p['file']
    image.save(path,'WEBP',quality=84,method=6)
    with Image.open(path) as check:
        assert check.format=='WEBP' and check.size==(1200,900)
    pattern=r'("id":"'+re.escape(p['recipe_id'])+r'"[^\n]{0,420}?"photo":")([^"]+)(")'
    m=re.search(pattern,html)
    assert m, 'Missing recipe '+p['recipe_id']
    previous=m.group(2)
    html=html[:m.start(2)]+str(path)+html[m.end(2):]
    approved.append({**{k:v for k,v in p.items() if k!='center'},'file_path':str(path),'previous_photo':previous,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'dimensions':[1200,900],'license':'Pexels License','license_url':'https://www.pexels.com/license/','owner_approved':True,'source_page_checked':True,'webp_verified':True,'published':False})
    print('Produced',path,path.stat().st_size,'bytes')

m=re.search(r'<script id="recipeData" type="application/json">([\s\S]*?)</script>',html)
assert m, 'Recipe JSON missing'
recipes=json.loads(m.group(1))
assert len(recipes)==1001 and len({x['id'] for x in recipes})==1001
for a in approved:
    assert next(r for r in recipes if r['id']==a['recipe_id'])['photo']==a['file_path']
html_path.write_text(html,encoding='utf-8')

photolist=P('photo-library/first20-licensed-preview-20261101.json')
existing=json.loads(photolist.read_text(encoding='utf-8'))
for r in existing['assets']:
    for a in approved:
        if r['recipe_id']==a['recipe_id']:
            r.update({'verified_original_downloaded':True,'final_asset_approved':True,'local_file':a['file_path'],'local_webp_sha256':a['sha256'],'webp_size_bytes':a['bytes'],'site_photo_published':False,'publication_pending_deploy':True,'source_page':a['url']})
photolist.write_text(json.dumps(existing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

csv_path=P('photo-library/recipe-photo-registry.csv')
with csv_path.open(newline='',encoding='utf-8') as f:
    reader=csv.DictReader(f); headers=reader.fieldnames; rows=list(reader)
assert len(rows)==1001
for r in rows:
    for a in approved:
        if r['recipe_id']==a['recipe_id']:
            r.update({'current_photo_identifier':a['file_path'],'state':'local_webp_owner_approved','photo_url':a['file_path'],'source_page':a['url'],'license':a['license'],'visual_match':'Owner approved local WebP; ingredients may be illustrative','local_file_exists':'true','visual_reviewed':'true','publication_approved':'true'})
with csv_path.open('w',newline='',encoding='utf-8') as f:
    writer=csv.DictWriter(f,fieldnames=headers);writer.writeheader();writer.writerows(rows)

summary_path=P('photo-library/summary.json')
summary=json.loads(summary_path.read_text(encoding='utf-8'))
summary.update({'first20LocallyStoredFiles':3,'first20FinalImageApproved':3,'distinctImageFilesLocallyConfirmed':3,'lastApprovedWebpBatch':'photo-library/approved-webp-20261101.json'})
summary_path.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
P('photo-library/approved-webp-20261101.json').write_text(json.dumps({'approved_date':'2026-11-01','status':'approved_local_ready_for_test','images':approved},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Verified exactly 1001 recipes; only three intended photo IDs replaced.')
