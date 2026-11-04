"""Prodamus adapter. Validate official merchant fixture before enabling live checkout."""
import hashlib,hmac,json
from urllib.parse import urlencode,urlparse
from .access import PRODUCT,PRICE_KOPEKS,email_key,to_kopeks

class PaymentRejected(ValueError): pass

def _norm(x):
    if isinstance(x,dict): return {str(k):_norm(v) for k,v in sorted(x.items(),key=lambda i:str(i[0]))}
    if isinstance(x,list): return [_norm(v) for v in x]
    if x is None: return ''
    if isinstance(x,bool): return '1' if x else '0'
    return str(x)

def sign(data,secret):
    if not isinstance(secret,str) or not secret: raise ValueError('missing secret')
    raw=json.dumps(_norm(data),sort_keys=True,ensure_ascii=True,separators=(',',':')).replace('/','\\/')
    return hmac.new(secret.encode(),raw.encode(),hashlib.sha256).hexdigest()

def verify(data,secret,signature):
    return isinstance(signature,str) and len(signature)==64 and hmac.compare_digest(sign(data,secret),signature.lower())

def payment_url(order,*,merchant_url,sys_code,secret,return_url):
    url=urlparse(merchant_url)
    if url.scheme!='https' or not url.hostname or not url.hostname.endswith('.payform.ru') or url.username or url.password or url.query: raise ValueError('invalid merchant URL')
    if not sys_code: raise ValueError('missing sys code')
    if not return_url.startswith('https://'): raise ValueError('HTTPS return URL needed')
    if order.get('product')!=PRODUCT or order.get('amount_kopeks')!=PRICE_KOPEKS: raise ValueError('wrong product/price')
    data={'do':'pay','sys':sys_code,'order_id':order['order_num'],
          'customer_email':email_key(order['email']),
          'products':[{'name':'СНАЧАЛА УЖИН. Бессрочный доступ к 1001 рецепту','price':'1900.00','quantity':'1','sku':PRODUCT}],
          'urlReturn':return_url,'urlSuccess':return_url}
    flat={k:v for k,v in data.items() if k!='products'}
    for i,p in enumerate(data['products']):
        for k,v in p.items():flat[f'products[{i}][{k}]']=v
    flat['signature']=sign(data,secret)
    return merchant_url.rstrip('/')+'/?'+urlencode(flat)

def confirm_notification(payload,signature,*,merchant_domain,sys_code,secret,store):
    if not verify(payload,secret,signature):raise PaymentRejected('invalid signature')
    if payload.get('domain')!=merchant_domain or payload.get('sys')!=sys_code:raise PaymentRejected('wrong merchant')
    if payload.get('payment_status')!='success':return False
    order_num=payload.get('order_num')
    payment_id=payload.get('order_id')
    if not isinstance(order_num,str) or not order_num.startswith('SU-'):raise PaymentRejected('invalid order_num')
    if not isinstance(payment_id,str) or not payment_id:raise PaymentRejected('missing provider ID')
    row=store.db.execute('SELECT email FROM orders WHERE order_num=?',(order_num,)).fetchone()
    if not row:raise PaymentRejected('unknown order')
    if email_key(payload.get('customer_email',''))!=row[0]:raise PaymentRejected('email mismatch')
    if to_kopeks(payload.get('sum'))!=PRICE_KOPEKS:raise PaymentRejected('sum mismatch')
    products=payload.get('products')
    if not isinstance(products,list) or len(products)!=1 or not isinstance(products[0],dict):raise PaymentRejected('bad items')
    p=products[0]
    # Official sample callback omits SKU even if checkout contains one.
    # Rely on the signed product name, count and price; validate SKU when present.
    expected_name='СНАЧАЛА УЖИН. Бессрочный доступ к 1001 рецепту'
    if p.get('sku') not in (None, '', PRODUCT) or p.get('name')!=expected_name or p.get('quantity')!='1' or to_kopeks(p.get('price'))!=PRICE_KOPEKS:raise PaymentRejected('item mismatch')
    return store.grant_verified_payment(order_num=order_num,payment_id=payment_id,amount=payload['sum'],verified=True)
