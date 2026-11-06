"""Run only inside disposable commerce CI container, never on production.
Exercises the actual Gunicorn HTTP server (not direct WSGI calls).
No external payments, emails or accounts are created.
"""
import io,json,os,re,sys,time,urllib.error,urllib.request
from commerce.access import Store,issue_session,session_email

URL="http://127.0.0.1:8080"
def check(ok, message):
    if not ok:
        raise AssertionError(message)
def request(path, method="GET", cookie=None, data=None):
    headers={}
    if cookie:headers["Cookie"]="su_session="+cookie
    if method=="POST":
        headers["Origin"]=os.environ["COMMERCE_BASE_URL"]
        headers["Content-Type"]="application/json"
        data=json.dumps(data if data is not None else {}).encode()
    req=urllib.request.Request(URL+path,method=method,headers=headers,data=data)
    try:
        with urllib.request.urlopen(req,timeout=15) as r:
            return r.status,r.read(),r.headers
    except urllib.error.HTTPError as e:
        return e.code,e.read(),e.headers

def main():
    check(os.environ.get("COMMERCE_TEST_MODE")=="1","test mode is required")
    check(os.environ.get("ENABLE_CHECKOUT")!="1","must not test with live checkout")
    check(os.environ.get("COMMERCE_BASE_URL")=="https://staging.example","fixed local CI host required")
    check(os.environ.get("COMMERCE_DB_PATH")=="/srv/data/orders.sqlite","CI database required")
    key=bytes.fromhex(os.environ["SESSION_KEY_HEX"])
    check(len(key)>=32,"weak staging key")
    for trial in range(30):
        try:
            if request("/healthz")[0]==200:break
        except OSError:
            time.sleep(1)
    else:raise AssertionError("Gunicorn did not start")
    count=0
    def verify(path,expected,cookie=None,method="GET",data=None):
        nonlocal count
        status,body,headers=request(path,method=method,cookie=cookie,data=data)
        check(status==expected,f"{path} expected {expected}, received {status}")
        count+=1
        return body,headers

    # Public pages must not embed paid recipe data; legacy URLs must be closed.
    for path in ["/","/index.html","/account","/account/"]:
        body,_=verify(path,200)
        check(b'id="recipeData"' not in body,"Catalog leaked through "+path)
    body,_=verify("/account",200)
    check("Мой доступ".encode() in body,"Account page missing")
    for path in ["/app","/full-catalog/index.html","/assets/recipes-ai/0001-lemon-spinach-pasta.webp",
                 "/assets/recipes-ai/../../commerce/access.py","/api/recipes","/commerce/access.py",
                 "/.git/config","/full-catalog/index.html?download=1"]:
        status=403 if path.startswith(("/app","/full-catalog/index.html","/assets/recipes-ai/0001")) else 404
        verify(path,status)
    body,_=verify("/assets/our-evening-together-approved.webp",200)
    check(len(body)>1000,"Marketing photo missing")
    body,_=verify("/api/me",200)
    check(json.loads(body)["has_access"] is False,"anonymous purchase mismatch")
    body,_=verify("/api/orders",503,method="POST",data={"email":"fake@example.ru"})
    check(b"checkout_not_enabled" in body,"Live payments must be off")

    store=Store(os.environ["COMMERCE_DB_PATH"])
    email="smoke-only@example.invalid"
    outsider="outsider@example.invalid"
    try:
        order=store.create_order(email)
        # This test is the only party creating a synthetic purchase; it is not
        # an HTTP endpoint and runs only on an isolated disposable CI database.
        check(not store.has_access(email),"new buyer unexpectedly paid")
        token=issue_session(email,key)
        verify("/app",403,cookie=token)
        verify("/assets/recipes-ai/0001-lemon-spinach-pasta.webp",403,cookie=token)
        store.grant_verified_payment(order_num=order["order_num"],
            payment_id="ci-test-payment",amount="1900.00",verified=True)
        other=issue_session(outsider,key)
        verify("/app",403,cookie=other)
        page,_=verify("/app",200,cookie=token)
        match=re.search(rb'<script id="recipeData" type="application/json">(.*?)</script>',page,re.S)
        check(bool(match),"Protected HTML recipeData is missing")
        recipes=json.loads(match.group(1))
        check(len(recipes)==1001 and len(set(x["id"] for x in recipes))==1001,
            "Protected catalog is not exactly 1001 unique recipes")
        photo,_=verify("/assets/recipes-ai/0001-lemon-spinach-pasta.webp",200,cookie=token)
        check(len(photo)>1000,"Paid recipe photo missing")
        account,_=verify("/api/me",200,cookie=token)
        info=json.loads(account)
        check(info["has_access"] and info["email"]==email,"Paid account status wrong")
        _,headers=verify("/api/logout",200,cookie=token,method="POST",data={})
        check("Max-Age=0" in headers["Set-Cookie"],"Logout did not clear cookie")
        verify("/app",403,cookie=token)
        verify("/assets/recipes-ai/0001-lemon-spinach-pasta.webp",403,cookie=token)
        check(store.has_access(email),"Logout erased lifetime entitlement")
        newtoken=issue_session(email,key)
        check(newtoken!=token,"Login tokens must be unique")
        verify("/app",200,cookie=newtoken)
        store.revoke(email)
        verify("/app",403,cookie=newtoken)
    finally:
        store.db.close()
    print(f"PASS: {count} real HTTP requests, protected 1001 recipes, paid image, account, logout and disabled checkout.")

if __name__=="__main__":
    main()
