"""Extract validated original 1001-recipe HTML into a PRIVATE deployment artifact.

Never put the output inside the served document root or commit it to GitHub.
"""
import argparse,json,re
from pathlib import Path
SCRIPT_RE=re.compile(r'<script\s+id="recipeData"\s+type="application/json">(.*?)</script>',re.S)
def extract(source,destination):
    html=Path(source).read_text(encoding='utf-8')
    matches=list(SCRIPT_RE.finditer(html))
    if len(matches)!=1:raise ValueError('expected exactly one catalog script')
    recipes=json.loads(matches[0].group(1))
    if not isinstance(recipes,list) or len(recipes)!=1001 or len({r['id'] for r in recipes})!=1001:
        raise ValueError('expected 1001 unique recipe IDs')
    out=Path(destination)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(html,encoding='utf-8')
    return {'recipes':len(recipes),'bytes':len(html.encode('utf-8'))}
if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('source')
    p.add_argument('destination')
    args=p.parse_args()
    print(json.dumps(extract(args.source,args.destination),ensure_ascii=False))
