#!/usr/bin/env python3
"""Verify all 1001 photos and their exact links in both catalog HTML pages."""
import json, re, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
photos=json.loads((root/"photo-library/ai-recipe-photo-map.json").read_text(encoding="utf-8"))["photos"]
assert len(photos)==1001
assert len({p["recipe_id"] for p in photos})==1001
for i,p in enumerate(photos,1):
    assert p["n"]==i
    file=root/p["path"].lstrip("/")
    binary=file.read_bytes()
    assert len(binary)==p["bytes"],(i,"size")
    assert binary.startswith(b"RIFF") and binary[8:12]==b"WEBP",(i,"format")
    gitsha=hashlib.sha1(b"blob "+str(len(binary)).encode()+b"\0"+binary).hexdigest()
    assert gitsha==p["sha"],(i,"gitsha")
for url in ("index.html","full-catalog/index.html"):
    html=(root/url).read_text(encoding="utf-8")
    match=re.search(r'<script id="recipeData" type="application/json">(.*?)</script>',html,re.S)
    assert match,url
    data=json.loads(match.group(1))
    assert len(data)==1001,url
    for i,(recipe,photo) in enumerate(zip(data,photos),1):
        assert recipe["id"]==photo["recipe_id"],(url,i,"id")
        assert recipe["photo"]==photo["path"],(url,i,"path")
    assert 'href="#evening" data-nav="evening">Наш вечер</a>' in html,url
    assert 'href="#evening">Наш вечер</a>' in html,url
    assert '.main-nav a[data-nav="evening"]' in html,url
    assert 'function renderRecipes()' in html,url
    assert 'function renderRecipe(' in html,url
    for cat in ("meat","poultry","fish","pasta","vegetables","pastry","soup","salads","dessert","breakfast"):
        assert re.search(r"\{id:'"+cat+r"',[^\n]*photo:'/assets/recipes-ai/[^']+\.webp'",html),(url,cat)
    print("PASS",url,"1001 image mappings, 10 category images, prominent Our Evening CTA")

from html.parser import HTMLParser
class MusicEmbedParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.players=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=="iframe" and "/embed/playlist/" in attrs.get("src",""):
            self.players.append(attrs)
playlists=json.loads((root/"music/spotify-playlists.json").read_text(encoding="utf-8"))["spotify"]
assert len(playlists)==3
for key in ("cooking","dinner","continue"):
    playlist=playlists[key]
    assert len(playlist["proposedTracks"])==20,(key,len(playlist["proposedTracks"]))
    assert len({(r["title"],r["artist"]) for r in playlist["proposedTracks"]})==20,key
    assert playlist["spotifyPlaylistCountVerified"] is False,"Do not claim official playlist is 20 until Spotify verified"
for url in ("index.html","full-catalog/index.html"):
    html=(root/url).read_text(encoding="utf-8")
    reader=MusicEmbedParser()
    reader.feed(html)
    assert len(reader.players)==3,(url,"embedded Spotify players",len(reader.players))
    for key,player in zip(("cooking","dinner","continue"),reader.players):
        pid=playlists[key]["playlistUrl"].rsplit("/",1)[-1]
        assert "/embed/playlist/"+pid in player["src"],(url,key)
        assert "autoplay" in player.get("allow",""),(url,key)
    assert 'id="du-music-player"' not in html,(url,"bottom player must be removed")
    assert 'id="du-music-iframe"' not in html,(url,"single floating player must be removed")
    assert 'data-music-track="' not in html,(url,"faux inline play buttons must be removed")
    cards=re.findall(r'<details class="du-music-suggestions" open>(.*?)</details>',html,re.S)
    assert len(cards)==3,(url,"3 music sections",len(cards))
    from html import unescape
    for key,card in zip(("cooking","dinner","continue"),cards):
        assert "<summary>20 песен" in card,(url,key,"visible track count")
        assert "du-bpm-explainer" not in card,(url,key,"technical explanation remains")
        assert "Песни с указанным темпом" not in card,(url,key,"technical caption remains")
        rows=re.findall(r'<li class="du-bpm-track">.*?<strong>(.*?)</strong><span>(.*?)</span>.*?<span class="du-bpm-pill">(\d+) BPM</span></li>',card,re.S)
        expected=playlists[key]["proposedTracks"]
        assert len(rows)==len(expected)==20,(url,key,"exact 20 tracks")
        assert [(unescape(t),unescape(a),int(b)) for t,a,b in rows]==[(x["title"],x["artist"],x["bpm"]) for x in expected],(url,key,"playlist metadata mismatch")
        values=[int(b) for _,_,b in rows]
        low,high={"cooking":(120,999),"dinner":(80,100),"continue":(0,80)}[key]
        assert all(low<=v<=high for v in values),(url,key,"BPM outside phase",values)
    print("PASS",url,"3 embedded playlist players, 20 curated and tempo-checked tracks per section")
print("PASS 1001 unique WebP, exact file sizes, Git blob hashes, Spotify playlist metadata")

