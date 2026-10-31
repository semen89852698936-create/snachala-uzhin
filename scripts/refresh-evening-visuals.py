#!/usr/bin/env python3
"""Improve Our Evening photography and reuse main-site typography tokens."""
from pathlib import Path
import re, sys

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT/"index.html"
MARKER="/* Our Evening: matching site typography and distinct editorial photographs */"
HERO="https://images.pexels.com/photos/11368688/pexels-photo-11368688.jpeg?cs=srgb&amp;dl=pexels-shvetsa-11368688.jpg&amp;fm=jpg"
COOK="https://images.pexels.com/photos/5424608/pexels-photo-5424608.jpeg?cs=srgb&amp;dl=pexels-amina-filkins-5424608.jpg&amp;fm=jpg"
RECIPE="https://images.pexels.com/photos/29110845/pexels-photo-29110845.jpeg?cs=srgb&amp;dl=pexels-furkan-ozavci-384727158-29110845.jpg&amp;fm=jpg"

CSS=r"""
/* Our Evening: matching site typography and distinct editorial photographs */
.du-evening-mode #eveningLanding,.du-evening-mode #evening,.du-evening-mode #music,
.du-recipe-evening-invite{--evening-serif:var(--serif,'Cormorant Garamond',Georgia,serif);--evening-sans:var(--sans,'Manrope',Arial,sans-serif);--evening-type:#59404f;--evening-accent:#a46b80}
.du-evening-landing-content h1{font-family:var(--serif);font-size:clamp(78px,8.3vw,126px);font-weight:500;line-height:.86;letter-spacing:-.052em;color:#59404f;margin:23px 0 20px}
.du-evening-landing-content h1 em{color:#a46b80;font-weight:400}
.du-evening-landing-lead{font-family:var(--serif);font-size:clamp(29px,2.8vw,43px);line-height:1.1;letter-spacing:-.02em;color:#604852;max-width:590px}
.du-evening-landing-text{font:500 17px/1.7 var(--sans);color:#715e69;max-width:570px}
.du-evening-landing-kicker,.du-recipe-evening-kicker{font:800 13px/1.45 var(--sans);letter-spacing:.075em}
.du-evening-landing-benefits{gap:15px 24px}
.du-evening-landing-benefits b{font:700 15px/1.45 var(--sans)}
.du-evening-pinned{font:650 15px/1.55 var(--sans)}
.du-evening-landing-cta,.du-recipe-evening-copy .du-btn{font:800 15px/1.25 var(--sans);min-height:52px}
.du-evening-inspiration-head strong{font:750 18px/1.3 var(--sans)}
.du-evening-inspiration-head small{font:500 13px/1.3 var(--sans)}
.du-evening-inspiration-card span{font:700 15px/1.35 var(--sans)}
.du-evening-inspiration-card small{font:500 13px/1.45 var(--sans)}
.du-evening-inspiration-credit,.du-evening-landing-credit{font-size:11px;line-height:1.45}
.du-evening-mode #evening .du-section-heading h2,.du-evening-mode #music .du-section-heading h2{font-family:var(--serif);font-weight:500;letter-spacing:-.038em}
.du-evening-mode #evening .du-section-heading p,.du-evening-mode #music .du-section-heading p{font:500 17px/1.68 var(--sans);max-width:570px}
.du-evening-mode #evening .du-eyebrow,.du-evening-mode #music .du-eyebrow,
.du-evening-mode #evening .du-mini-eyebrow{font:800 12px/1.5 var(--sans);letter-spacing:.1em}
.du-evening-mode #evening .du-mood strong{font-family:var(--serif);font-size:clamp(34px,3vw,44px);font-weight:500;line-height:1.03}
.du-evening-mode #evening .du-mood small{font:600 14px/1.5 var(--sans);max-width:230px}
.du-evening-mode #evening .du-mood-num{font:800 12px var(--sans)}
.du-evening-mode #evening .du-builder h3{font-family:var(--serif);font-weight:500;font-size:clamp(40px,4vw,59px)}
.du-evening-mode #evening .du-time-choices button{font:700 15px/1.5 var(--sans);min-height:46px}
.du-evening-mode #evening .du-small-note{font:500 14px/1.6 var(--sans)}
.du-evening-mode #evening .du-menu-intro{font:500 17px/1.65 var(--sans)}
.du-evening-mode #evening .du-menu-dish strong{font-family:var(--serif);font-size:25px;line-height:1.15}
.du-evening-mode #evening .du-menu-dish small,.du-evening-mode #evening .du-menu-meta{font:550 14px/1.45 var(--sans)}
.du-evening-mode #evening .du-evening-together-content h3,.du-evening-mode #evening .du-evening-invitation-content h3{font-family:var(--serif);font-weight:500;font-size:clamp(35px,3.25vw,48px);line-height:1.04}
.du-evening-mode #evening .du-evening-together-content>p,.du-evening-mode #evening .du-evening-invitation-content>p{font:500 15px/1.65 var(--sans)}
.du-evening-mode #evening .du-evening-role-card>span{font:800 11px/1.5 var(--sans)}
.du-evening-mode #evening .du-evening-role-card strong{font:600 24px/1.1 var(--serif)}
.du-evening-mode #evening .du-evening-role-card small{font:550 13px/1.4 var(--sans)}
.du-evening-mode #evening .du-evening-role-actions button,.du-evening-mode #evening .du-evening-role-actions span{font:700 13px/1.45 var(--sans)}
.du-evening-mode #evening .du-evening-invite-fields label{font:750 12px/1.5 var(--sans);letter-spacing:.06em}
.du-evening-mode #evening .du-evening-invite-fields input{font:500 15px/1.5 var(--sans);min-height:46px}
.du-evening-mode #evening .du-evening-invite-preview{font:500 23px/1.32 var(--serif)}
.du-evening-mode #evening .du-evening-invite-actions .du-btn{font:800 14px/1.4 var(--sans)}
.du-evening-mode #evening .du-evening-privacy,.du-evening-mode #evening .du-evening-photo-credit{font:500 12px/1.55 var(--sans)}
.du-evening-mode #evening .du-evening-next{font:600 16px/1.5 var(--sans)}
.du-recipe-evening-copy h2{font:500 clamp(38px,4vw,60px)/1.02 var(--serif);letter-spacing:-.035em;color:#59404f}
.du-recipe-evening-copy h2 em{color:#a46b80}
.du-recipe-evening-copy p{font:500 17px/1.65 var(--sans)}
.du-recipe-evening-copy small{font:500 12px/1.45 var(--sans)}
.du-evening-landing-photo>img{object-position:52% 47%}
.du-evening-together>img{object-position:52% 38%}
.du-evening-invitation-photo img{object-position:center 47%}
.du-recipe-evening-photo img{object-position:53% 55%}
@media(max-width:900px){
.du-evening-landing-content h1{font-size:clamp(68px,10vw,105px)}
.du-evening-landing-lead{font-size:clamp(26px,3.7vw,36px)}
.du-evening-landing-text,.du-recipe-evening-copy p{font-size:16px}
.du-evening-mode #evening .du-evening-role-card strong{font-size:22px}
}
@media(max-width:560px){
.du-evening-landing-content h1{font-size:clamp(66px,17vw,92px);margin:13px 0 15px}
.du-evening-landing-lead{font-size:clamp(28px,8vw,36px)}
.du-evening-landing-kicker{font-size:12px}
.du-evening-inspiration-head strong{font-size:16px}
.du-evening-inspiration-head small{display:none}
.du-evening-inspiration-card span{font-size:12px}
.du-evening-inspiration-card small{font-size:11px}
.du-evening-mode #evening .du-section-heading h2{font-size:clamp(46px,12vw,64px)}
.du-evening-mode #evening .du-section-heading p{font-size:16px}
.du-evening-mode #evening .du-mood small{font-size:13px}
.du-evening-mode #evening .du-mood strong{font-size:36px}
.du-evening-mode #evening .du-builder h3{font-size:46px}
.du-evening-mode #evening .du-evening-role-card strong{font-size:18px}
.du-evening-mode #evening .du-evening-role-card small{font-size:11px}
.du-evening-mode #evening .du-evening-together-content h3{font-size:37px}
.du-evening-mode #evening .du-evening-together{min-height:720px}
.du-evening-mode #evening .du-evening-invitation-content h3{font-size:39px}
.du-recipe-evening-copy h2{font-size:clamp(38px,10vw,49px)}
.du-evening-landing-photo>img{object-position:52% 36%}
}
"""

def replace_once(s, old, new, label):
    count=s.count(old)
    if count!=1: raise ValueError(f"{label}: expected one occurrence; got {count}")
    return s.replace(old,new,1)

def main():
    s=HTML.read_text(encoding="utf-8")
    if MARKER in s:
        print("Already patched, no changes")
        return 0
    # Header: premium editorial portrait of couple serving their dinner.
    s=replace_once(s,
        'src="https://images.pexels.com/photos/36305242/pexels-photo-36305242.jpeg?cs=srgb&amp;dl=pexels-marina-grechko-701637593-36305242.jpg&amp;fm=jpg" alt="Романтический ужин вдвоём при свечах"',
        f'src="{HERO}" alt="Пара накрывает домашний ужин при свечах"',
        "evening hero photo")
    s=replace_once(s,
        '<small class="du-evening-landing-credit">Фото: <a href="https://www.pexels.com/photo/romantic-candlelit-pizza-dinner-at-home-36305242/" target="_blank" rel="noopener noreferrer">Marina Grechko / Pexels</a></small>',
        '<small class="du-evening-landing-credit">Фото: <a href="https://www.pexels.com/photo/two-people-at-a-table-11368688/" target="_blank" rel="noopener noreferrer">Anna Shvets / Pexels</a></small>',
        "evening hero credit")
    # Cooking photo: a different warm, genuine moment with two people.
    s=replace_once(s,
        'src="https://images.pexels.com/photos/27176133/pexels-photo-27176133.jpeg?cs=srgb&dl=pexels-helenalopes-27176133.jpg&fm=jpg" alt="Пара вместе готовит ужин на домашней кухне"',
        f'src="{COOK}" alt="Пара вместе готовит ужин и обнимается на кухне"',
        "cooking photo")
    s=replace_once(s,
        '<a href="https://www.pexels.com/photo/couple-enjoys-cooking-together-in-kitchen-27176133/" target="_blank" rel="noopener noreferrer">Helena Lopes / Pexels</a>',
        '<a href="https://www.pexels.com/photo/cheerful-couple-cooking-together-at-home-5424608/" target="_blank" rel="noopener noreferrer">Amina Filkins / Pexels</a>',
        "cooking credit")
    # Invitation retains the attractive Marina Grechko candlelit photo. No duplicate on same screen.
    # Recipe banner now shows an atmospheric table without repeating the invitation image.
    s=replace_once(s,
        'src="https://images.pexels.com/photos/36305242/pexels-photo-36305242.jpeg?cs=srgb&amp;dl=pexels-marina-grechko-701637593-36305242.jpg&amp;fm=jpg" alt="Романтический ужин при свечах"',
        f'src="{RECIPE}" alt="Сервировка романтического ужина со свечами и цветами"',
        "recipe banner")
    s=replace_once(s,
        '<small>Фото: <a href="https://www.pexels.com/photo/romantic-candlelit-pizza-dinner-at-home-36305242/" target="_blank" rel="noopener noreferrer">Marina Grechko / Pexels</a></small>\n  </div>\n</aside>',
        '<small>Фото: <a href="https://www.pexels.com/photo/romantic-dinner-setup-with-candles-and-flowers-29110845/" target="_blank" rel="noopener noreferrer">Furkan Özavcı / Pexels</a></small>\n  </div>\n</aside>',
        "recipe banner credit")
    s=replace_once(s,'</style>',CSS+'\n</style>','consistent typography')
    for photo_id in ("11368688","5424608","36305242","29110845"):
        if f"/photos/{photo_id}/" not in s: raise ValueError(f"Missing photo {photo_id}")
    for id in ('id="eveningLanding"','id="evening"','id="recipeEveningInvite"'):
        if id not in s:raise ValueError("Missing main component "+id)
    HTML.write_text(s,encoding="utf-8")
    print(f"Typography and photographs refreshed ({len(s)} characters, no catalog changes)")

if __name__=="__main__":
    sys.exit(main())
