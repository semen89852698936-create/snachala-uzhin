#!/usr/bin/env python3
"""Integrate approved three-scene visual narrative without changing the recipe database."""
from pathlib import Path
import re, json, sys

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/"index.html"
MARKER="/* Approved three-act Our Evening visual narrative (2026-11) */"

STORY_DINNER="""<section class="du-story-dinner" aria-labelledby="duStoryDinnerTitle">
 <div class="du-story-dinner-photo">
  <img src="https://images.pexels.com/photos/5018980/pexels-photo-5018980.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1500" alt="Романтический ужин вдвоём при свечах и бокалах вина" loading="lazy" decoding="async">
  <span class="du-story-photo-credit">Фото: <a href="https://www.pexels.com/photo/man-and-woman-sitting-at-table-with-bottles-and-glasses-5018980/" target="_blank" rel="noopener noreferrer">cottonbro studio / Pexels</a></span>
 </div>
 <div class="du-story-dinner-copy">
  <span class="du-story-eyebrow">02 / ПРОДОЛЖЕНИЕ ВЕЧЕРА</span>
  <h2 id="duStoryDinnerTitle">Ужин готов. <em>А вечер только начинается.</em></h2>
  <p>Добавьте музыку, немного романтики и время только для вас двоих.</p>
  <a class="du-btn du-btn-primary" href="#eveningBuilder">Сделать вечер особенным <span>↗</span></a>
 </div>
</section>"""

STORY_AFTER="""<section class="du-story-after" aria-labelledby="duStoryAfterTitle">
 <div class="du-story-after-copy">
  <span class="du-story-eyebrow">03 / ТОЛЬКО ВЫ ДВОЕ</span>
  <h2 id="duStoryAfterTitle">А дальше... <em>побудьте вместе.</em></h2>
  <p>Бокалы остаются на столе, суета за дверью. Настало время разговоров, прикосновений и музыки, которую не хочется выключать.</p>
  <a href="#evening-music" class="du-btn du-btn-primary">Под что продолжить <span>↗</span></a>
  <small>Фото: <a href="https://www.pexels.com/photo/a-couple-sitting-on-the-couch-while-having-conversation-5054097/" target="_blank" rel="noopener noreferrer">Thirdman / Pexels</a></small>
 </div>
 <div class="du-story-after-photo"><img src="https://images.pexels.com/photos/5054097/pexels-photo-5054097.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1550" alt="Пара отдыхает в мягком вечернем свете после ужина" loading="lazy" decoding="async"></div>
</section>"""

CSS=r"""
/* Approved three-act Our Evening visual narrative (2026-11) */
.du-evening-mode #eveningLanding,.du-evening-mode #evening,.du-evening-mode #music,.du-recipe-evening-invite{
 --story-ink:#573948;--story-mauve:#aa7185;--story-surface:#f9f0ee;
 font-family:var(--sans,'Manrope','Segoe UI',sans-serif)
}
.du-evening-landing{column-gap:30px;row-gap:35px;padding-top:32px;align-items:stretch;grid-template-columns:minmax(0,.96fr) minmax(0,1.04fr)}
.du-evening-landing-photo{min-height:765px;border-radius:22px;background:#40312e}
.du-evening-landing-photo>img{object-position:center 39%;filter:sepia(.08) saturate(.9) contrast(1.02)}
.du-evening-landing-caption{font:italic 28px/1.15 var(--serif,'Cormorant Garamond',Georgia,serif)}
.du-evening-landing-content{padding-top:25px;justify-content:center}
.du-evening-landing-kicker,.du-recipe-evening-kicker,.du-story-eyebrow{font:800 13px/1.5 var(--sans);letter-spacing:.075em;color:#a16077}
.du-evening-landing-content h1{font:500 clamp(78px,8.8vw,126px)/.87 var(--serif);letter-spacing:-.057em;color:#573948;margin:21px 0 30px}
.du-evening-landing-content h1 em{color:#b17488;font-weight:400}
.du-evening-landing-content h1 span{font-size:36px;color:#b17488;line-height:1}
.du-evening-landing-lead{font:500 clamp(29px,2.75vw,41px)/1.15 var(--serif);max-width:620px;color:#654954;letter-spacing:-.025em;margin:0 0 17px}
.du-evening-landing-text{font:500 17px/1.68 var(--sans);max-width:540px;color:#66545d}
.du-evening-landing-benefits{gap:12px 21px;align-items:center;margin:14px 0 26px}
.du-evening-landing-benefits b{font:700 14px/1.35 var(--sans)}
.du-evening-landing-cta{font:800 15px/1.2 var(--sans);min-height:54px;padding:17px 30px;border-radius:36px}
.du-evening-inspiration{margin-top:26px;width:100%}
.du-evening-inspiration-head strong{font:750 18px/1.35 var(--sans)}
.du-evening-inspiration-head small{font:500 13px/1.5 var(--sans)}
.du-evening-inspiration-card{border-radius:14px}
.du-evening-inspiration-card img{height:137px}
.du-evening-inspiration-card span{font:700 14px/1.35 var(--sans)}
.du-evening-inspiration-card small{font:550 12px/1.4 var(--sans)}
.du-evening-inspiration-credit,.du-evening-landing-credit{font:500 11px/1.4 var(--sans)}
.du-evening-mode #evening .du-section-heading h2,.du-evening-mode #music .du-section-heading h2{font-family:var(--serif);font-weight:500}
.du-evening-mode #evening .du-section-heading p,.du-evening-mode #music .du-section-heading p{font:500 17px/1.7 var(--sans)}
.du-evening-mode #evening .du-mood strong{font:500 clamp(33px,2.75vw,41px)/1.04 var(--serif)}
.du-evening-mode #evening .du-mood small{font:600 13px/1.5 var(--sans)}
.du-evening-mode #evening .du-builder h3{font-family:var(--serif);font-weight:500}
.du-evening-mode #evening .du-time-choices button{font-size:15px}
.du-evening-mode #evening .du-menu-dish strong{font-size:23px}
.du-evening-mode #evening .du-evening-together-content h3,.du-evening-mode #evening .du-evening-invitation-content h3{font:500 clamp(35px,3.4vw,47px)/1.03 var(--serif)}
.du-evening-mode #evening .du-evening-together-content>p,.du-evening-mode #evening .du-evening-invitation-content>p{font:500 15px/1.65 var(--sans)}
.du-evening-mode #evening .du-evening-role-card small{font-size:12px}
.du-evening-mode #evening .du-evening-invite-fields label{font-size:12px}
.du-evening-mode #evening .du-evening-invite-fields input{font-size:15px}
.du-evening-mode #evening .du-evening-invite-preview{font-size:22px}
.du-evening-mode #evening .du-evening-privacy{font-size:11px}
.du-evening-mode #evening .du-evening-role-actions span,.du-evening-mode #evening .du-evening-role-actions button{font-size:12px}
.du-evening-mode #evening{padding-top:62px}
.du-story-dinner{grid-column:1/-1;display:grid;grid-template-columns:1.06fr .94fr;overflow:hidden;min-height:425px;border-radius:22px;background:#f6e8e6;box-shadow:0 8px 35px #6b37410c}
.du-story-dinner-photo{position:relative;min-height:425px;overflow:hidden;background:#2c1d25}
.du-story-dinner-photo img{position:absolute;width:100%;height:100%;inset:0;object-fit:cover;object-position:52% center;filter:saturate(.9) sepia(.07)}
.du-story-dinner-photo:after{content:"";position:absolute;inset:56% 0 0;background:linear-gradient(transparent,#21121b80);pointer-events:none}
.du-story-photo-credit{position:absolute;z-index:1;bottom:13px;left:17px;color:white;font:500 11px/1.3 var(--sans)}
.du-story-photo-credit a,.du-story-after-copy small a{text-decoration:underline;color:inherit;text-underline-offset:3px}
.du-story-dinner-copy{padding:35px clamp(26px,3.2vw,54px);display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:17px}
.du-story-dinner-copy h2{font:500 clamp(43px,4.1vw,64px)/.99 var(--serif);letter-spacing:-.035em;color:#573948;margin:0}
.du-story-dinner-copy h2 em{font-weight:400;color:#a86b80}
.du-story-dinner-copy p{font:500 17px/1.65 var(--sans);color:#745b65;margin:0}
.du-story-dinner-copy .du-btn,.du-story-after-copy .du-btn{font:800 15px/1.3 var(--sans);border-radius:30px;min-height:49px}
.du-story-after{display:grid;grid-template-columns:.95fr 1.05fr;min-height:420px;margin-top:52px;border-radius:22px;overflow:hidden;background:#49343f;color:#fff7f4}
.du-story-after-copy{padding:35px clamp(24px,4vw,56px);display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:16px}
.du-story-after-copy .du-story-eyebrow{color:#edd2d8}
.du-story-after-copy h2{font:500 clamp(42px,4.2vw,64px)/1.02 var(--serif);letter-spacing:-.034em;margin:0}
.du-story-after-copy h2 em{font-weight:400;color:#f2c8ce}
.du-story-after-copy p{font:500 16px/1.7 var(--sans);color:#f1e5e7;margin:0;max-width:470px}
.du-story-after-copy small{font:500 11px/1.4 var(--sans);color:#ecd7de}
.du-story-after-photo{position:relative;min-height:370px;background:#2d252e}
.du-story-after-photo img{width:100%;height:100%;position:absolute;inset:0;object-fit:cover;object-position:center 40%;filter:sepia(.14) saturate(.8) contrast(1.06)}
.du-recipe-evening-copy h2{font:500 clamp(38px,4vw,56px)/1.03 var(--serif);color:#573948}
.du-recipe-evening-copy p{font:500 17px/1.65 var(--sans)}
.du-recipe-evening-copy .du-btn{font-size:15px;border-radius:30px}
.du-recipe-evening-photo img{object-position:center center}
@media(max-width:1050px){.du-evening-landing-photo{min-height:680px}.du-evening-landing-content h1{font-size:clamp(66px,8.3vw,110px)}.du-evening-inspiration-card img{height:110px}.du-story-dinner-copy h2{font-size:clamp(37px,4.6vw,50px)}}
@media(max-width:760px){
 .du-evening-landing{grid-template-columns:1fr;gap:14px;padding-top:17px}
 .du-evening-landing-photo{min-height:380px;max-height:460px}
 .du-evening-landing-photo>img{object-position:center 38%}
 .du-evening-landing-content{padding:19px 4px 15px}
 .du-evening-landing-content h1{font-size:clamp(65px,14vw,100px);margin:12px 0 22px}
 .du-evening-landing-lead{font-size:clamp(29px,6.5vw,40px)}
 .du-evening-landing-text{font-size:16px}
 .du-evening-inspiration-card img{height:115px}
 .du-story-dinner{grid-template-columns:1fr;min-height:0}
 .du-story-dinner-photo{min-height:310px}
 .du-story-dinner-copy{padding:28px 25px 33px}
 .du-story-dinner-copy h2{font-size:clamp(39px,9vw,54px)}
 .du-story-after{grid-template-columns:1fr;margin-top:32px}
 .du-story-after-photo{min-height:310px;order:-1}
 .du-story-after-copy{padding:28px 25px}
 .du-story-after-copy h2{font-size:clamp(42px,10vw,56px)}
 .du-evening-mode #evening{padding-top:45px}
}
@media(max-width:440px){
 .du-evening-landing-photo{min-height:325px;max-height:355px}
 .du-evening-landing-content h1{font-size:clamp(57px,15vw,76px)}
 .du-evening-landing-content h1 span{font-size:23px}
 .du-evening-inspiration-card img{height:90px}
 .du-evening-inspiration-card span{font-size:12px}
 .du-evening-inspiration-card small{font-size:11px}
 .du-evening-landing-benefits{gap:10px}
 .du-evening-landing-benefits b{font-size:12px}
 .du-story-dinner-photo{min-height:240px}
 .du-story-after-photo{min-height:240px}
}
"""

def once(s, old, new, message):
    found=s.count(old)
    if found!=1: raise ValueError(f"{message}: expected 1, found {found}")
    return s.replace(old,new,1)

def main():
    s=HTML.read_text(encoding="utf-8")
    if MARKER in s:
        print("Already integrated")
        return 0
    recipe=s[s.indexOf('<script id="recipeData"'):s.indexOf('</script>',s.indexOf('<script id="recipeData"'))]
    items=json.loads(re.search(r'>(\[.*\])$',recipe,re.S).group(1))
    assert len(items)==1001
    ids={x["id"] for x in items}
    assert all(x in ids for x in ("salmon-lemon","collection-pasta-01-03","chocolate-cake"))
    # 01 premium real-life kitchen portrait, not candlelit dinner repeated.
    s=once(s,
      'src="https://images.pexels.com/photos/36305242/pexels-photo-36305242.jpeg?cs=srgb&amp;dl=pexels-marina-grechko-701637593-36305242.jpg&amp;fm=jpg" alt="Романтический ужин вдвоём при свечах"',
      'src="https://images.pexels.com/photos/6962219/pexels-photo-6962219.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1450" alt="Пара вместе готовит на уютной кухне"',
      "hero scene")
    s=once(s,
      '<small class="du-evening-landing-credit">Фото: <a href="https://www.pexels.com/photo/romantic-candlelit-pizza-dinner-at-home-36305242/" target="_blank" rel="noopener noreferrer">Marina Grechko / Pexels</a></small>',
      '<small class="du-evening-landing-credit">Фото: <a href="https://www.pexels.com/photo/couple-cooking-together-6962219/" target="_blank" rel="noopener noreferrer">Andy Barbour / Pexels</a></small>',
      "hero credit")
    s=once(s,'<h1 id="eveningLandingTitle">Наш <em>вечер.</em> <span aria-hidden="true">♡</span></h1>',
      '<h1 id="eveningLandingTitle">Наш <em>вечер</em> <span aria-hidden="true">♡</span></h1>',"hero title")
    s=once(s,'<div class="du-evening-landing-caption">✳ Только для вас двоих</div>',
      '<div class="du-evening-landing-caption">✳ Совместная готовка<br>для особенного вечера</div>',"hero caption")
    # 01 visual mockup showed salmon + mushrooms + chocolate, all must be real recipes.
    s=once(s,
      '<a class="du-evening-inspiration-card" href="#recipe=tomato-soup"><img src="https://images.pexels.com/photos/27098511/pexels-photo-27098511.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=480" alt="Томатный суп с базиликом" loading="lazy"><span>Томатный суп<small>30 минут</small></span></a>',
      '<a class="du-evening-inspiration-card" href="#recipe=collection-pasta-01-03"><img src="https://images.pexels.com/photos/6287545/pexels-photo-6287545.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=480" alt="Паста с грибами" loading="lazy"><span>Паста с грибами<small>23 минуты</small></span></a>',
      "menu card")
    s=once(s,
      '<a href="https://www.pexels.com/photo/tomato-soup-on-a-table-27098511/" target="_blank" rel="noopener noreferrer">Valeria Boltneva</a>',
      '<a href="https://www.pexels.com/photo/person-with-plate-of-pasta-with-mushrooms-6287545/" target="_blank" rel="noopener noreferrer">Klaus Nielsen</a>',
      "menu attribution")
    s=once(s,
      '<a class="du-evening-inspiration-card" href="#recipe=chocolate-cake"><img src="https://images.pexels.com/photos/30353753/pexels-photo-30353753.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=480" alt="Шоколадный брауни" loading="lazy"><span>Брауни<small>35 минут</small></span></a>',
      '<a class="du-evening-inspiration-card" href="#recipe=chocolate-cake"><img src="https://images.pexels.com/photos/30353753/pexels-photo-30353753.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=480" alt="Шоколадный брауни" loading="lazy"><span>Шоколадный брауни<small>45 минут</small></span></a>',
      "dessert timing")
    s=once(s,
      '    </div>\n  </div>\n</section>\n<section class="du-evening container" id="evening"',
      '    </div>\n  </div>\n'+STORY_DINNER+'\n</section>\n<section class="du-evening container" id="evening"',
      "dinner transition")
    s=once(s,
      '<div class="du-chosen-note"><span>✳</span> Это ваш вечер. Меню, продукты, шаги приготовления и музыка уже собраны в одном месте.</div>\n</section>',
      '<div class="du-chosen-note"><span>✳</span> Это ваш вечер. Меню, продукты, шаги приготовления и музыка уже собраны в одном месте.</div>\n'+STORY_AFTER+'\n</section>',
      "cinematic final scene")
    # Different photo on recipe invitation (to avoid same image as the lower invitation).
    s=once(s,
      'src="https://images.pexels.com/photos/36305242/pexels-photo-36305242.jpeg?cs=srgb&amp;dl=pexels-marina-grechko-701637593-36305242.jpg&amp;fm=jpg" alt="Романтический ужин при свечах"',
      'src="https://images.pexels.com/photos/29110845/pexels-photo-29110845.jpeg?auto=compress&amp;cs=tinysrgb&amp;w=1200" alt="Стол с цветами и свечами для романтического ужина"',
      "recipe invitation photo")
    s=once(s,
      '<small>Фото: <a href="https://www.pexels.com/photo/romantic-candlelit-pizza-dinner-at-home-36305242/" target="_blank" rel="noopener noreferrer">Marina Grechko / Pexels</a></small>\n  </div>\n</aside>',
      '<small>Фото: <a href="https://www.pexels.com/photo/romantic-dinner-setup-with-candles-and-flowers-29110845/" target="_blank" rel="noopener noreferrer">Furkan Özavcı / Pexels</a></small>\n  </div>\n</aside>',
      "recipe invitation attribution")
    s=once(s,'</style>',CSS+'\n</style>','theme CSS')
    last=json.loads(re.search(r'<script id="recipeData" type="application/json">([\s\S]*?)</script>',s).group(1))
    if last!=items:raise ValueError("Recipe database modified")
    HTML.write_text(s,encoding="utf-8")
    print(f"Integrated three scene story and validated {len(items)} recipes")

if __name__=="__main__":
    sys.exit(main())
