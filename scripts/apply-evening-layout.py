#!/usr/bin/env python3
"""Apply the approved 'Наш вечер' two-entry design to the existing single-page site."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
FILE = ROOT / "index.html"

LANDING = """<section id="eveningLanding" class="du-evening-landing container" aria-labelledby="eveningLandingTitle">
  <div class="du-evening-landing-photo">
    <img src="https://images.pexels.com/photos/36305242/pexels-photo-36305242.jpeg?cs=srgb&amp;dl=pexels-marina-grechko-701637593-36305242.jpg&amp;fm=jpg" alt="Романтический ужин вдвоём при свечах" decoding="async">
    <div class="du-evening-landing-caption">✳ Только для вас двоих</div>
    <small class="du-evening-landing-credit">Фото: <a href="https://www.pexels.com/photo/romantic-candlelit-pizza-dinner-at-home-36305242/" target="_blank" rel="noopener noreferrer">Marina Grechko / Pexels</a></small>
  </div>
  <div class="du-evening-landing-content">
    <div class="du-evening-landing-kicker">СНАЧАЛА УЖИН / ОСОБЕННЫЙ РЕЖИМ</div>
    <h1 id="eveningLandingTitle">Наш <em>вечер.</em> <span aria-hidden="true">♡</span></h1>
    <p class="du-evening-landing-lead">Не просто ужин. Время, которое принадлежит только вам двоим.</p>
    <p class="du-evening-landing-text">Выберите настроение, приготовьте вместе, включите музыку. Остальное... без рецепта.</p>
    <div class="du-evening-landing-benefits"><span>🕯️ <b>С настроением</b></span><span>♡ <b>Для двоих</b></span><span>◷ <b>Без спешки</b></span></div>
    <div class="du-evening-pinned" id="eveningPinned" hidden role="status" aria-live="polite"><span>Ваш рецепт: <strong id="eveningPinnedTitle"></strong></span><button id="eveningClearChoice" type="button" aria-label="Убрать выбранный рецепт">×</button></div>
    <a class="du-btn du-btn-primary du-evening-landing-cta" href="#eveningBuilder">Создать наш вечер <span>↗</span></a>
    <div class="du-evening-inspiration">
      <div class="du-evening-inspiration-head"><strong>Идеи для сегодняшнего вечера</strong><small>Или выберите любое блюдо из каталога</small></div>
      <div class="du-evening-inspiration-grid">
        <a class="du-evening-inspiration-card" href="#recipe=salmon-lemon"><img src="https://images.pexels.com/photos/31909815/pexels-photo-31909815.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=480" alt="Лосось с лимоном и зеленью" loading="lazy"><span>Лосось с лимоном<small>25 минут</small></span></a>
        <a class="du-evening-inspiration-card" href="#recipe=tomato-soup"><img src="https://images.pexels.com/photos/27098511/pexels-photo-27098511.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=480" alt="Томатный суп с базиликом" loading="lazy"><span>Томатный суп<small>30 минут</small></span></a>
        <a class="du-evening-inspiration-card" href="#recipe=chocolate-cake"><img src="https://images.pexels.com/photos/30353753/pexels-photo-30353753.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=480" alt="Шоколадный брауни" loading="lazy"><span>Брауни<small>35 минут</small></span></a>
      </div>
      <small class="du-evening-inspiration-credit">Фото: <a href="https://www.pexels.com/photo/gourmet-salmon-fillet-with-herbs-and-lemon-31909815/" target="_blank" rel="noopener noreferrer">Rodrigo Ortega</a>, <a href="https://www.pexels.com/photo/tomato-soup-on-a-table-27098511/" target="_blank" rel="noopener noreferrer">Valeria Boltneva</a>, <a href="https://www.pexels.com/photo/delicious-chocolate-brownies-on-white-plate-30353753/" target="_blank" rel="noopener noreferrer">Giovanna Kamimura</a> / Pexels</small>
    </div>
  </div>
</section>
"""

INVITATION = """<div id="recipeDetail"></div>
<aside class="du-recipe-evening-invite" id="recipeEveningInvite" aria-label="Продолжение вечера">
  <div class="du-recipe-evening-photo"><img src="https://images.pexels.com/photos/36305242/pexels-photo-36305242.jpeg?cs=srgb&amp;dl=pexels-marina-grechko-701637593-36305242.jpg&amp;fm=jpg" alt="Романтический ужин при свечах" loading="lazy"></div>
  <div class="du-recipe-evening-copy">
    <span class="du-recipe-evening-kicker">ПРОДОЛЖЕНИЕ ВЕЧЕРА</span>
    <h2>Ужин готов. <em>А вечер только начинается.</em></h2>
    <p>Добавьте музыку, немного романтики и время только для вас двоих. <span id="eveningFromRecipeTitle"></span> уже выбран.</p>
    <button type="button" id="continueEveningBtn" class="du-btn du-btn-primary">Сделать вечер особенным <span>↗</span></button>
    <small>Фото: <a href="https://www.pexels.com/photo/romantic-candlelit-pizza-dinner-at-home-36305242/" target="_blank" rel="noopener noreferrer">Marina Grechko / Pexels</a></small>
  </div>
</aside></main>"""

CSS = """
/* Dedicated in-site 'Наш вечер' mode; no large block on the ordinary homepage. */
body:not(.du-evening-mode) #evening,
body:not(.du-evening-mode) #eveningLanding{display:none!important}
body.du-evening-mode #homeView > :not(#eveningLanding):not(#evening):not(#music){display:none!important}
body.du-evening-mode #homeView > #eveningLanding{display:grid!important}
body.du-evening-mode .main-nav [data-nav="evening"]{color:#8a4354;font-weight:800}
.du-evening-landing{display:none;grid-template-columns:minmax(0,.94fr) minmax(0,1.06fr);gap:38px;align-items:stretch;padding:34px 0 20px}
.du-evening-landing-photo{position:relative;overflow:hidden;min-height:670px;background:#302027;border-radius:23px}
.du-evening-landing-photo > img{display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:48% center}
.du-evening-landing-photo:after{content:"";position:absolute;inset:35% 0 0;background:linear-gradient(transparent,#2314178c);pointer-events:none}
.du-evening-landing-caption{position:absolute;z-index:1;left:28px;bottom:43px;color:#fff8f3;font:italic 25px var(--serif,Georgia,serif)}
.du-evening-landing-credit{position:absolute;z-index:1;left:28px;bottom:19px;font-size:10px;color:#f4e6e2}
.du-evening-landing-credit a,.du-evening-inspiration-credit a{color:inherit;text-decoration:underline;text-underline-offset:3px}
.du-evening-landing-content{padding:35px 0 6px;display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.du-evening-landing-kicker,.du-recipe-evening-kicker{font:800 12px/1.4 var(--sans,Arial,sans-serif);letter-spacing:.14em;color:#a56c7a}
.du-evening-landing-content h1{margin:16px 0 9px;font:normal clamp(63px,7vw,105px)/.93 var(--serif,Georgia,serif);letter-spacing:-.045em;color:#7d3444}
.du-evening-landing-content h1 em,.du-recipe-evening-copy h2 em{font-weight:400;color:#a36d7f}
.du-evening-landing-content h1 span{font:normal 40px var(--serif,Georgia,serif);vertical-align:top;margin-left:8px}
.du-evening-landing-lead{font:normal clamp(21px,2vw,29px)/1.25 var(--serif,Georgia,serif);color:#3b3334;margin:8px 0 12px;max-width:540px}
.du-evening-landing-text{font:normal 15px/1.65 var(--sans,Arial,sans-serif);color:#76696d;max-width:520px;margin:0 0 20px}
.du-evening-landing-benefits{width:100%;display:flex;gap:20px;flex-wrap:wrap;margin:6px 0 22px}
.du-evening-landing-benefits span{color:#8d5b68;display:flex;align-items:center;gap:7px;font-size:19px}
.du-evening-landing-benefits b{font:650 12px var(--sans,Arial,sans-serif);color:#66545c}
.du-evening-pinned{display:flex;align-items:center;gap:11px;border:1px solid #e7d5d6;background:#f7eeeb;color:#6b404b;padding:10px 12px;border-radius:11px;margin-bottom:18px;font:600 12px/1.5 var(--sans,Arial,sans-serif)}
.du-evening-pinned[hidden]{display:none!important}
.du-evening-pinned strong{font-weight:750}
.du-evening-pinned button{border:0;background:transparent;font-size:25px;line-height:1;color:#8e4f61}
.du-evening-landing-cta{font-size:14px;min-height:48px}
.du-evening-inspiration{margin-top:26px;width:100%;padding-top:16px;border-top:1px solid #eadedd}
.du-evening-inspiration-head{display:flex;align-items:baseline;gap:12px;justify-content:space-between;margin-bottom:11px}
.du-evening-inspiration-head strong{color:#422f35;font:700 15px var(--sans,Arial,sans-serif)}
.du-evening-inspiration-head small{color:#8c7a7c;font-size:10px}
.du-evening-inspiration-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.du-evening-inspiration-card{background:#fffdfa;border:1px solid #eee1de;overflow:hidden;border-radius:13px;box-shadow:0 6px 16px #7a626012;transition:transform .2s}
.du-evening-inspiration-card:hover{transform:translateY(-3px)}
.du-evening-inspiration-card img{width:100%;height:110px;object-fit:cover;display:block}
.du-evening-inspiration-card span{display:block;padding:9px 10px 11px;font:700 12px/1.3 var(--sans,Arial,sans-serif);color:#48393c}
.du-evening-inspiration-card small{display:block;margin-top:5px;font-size:10px;font-weight:500;color:#8e7a7f}
.du-evening-inspiration-credit{display:block;color:#8c7b7d;font-size:10px;line-height:1.5;margin-top:10px}
.du-evening-mode #evening{padding-top:34px}
#eveningBuilder{scroll-margin-top:104px}
.du-recipe-evening-invite{display:grid;grid-template-columns:minmax(210px,34%) 1fr;overflow:hidden;border-radius:22px;background:#f5e7e3;border:1px solid #ecd8d6;margin:45px 0 60px;box-shadow:0 12px 35px #55333c10}
.du-recipe-evening-photo{min-height:270px;overflow:hidden}
.du-recipe-evening-photo img{width:100%;height:100%;display:block;object-fit:cover}
.du-recipe-evening-copy{padding:38px 40px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}
.du-recipe-evening-copy h2{font:normal clamp(30px,3.1vw,45px)/1.06 var(--serif,Georgia,serif);letter-spacing:-.025em;color:#713c4b;margin:12px 0}
.du-recipe-evening-copy h2 em{font-weight:400}
.du-recipe-evening-copy p{font:normal 14px/1.65 var(--sans,Arial,sans-serif);color:#775f69;max-width:570px;margin:0 0 18px}
.du-recipe-evening-copy small{font-size:10px;color:#907a7c;margin-top:10px}
.du-recipe-evening-copy small a{text-decoration:underline}
@media(max-width:1000px){.du-evening-landing{gap:22px}.du-evening-landing-photo{min-height:640px}.du-evening-landing-content{padding-top:25px}.du-evening-inspiration-head small{display:none}.du-evening-landing-benefits{gap:12px}}
@media(max-width:760px){.du-evening-landing{grid-template-columns:1fr;padding:18px 0 12px;gap:10px}.du-evening-landing-photo{min-height:320px;max-height:380px}.du-evening-landing-content{padding:14px 2px 6px}.du-evening-landing-content h1{font-size:clamp(58px,15vw,85px)}.du-evening-landing-content h1 span{font-size:27px}.du-evening-landing-text{font-size:14px}.du-evening-inspiration-card img{height:100px}.du-recipe-evening-invite{grid-template-columns:1fr;margin:25px 0 40px}.du-recipe-evening-photo{height:185px;min-height:0}.du-recipe-evening-copy{padding:25px 23px}}
@media(max-width:430px){.du-evening-landing-photo{min-height:270px}.du-evening-landing-benefits{gap:10px}.du-evening-landing-benefits b{font-size:11px}.du-evening-inspiration-grid{gap:6px}.du-evening-inspiration-card img{height:78px}.du-evening-inspiration-card span{padding:7px;font-size:10px}.du-evening-inspiration-credit{font-size:9px}}
"""

OLD_ROUTE = """function route(){const hash=decodeURIComponent(location.hash.slice(1));if(hash.startsWith('recipe=')){showRecipe(hash.slice(7));return;}showHome();if(hash==='catalog'||hash==='categories'||hash==='evening'||hash==='about'||hash==='pricing'||hash==='music'){requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({behavior:'smooth',block:'start'}));}else if(hash==='home'){requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}))}}"""

NEW_ROUTE = """function route(){const hash=decodeURIComponent(location.hash.slice(1));const isEvening=hash==='evening'||hash==='evening-music'||hash==='eveningBuilder';document.body.classList.toggle('du-evening-mode',isEvening);const nav=document.querySelector('[data-nav="evening"]');if(nav){if(isEvening)nav.setAttribute('aria-current','page');else nav.removeAttribute('aria-current');}if(hash.startsWith('recipe=')){showRecipe(hash.slice(7));return;}showHome();if(isEvening){requestAnimationFrame(()=>document.getElementById(hash==='evening-music'?'music':hash==='eveningBuilder'?'eveningBuilder':'eveningLanding')?.scrollIntoView({behavior:'instant',block:'start'}));return;}if(['catalog','categories','about','pricing','music'].includes(hash)){requestAnimationFrame(()=>document.getElementById(hash)?.scrollIntoView({behavior:'smooth',block:'start'}));}else if(hash==='home'){requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}))}}"""

def change(source, old, new, label):
    occurrences = source.count(old)
    if occurrences != 1:
        raise ValueError(f"{label}: expected 1 occurrence, found {occurrences}")
    return source.replace(old, new, 1)

def main():
    content = FILE.read_text(encoding="utf-8")
    if 'id="eveningLanding"' in content:
        print("Already applied; no further changes")
        return 0
    source_count = len(json.loads(re.search(
        r'<script id="recipeData" type="application/json">([\s\S]*?)</script>', content
    ).group(1)))
    if source_count != 1001:
        raise ValueError(f"Recipe registry changed unexpectedly: {source_count}")
    content = change(content, '<section class="du-evening container" id="evening" aria-labelledby="eveningTitle">',
        LANDING+'<section class="du-evening container" id="evening" aria-labelledby="eveningTitle"><div id="eveningBuilder"></div>', 'landing')
    content = change(content, '<div id="recipeDetail"></div></main>', INVITATION, 'invitation')
    content = change(content, "function showRecipe(id){const r=byId(id);if(!r){location.hash='catalog';return;}",
        "function showRecipe(id){const r=byId(id);if(!r){location.hash='catalog';return;}$('eveningFromRecipeTitle').textContent=r.title;", 'recipe label')
    content = change(content, OLD_ROUTE, NEW_ROUTE, 'route')
    content = change(content, "$('backCatalog').addEventListener('click',()=>{location.hash='catalog'});",
        "$('backCatalog').addEventListener('click',()=>{location.hash='catalog'});$('continueEveningBtn').addEventListener('click',()=>{if(state.recipe&&byId(state.recipe)){window.duEveningChooseRecipe?.(state.recipe);location.hash='evening';}});", 'invite click')
    content = change(content, '<a href="#music">Выбрать саундтрек ↗</a>',
        '<a href="#evening-music">Выбрать саундтрек ↗</a>', 'music navigation')
    content = change(content,
        "const evening={mood:'tender',time:'relaxed',roleSwap:false,courseStep:0,selectedMenu:[],timerEnd:0,timerRemaining:0,timerHandle:null,activeSteps:[],saveKey:'su_evening_position'};",
        "const evening={mood:'tender',time:'relaxed',roleSwap:false,courseStep:0,selectedMenu:[],selectedRecipeId:(()=>{try{return sessionStorage.getItem('su_evening_recipe')}catch{return null}})(),timerEnd:0,timerRemaining:0,timerHandle:null,activeSteps:[],saveKey:'su_evening_position'};",
        'persistent selection')
    content = change(content, "function menuIds(){return EVENING_MOODS[evening.mood].menus[evening.time]}",
        """function menuIds(){const ids=[...EVENING_MOODS[evening.mood].menus[evening.time]];const r=byId(evening.selectedRecipeId);if(!r||ids.includes(r.id))return ids;let n=r.category==='dessert'?ids.length-1:r.category==='salads'||r.category==='soup'?0:ids.findIndex(id=>{const entry=byId(id);return entry&&!['salads','soup','dessert'].includes(entry.category)});if(n<0)n=Math.max(0,ids.length-1);ids[n]=r.id;return [...new Set(ids)];}
window.duEveningChooseRecipe=function(id){const r=id?byId(id):null;evening.selectedRecipeId=r?r.id:null;try{if(r)sessionStorage.setItem('su_evening_recipe',r.id);else sessionStorage.removeItem('su_evening_recipe')}catch{}renderEvening()};""",
        'custom menu')
    content = change(content, " e$('menuIntro').textContent=mood.description;",
        """ const selected=byId(evening.selectedRecipeId), pinned=e$('eveningPinned');if(pinned){pinned.hidden=!selected;if(selected)e$('eveningPinnedTitle').textContent=selected.title}
 e$('menuIntro').textContent=selected?'Выбранный вами рецепт включён в план вечера. '+mood.description:mood.description;""",
        'pinned selection')
    content = change(content, " e$('addMenuShopping').addEventListener('click',addEveningShopping);",
        " e$('addMenuShopping').addEventListener('click',addEveningShopping);e$('eveningClearChoice').addEventListener('click',()=>window.duEveningChooseRecipe(null));",
        'clear selection')
    content = change(content, "</style>", CSS + "</style>", 'css')
    # Prevent accidental text rewrites in the recipe JSON.
    after = re.search(r'<script id="recipeData" type="application/json">([\s\S]*?)</script>', content).group(1)
    if len(json.loads(after)) != source_count:
        raise ValueError("Recipe data changed in patch")
    for token in ('id="eveningLanding"', 'id="continueEveningBtn"', "window.duEveningChooseRecipe", "du-evening-mode"):
        if token not in content:
            raise ValueError("Missing required feature: " + token)
    FILE.write_text(content, encoding="utf-8")
    print(f"Updated {FILE.name}: {source_count} recipes preserved; {len(content)} characters")

if __name__ == "__main__":
    sys.exit(main())
