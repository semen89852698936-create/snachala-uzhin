#!/usr/bin/env python3
"""Produce 100 DISTINCT locally-stored food photographs from lawful source pages.

All deliverables are checked JPEG/PNG/WEBP inputs, transformed to 1200x900 WebP.
100 images != 100 editorially approved exact ingredient-level matches.
Keep attribution/CC license metadata and DO NOT auto-publish on production.
"""
from __future__ import annotations
import concurrent.futures
import csv, hashlib, html, io, json, os, random, re, shutil, sys, time, urllib.parse, urllib.request, urllib.error, zipfile
from pathlib import Path
from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'photo-library'/'batch-100-20261101'
ASSETS=OUT/'photos'
ASSETS.mkdir(parents=True,exist_ok=True)
ROWS=list(csv.DictReader((ROOT/'photo-library'/'recipe-photo-registry.csv').open(encoding='utf-8-sig',newline='')))[:100]
assert len(ROWS)==100 and [int(x['n']) for x in ROWS]==list(range(1,101))
HEADERS={'User-Agent':'SNachalaUzhinPhotoEditor/1.0 (https://github.com/semen89852698936-create/snachala-uzhin; CC food image research)','Accept':'application/json,image/*,*/*'}
GROUPS={
'beef_meda':(21,28,['beef steak plate','beef tenderloin steak','filet mignon beef','beef medallions']),
'pork_tend':(29,38,['pork tenderloin dish','pork loin dinner','roasted pork fillet','pork chops sauce']),
'meatballs':(39,48,['meatballs tomato sauce','meatballs cooked plate','meatballs with gravy','beef meatballs']),
'beef_stew':(49,58,['beef stew meat vegetables','beef goulash plate','beef bourguignon','beef casserole']),
'pork_meda':(59,68,['pork medallions plated','roast pork slices','pork filet dinner','pork tenderloin dish','pork loin plated','roasted pork medallions','pork schnitzel']),
'veal':(69,78,['veal cutlet dinner','veal schnitzel plate','wiener schnitzel plated','schnitzel with potatoes','wienerschnitzel','veal escalope cooked','veal chop plate']),
'lamb':(79,88,['lamb stew plated','lamb dinner herbs','braised lamb','lamb casserole']),
'roast_beef':(89,98,['roast beef plate','roast beef dinner','roast beef sliced','prime rib roast beef','roast beef with vegetables','Sunday roast beef dinner','beef roast meat plate']),
'stir_fry':(99,100,['stir fry beef strips','beef stir fry plate','beef strips pan']),
}
FIRST={
1:'pasta with lemon spinach',2:'spaghetti basil tomato',3:'beef steak garlic butter',
4:'meatballs tomato sauce',5:'salmon lemon herbs',7:'ratatouille baked vegetables',
8:'chickpeas spinach',9:'focaccia rosemary',11:'tomato soup basil',12:'ramen egg',
13:'chocolate brownies',14:'baked apples cinnamon',15:'roast chicken lemon herbs',
16:'turkey escalope',17:'greek salad',18:'tabbouleh salad',19:'shakshuka'
}
GROUP_OF={}
for g,(lo,hi,_) in GROUPS.items():
 for n in range(lo,hi+1): GROUP_OF[n]=g
ALLOWED=('CC BY ','CC BY-SA ','CC0','Public domain','Public Domain')
EXCLUDE=('raw meat','uncooked','cartoon','diagram','logo','map','building','restaurant interior','wallpaper','calendar','butcher','butchering','black and white','poster','advertisement','food packaging','storefront','vegetarian','vegan meat','plastic','signage','menu','taco','po-boy','po boy','sandwich','sub sandwich','profiterole','restaurant storefront','sculpture')
def get(url,timeout=25,limit=8000000):
 err=None
 for i in range(3):
  try:
   req=urllib.request.Request(url,headers=HEADERS)
   with urllib.request.urlopen(req,timeout=timeout) as h:
    typ=h.headers.get('Content-Type','').lower()
    data=h.read(limit+1)
    if len(data)>limit: raise ValueError('File above per-image limit')
    if h.status!=200: raise ValueError('HTTP '+str(h.status))
    return data,typ
  except (ValueError,OSError,urllib.error.HTTPError) as e:
   err=e
   time.sleep(0.25+(i*.65))
 raise RuntimeError('%s %s'%(url,str(err)))
def search(query,limit=50,offset=0):
 args={'action':'query','generator':'search','gsrsearch':'filetype:bitmap '+query,'gsrnamespace':'6','gsrlimit':str(limit),'gsroffset':str(offset),'prop':'imageinfo','iiprop':'url|size|extmetadata','iiurlwidth':'1280','format':'json'}
 url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(args)
 try:
  data,_=get(url,timeout=18)
  o=json.loads(data)
  return list(o.get('query',{}).get('pages',{}).values())
 except Exception as e:
  print('SEARCH ERROR',query,str(e)[:180],flush=True)
  return []
def title_clean(s): return re.sub(r'<[^>]*>','',html.unescape(s or '')).strip()
def candidate(page):
 info=(page.get('imageinfo') or [None])[0]
 if not info:return None
 name=page.get('title','')
 name_l=name.lower()
 if not name.lower().endswith(('.jpg','.jpeg','.png','.webp')):return None
 if any(b in name_l for b in EXCLUDE): return None
 if info.get('width',0)<950 or info.get('height',0)<690:return None
 if not .52<info['width']/info['height']<2.5:return None
 meta=info.get('extmetadata',{})
 license=title_clean(meta.get('LicenseShortName',{}).get('value',''))
 if not license.startswith(ALLOWED):return None
 artist=title_clean(meta.get('Artist',{}).get('value',''))
 artist=artist[:250]
 credit=title_clean(meta.get('Credit',{}).get('value',''))[:250]
 url=info.get('thumburl') or info.get('url')
 if not url:return None
 page_url=info.get('descriptionurl') or 'https://commons.wikimedia.org/wiki/'+urllib.parse.quote(name.replace(' ','_'))
 return {'source':'Wikimedia Commons','title':name[5:],'url':url,'source_page':page_url,'author':artist,'credit':credit,'license':license,'license_url':title_clean(meta.get('LicenseUrl',{}).get('value','')),'width':info['width'],'height':info['height']}
def search_pool(queries):
 out={}
 for q in queries:
  for p in search(q,50):
   c=candidate(p)
   if c:out.setdefault(c['source_page'],c)
 return list(out.values())
def score(c,words):
 title=c['title'].lower()
 s=0
 for w in words:
  if w in title:s+=5
 s+=min(5,min(c['width'],c['height'])//650)
 for bad in ('takeaway','sandwich','salad','soup','curry','burger','uncooked','raw','sushi','hot dog','breakfast','preparation','potatoes only','taco','sandwich','po-boy','po boy','calendar','advertisement','profiteroles','noodles only'):
  if bad in title:s-=12
 if 'plate' in title or 'dish' in title or 'with' in title:s+=3
 return s
def groups():
 pools={}
 for group,(_,_,queries) in GROUPS.items():
  print('SEARCHING GROUP',group,queries,flush=True)
  a=search_pool(queries)
  pools[group]=a
  print('CANDIDATES',group,len(a),flush=True)
 for n,q in FIRST.items():
  a=search_pool([q])
  pools['first'+str(n)]=a
  print('CANDIDATES FIRST',n,len(a),flush=True)
 return pools
def fav(c,group,idx):
 flavor=['lemon','mushroom','mustard','paprika','tomato','ginger','onion','pepper','apple','prune']
 names={'beef_meda':['beef','steak','filet','tenderloin','medallion'],'pork_tend':['pork','loin','roast','tenderloin'],'meatballs':['meatball','minced','ground'],'beef_stew':['beef','stew','goulash','braised'],'pork_meda':['pork','filet','loin'],'veal':['veal','cutlet','schnitzel'],'lamb':['lamb','mutton','stew'],'roast_beef':['roast','beef'],'stir_fry':['beef','fry','strips']}
 return score(c,names[group]+[flavor[idx%10]]) if group in names else score(c,['food','dish','plate'])
def build_image(data,dest):
 im=Image.open(io.BytesIO(data))
 im.load()
 if im.width<550 or im.height<460:raise ValueError('Tiny decoded image')
 if im.mode not in ('RGB','RGBA'):im=im.convert('RGB')
 im=ImageOps.exif_transpose(im)
 im=im.convert('RGB')
 # Crop in 4:3 while preserving central food subject
 output=ImageOps.fit(im,(1200,900),Image.Resampling.LANCZOS,centering=(.5,.49))
 # Reject one-color icons and extremely dark images
 stat=ImageStat.Stat(output.resize((40,30)))
 if sum(stat.stddev)/3<18:raise ValueError('Low photo detail')
 output.save(dest,'WEBP',quality=87,method=6)
 check=Image.open(dest);check.load()
 if check.size!=(1200,900) or check.format!='WEBP':raise ValueError('Corrupt output')
 return hashlib.sha256(dest.read_bytes()).hexdigest()
POOLS=groups()
used_urls=set()
finished=[]
failed=[]
for row in ROWS:
 n=int(row['n']); slug=row['recipe_id']; title=row['title']; out=ASSETS/f'{n:03d}-{slug}.webp'
 rec={'number':n,'recipe_id':slug,'title':title,'file':str(out.relative_to(OUT)),'format':'WebP','size':[1200,900],'status':'physical_image_ready_not_editorially_approved','exact_ingredient_match_verified':False}
 if n in (6,10,20):
  orig=ROOT/(row['photo_url'])
  assert orig.is_file(),str(orig)
  sha=build_image(orig.read_bytes(),out)
  rec.update({'source':'Pexels (previously approved by owner)','source_page':row['source_page'],'author':'See main photo-library/approved-webp-20261101.json','license':row['license'],'license_url':'https://www.pexels.com/license/','sha256':sha,'owner_approved_prior_image':True})
  finished.append(rec);print('READY',n,title,'prior approved',flush=True);continue
 choices=[]
 # The 17 currently reviewed / published direct-image sources are preferred.
 if n<=20 and row['photo_url'].startswith('https://'):
  choices.append({'url':row['photo_url'],'source_page':row['source_page'],'author':'See source page','license':row['license'],'license_url':'','source':'previously published external image','title':title,'owner_approved_prior_image':False})
 g=GROUP_OF.get(n)
 if g:
  pool=POOLS.get(g,[])
  must={'beef_meda':['beef','steak','filet','tenderloin','medallion'], 'pork_tend':['pork','loin'], 'meatballs':['meatball','köttbullar'], 'beef_stew':['beef','bourguignon','goulash'], 'pork_meda':['pork'], 'veal':['veal','schnitzel','wiener','escalope','schnitzel'], 'lamb':['lamb','mutton'], 'roast_beef':['roast beef','beef roast','prime rib','rib roast'], 'stir_fry':['beef','stir fry','stir-fry']}[g]
  pool=[c for c in pool if any(x in c['title'].lower() for x in must)]
  pool.sort(key=lambda c:(fav(c,g,(n-21)%10),c['width']),reverse=True)
 else:
  pool=POOLS.get('first'+str(n),[])
  pool.sort(key=lambda c:score(c,title.lower().split()),reverse=True)
 choices.extend(pool)
 if g:
  # Robust but relevant category fallback
  fallback=['meatballs','beef_meda','pork_tend','beef_stew','pork_meda','veal','lamb','roast_beef','stir_fry']
  for gg in fallback:
   if gg!=g and len(choices)<22:
    for candidate_item in POOLS.get(gg,[])[:3]:
     if g!='veal' or any(key in candidate_item['title'].lower() for key in ['veal','schnitzel','wiener','escalope']):choices.append(candidate_item)
 success=False;last_error=''
 for cand in choices:
  url=cand['url']
  if url in used_urls or cand.get('source_page','') in used_urls:continue
  try:
   data,typ=get(url,timeout=23,limit=8000000)
   if not ('image' in typ or data[:4] in (b'\xff\xd8\xff\xe0',b'RIFF') or data[:8]==b'\x89PNG\r\n\x1a\n'):raise ValueError('not image '+typ)
   sha=build_image(data,out)
   if out.stat().st_size<35000:raise ValueError('Unusually small photo: '+str(out.stat().st_size))
   rec.update({k:cand.get(k,'') for k in ('source','source_page','author','license','license_url','title') if k!='title'})
   rec['source_photo_title']=cand.get('title')
   rec['sha256']=sha
   rec['bytes']=out.stat().st_size
   rec['owner_approved_prior_image']=cand.get('owner_approved_prior_image',False)
   rec['image_caption_match_review']='pending_editorial_review' if n>20 else 'preexisting_published_reference_not_reapproved'
   used_urls.add(url);used_urls.add(cand.get('source_page',url))
   finished.append(rec);success=True
   print('READY',n,title,rec['source_photo_title'][:80],out.stat().st_size,'bytes',flush=True)
   break
  except Exception as e:
   last_error=str(e)[:180]
   try:out.unlink(missing_ok=True)
   except:pass
 if not success:
  failed.append({'n':n,'title':title,'reason':last_error,'candidates':len(choices)})
  print('FAILED',n,title,last_error,flush=True)
records={'delivery':'100 distinct food photograph files, NOT exact-ingredient editorial approval','date':'2026-11-01','total_recipes_in_requested_batch':100,'photo_files':len(finished),'missing':failed,'sources':finished,'license_caution':'Keep photo source and author attribution linked. Some images are Creative Commons BY-SA; modified crops require CC BY-SA for derivative photos; not the website as a whole.'}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with (OUT/'licenses-and-sources.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=['number','recipe_id','title','file','source','source_page','author','license','license_url','source_photo_title','sha256','exact_ingredient_match_verified'])
 w.writeheader()
 for rec in finished:w.writerow({k:rec.get(k,'') for k in w.fieldnames})
page=['<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>СНАЧАЛА УЖИН — 100 фото рецептов</title><style>body{font:16px system-ui;background:#f7eee7;color:#442923;margin:2rem}h1{font-size:2rem}.note{max-width:70rem;line-height:1.6}section{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px}article{background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 14px #44292316}img{width:100%;aspect-ratio:4/3;object-fit:cover}h2{font-size:15px;margin:12px}small{display:block;margin:12px;color:#786d69}a{color:#762f38}</style><h1>СНАЧАЛА УЖИН · фотобиблиотека</h1><p class="note">Готовые файлы WebP. Проверены размер и кодирование, индивидуальные источники и лицензии сохранены. <strong>Точное соответствие ингредиентам ещё требует редакционной проверки.</strong> Это рабочая подборка, не опубликованное меню.</p><section>']
for rec in finished:
 href=rec['file']
 title=html.escape(rec['title']);source=html.escape(rec.get('source_page',''))
 page.append(f'<article><img src="{href}" loading="lazy" alt="{title}"><h2>{rec["number"]:03d}. {title}</h2><small><a href="{source}" target="_blank" rel="noopener noreferrer">Источник и лицензия</a></small></article>')
page.append('</section></html>')
(OUT/'index.html').write_text('\n'.join(page),encoding='utf-8')
with zipfile.ZipFile(OUT/'100-photos-20261101.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=5) as z:
 for photo in sorted(ASSETS.glob('*.webp')):z.write(photo,photo.name)
 z.write(OUT/'licenses-and-sources.csv','licenses-and-sources.csv')
 z.write(OUT/'manifest.json','manifest.json')
print('FINAL',json.dumps({'created':len(finished),'failed':len(failed),'zip_mb':round((OUT/'100-photos-20261101.zip').stat().st_size/1e6,2),'first_error':failed[:5]},ensure_ascii=False),flush=True)
if len(finished)<100:sys.exit(2)
