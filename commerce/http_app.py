"""Isolated WSGI commerce preview. Serves NO repository files automatically.

Operational prerequisites: HTTPS reverse proxy, persistent DB volume, secure SMTP,
private catalog outside the static root, exact Prodamus merchant configuration.
"""
import os,json,re,html,smtplib,ssl
from email.message import EmailMessage
from email.parser import BytesParser
from email.policy import default
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs,urlparse
from .access import Store,issue_session,session_email,email_key
from .email_auth import EmailAuth
from .prodamus import confirm_notification,payment_url,PaymentRejected

MAX_BODY=131072
ROOT=Path(__file__).resolve().parent.parent

def read_multipart(environ):
    length=int(environ.get('CONTENT_LENGTH') or 0)
    if length<=0 or length>MAX_BODY:raise ValueError('invalid body length')
    ctype=environ.get('CONTENT_TYPE','')
    if not ctype.startswith('multipart/form-data;'):raise ValueError('multipart expected')
    raw=environ['wsgi.input'].read(length)
    msg=BytesParser(policy=default).parsebytes(('Content-Type: '+ctype+'\r\nMIME-Version: 1.0\r\n\r\n').encode()+raw)
    if not msg.is_multipart():raise ValueError('multipart expected')
    result={};products={}
    for part in msg.iter_parts():
        if part.get_content_disposition()!='form-data':raise ValueError('unexpected part')
        key=part.get_param('name',header='content-disposition')
        if not key:raise ValueError('missing field name')
        value=part.get_payload(decode=True)
        if value is None or len(value)>8192:raise ValueError('invalid field length')
        value=value.decode('utf-8')
        match=re.fullmatch(r'products\[(\\d+)\]\[([a-z_]+)\]',key)
        if match:
            n=int(match.group(1))
            if n>10:raise ValueError('too many products')
            slot=products.setdefault(n,{})
            if match.group(2) in slot:raise ValueError('duplicate item field')
            slot[match.group(2)]=value
        else:
            if key in result or '[' in key or ']' in key:raise ValueError('duplicate/invalid field')
            result[key]=value
    if products:
        if sorted(products)!=list(range(len(products))):raise ValueError('nonsequential products')
        result['products']=[products[i] for i in sorted(products)]
    return result

def _cookie(environ):
    cookie=SimpleCookie()
    try:cookie.load(environ.get('HTTP_COOKIE',''))
    except Exception:return ''
    item=cookie.get('su_session')
    return item.value if item else ''

class CommerceApp:
    def __init__(self,*,db_path,private_html,session_key,base_url,merchant_url='',sys_code='',merchant_secret='',smtp=None,checkout_enabled=False):
        self.store=Store(db_path)
        self.auth=EmailAuth(self.store)
        self.private_html=Path(private_html).resolve()
        self.session_key=session_key
        self.base_url=base_url.rstrip('/')
        parsed=urlparse(self.base_url)
        if parsed.scheme!='https' or not parsed.hostname:raise ValueError('HTTPS base_url required')
        self.origin=parsed.scheme+'://'+parsed.netloc
        self.merchant_url=merchant_url
        self.sys_code=sys_code
        self.merchant_secret=merchant_secret
        self.smtp=smtp or {}
        self.checkout_enabled=checkout_enabled
    def respond(self,start,status,body,btype='application/json; charset=utf-8',headers=None):
        if isinstance(body,dict):body=json.dumps(body,ensure_ascii=False).encode()
        if isinstance(body,str):body=body.encode()
        headers=list(headers or [])
        headers.extend([('Content-Type',btype),('Content-Length',str(len(body))),('Cache-Control','no-store'),
                        ('X-Content-Type-Options','nosniff'),('Referrer-Policy','no-referrer'),
                        ('Content-Security-Policy',"frame-ancestors 'none'"),('X-Frame-Options','DENY')])
        start(status,headers)
        return [body]
    def send_email(self,email,token):
        required=('host','port','user','password','sender')
        if not all(self.smtp.get(x) for x in required):raise RuntimeError('SMTP is not configured')
        message=EmailMessage()
        message['From']=self.smtp['sender']
        message['To']=email
        message['Subject']='СНАЧАЛА УЖИН - вход в мой каталог'
        message.set_content('Для входа открой ссылку (действует 10 минут):\n'+self.base_url+'/login?token='+token)
        with smtplib.SMTP_SSL(self.smtp['host'],int(self.smtp['port']),context=ssl.create_default_context(),timeout=10) as client:
            client.login(self.smtp['user'],self.smtp['password'])
            client.send_message(message)
    def json_request(self,environ):
        length=int(environ.get('CONTENT_LENGTH') or 0)
        if length<=0 or length>4096:raise ValueError('invalid JSON body size')
        if not environ.get('CONTENT_TYPE','').startswith('application/json'):raise ValueError('JSON required')
        data=json.loads(environ['wsgi.input'].read(length))
        if not isinstance(data,dict):raise ValueError('expected object')
        return data
    def current_email(self,environ):
        token=_cookie(environ)
        return session_email(token,self.session_key) if token else None
    def __call__(self,environ,start):
        method=environ.get('REQUEST_METHOD','GET')
        path=environ.get('PATH_INFO','/')
        try:
            if method=='GET' and path=='/healthz':
                return self.respond(start,'200 OK',{'ok':True,'commerce':'not-live-until-validated'})
            if method=='GET' and path in ('/','/index.html'):
                public=ROOT/'commerce'/'public'/'index.html'
                return self.respond(start,'200 OK',public.read_bytes(),'text/html; charset=utf-8')
            if method=='GET' and path=='/app':
                email=self.current_email(environ)
                if not email or not self.store.has_access(email):return self.respond(start,'403 Forbidden',{'error':'purchase_required'})
                return self.respond(start,'200 OK',self.private_html.read_bytes(),'text/html; charset=utf-8')
            if method=='GET' and path=='/api/me':
                email=self.current_email(environ)
                return self.respond(start,'200 OK',{'authenticated':bool(email),'has_access':bool(email and self.store.has_access(email))})
            if method=='GET' and path=='/login':
                token=parse_qs(environ.get('QUERY_STRING','')).get('token',[''])[0]
                email=self.auth.consume(token)
                session=issue_session(email,self.session_key)
                return self.respond(start,'303 See Other',b'',headers=[
                    ('Location','/app' if self.store.has_access(email) else '/'),
                    ('Set-Cookie','su_session='+session+'; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400')])
            if method=='GET' and (path.startswith('/assets/') or path=='/favicon.svg'):
                # Assets remain public. Never serve HTML, JSON, Python or source trees.
                base=(ROOT/'assets').resolve() if path.startswith('/assets/') else ROOT.resolve()
                rel=path.removeprefix('/assets/') if path.startswith('/assets/') else 'favicon.svg'
                target=(base/rel).resolve()
                if not target.is_relative_to(base) or not target.is_file() or target.suffix.lower() not in ('.webp','.avif','.svg','.png','.jpg','.jpeg'):
                    return self.respond(start,'404 Not Found',{'error':'not_found'})
                media={'.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[target.suffix.lower()]
                return self.respond(start,'200 OK',target.read_bytes(),media)
            if method=='POST' and path.startswith('/api/'):
                if environ.get('HTTP_ORIGIN','')!=self.origin:raise PermissionError('invalid origin')
                if path=='/api/orders':
                    if not self.checkout_enabled: return self.respond(start,'503 Service Unavailable',{'error':'checkout_not_enabled'})
                    data=self.json_request(environ)
                    order=self.store.create_order(data.get('email'))
                    link=payment_url(order,merchant_url=self.merchant_url,sys_code=self.sys_code,secret=self.merchant_secret,return_url=self.base_url+'/')
                    return self.respond(start,'201 Created',{'checkout_url':link,'order_num':order['order_num']})
                if path=='/api/auth/request-link':
                    data=self.json_request(environ)
                    email=email_key(data.get('email'))
                    if not self.smtp:return self.respond(start,'503 Service Unavailable',{'error':'mail_not_configured'})
                    token=self.auth.request(email)
                    try:self.send_email(email,token)
                    except Exception:
                        self.auth.invalidate_email(email)
                        raise
                    return self.respond(start,'200 OK',{'message':'Если адрес существует, письмо отправлено'})
                if path=='/api/logout':
                    return self.respond(start,'200 OK',{'ok':True},headers=[('Set-Cookie','su_session=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')])
            if method=='POST' and path=='/webhooks/prodamus':
                # Prodamus does not set a browser Origin. Signature alone authenticates it.
                if not self.checkout_enabled or not self.merchant_secret:return self.respond(start,'503 Service Unavailable',{'error':'not_configured'})
                data=read_multipart(environ)
                confirm_notification(data,environ.get('HTTP_SIGN',''),merchant_domain=urlparse(self.merchant_url).hostname,
                                     sys_code=self.sys_code,secret=self.merchant_secret,store=self.store)
                return self.respond(start,'200 OK','success','text/plain; charset=utf-8')
            return self.respond(start,'404 Not Found',{'error':'not_found'})
        except (PermissionError,ValueError,PaymentRejected):
            return self.respond(start,'403 Forbidden',{'error':'unauthorized_or_invalid_request'})
        except Exception:
            # Don't expose secrets or internal exceptions to clients.
            return self.respond(start,'503 Service Unavailable',{'error':'temporarily_unavailable'})

def from_environment():
    def req(name):
        val=os.environ.get(name)
        if not val:raise RuntimeError('Missing '+name)
        return val
    settings={}
    if os.environ.get('SMTP_HOST'):
        settings={'host':req('SMTP_HOST'),'port':req('SMTP_PORT'),'user':req('SMTP_USER'),
                  'password':req('SMTP_PASSWORD'),'sender':req('SMTP_SENDER')}
    return CommerceApp(db_path=req('COMMERCE_DB_PATH'),private_html=req('PRIVATE_CATALOG_HTML'),
                       session_key=bytes.fromhex(req('SESSION_KEY_HEX')),base_url=req('COMMERCE_BASE_URL'),
                       merchant_url=os.getenv('PRODAMUS_URL',''),sys_code=os.getenv('PRODAMUS_SYS',''),
                       merchant_secret=os.getenv('PRODAMUS_SECRET',''),smtp=settings,
                       checkout_enabled=os.getenv('ENABLE_CHECKOUT')=='1')
