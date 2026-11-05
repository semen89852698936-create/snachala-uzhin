"""Fail-closed commerce core. Never expose grant_verified_payment as an HTTP endpoint."""
import sqlite3, secrets, hmac, hashlib, base64, json, time
from decimal import Decimal, InvalidOperation
from pathlib import Path

PRODUCT = 'snachala-uzhin-lifetime-1001'
PRICE_KOPEKS = 190000
# Exact product title configured in the Prodamus catalog; must match signed callback.
PRODUCT_TITLE = 'СНАЧАЛА УЖИН - бессрочный доступ к 1001 рецепту'

def email_key(email):
    if not isinstance(email, str): raise ValueError('email required')
    email=email.strip().lower()
    if '@' not in email or ' ' in email or len(email)>254 or '.' not in email.split('@')[-1]: raise ValueError('invalid email')
    return email

def to_kopeks(value):
    try:
        n=Decimal(str(value))
        if not n.is_finite() or n!=n.quantize(Decimal('.01')): raise ValueError('invalid sum')
        return int(n*100)
    except (ValueError, InvalidOperation, TypeError): raise ValueError('invalid sum')

class Store:
    def __init__(self,path):
        self._postgres=str(path).startswith(('postgres://','postgresql://'))
        if self._postgres:
            from .postgres_db import PostgresDb
            self.db=PostgresDb(str(path))
        else:
            self.db=sqlite3.connect(str(Path(path)))
            self.db.execute('PRAGMA busy_timeout=5000')
        self.db.executescript("""
          CREATE TABLE IF NOT EXISTS orders (
            order_num TEXT PRIMARY KEY, email TEXT NOT NULL, product TEXT NOT NULL,
            amount_kopeks BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
            provider_payment_id TEXT UNIQUE, created_at BIGINT NOT NULL);
          CREATE TABLE IF NOT EXISTS entitlements (
            email TEXT NOT NULL, product TEXT NOT NULL,
            granted_at BIGINT NOT NULL, revoked_at BIGINT,
            PRIMARY KEY(email,product));
          CREATE TABLE IF NOT EXISTS revoked_sessions (
            token_hash TEXT PRIMARY KEY, expires_at BIGINT NOT NULL);
        """)
    def create_order(self,email):
        email=email_key(email)
        n='SU-'+secrets.token_hex(16)
        with self.db: self.db.execute(
            'INSERT INTO orders(order_num,email,product,amount_kopeks,created_at) VALUES (?,?,?,?,?)',
            (n,email,PRODUCT,PRICE_KOPEKS,int(time.time())))
        return {'order_num':n,'email':email,'product':PRODUCT,'amount_kopeks':PRICE_KOPEKS}
    def grant_verified_payment(self,*,order_num,payment_id,amount,verified=False):
        # Only a future private adapter which verified Prodamus Sign may invoke this.
        if verified is not True: raise PermissionError('unsigned notification')
        if not payment_id or not isinstance(payment_id,str): raise ValueError('missing payment id')
        if to_kopeks(amount)!=PRICE_KOPEKS: raise ValueError('incorrect sum')
        with self.db:
            sql='SELECT email,product,amount_kopeks,status,provider_payment_id FROM orders WHERE order_num=?'
            if self._postgres:
                sql+=' FOR UPDATE'
            row=self.db.execute(sql,(order_num,)).fetchone()
            if not row or row[1]!=PRODUCT or row[2]!=PRICE_KOPEKS: raise ValueError('unknown or mismatched order')
            if row[3]=='paid':
                if row[4]!=payment_id: raise ValueError('conflicting payment')
                return False
            if row[3]!='pending': raise ValueError('order not pending')
            self.db.execute('UPDATE orders SET status=?,provider_payment_id=? WHERE order_num=?',('paid',payment_id,order_num))
            self.db.execute("""INSERT INTO entitlements(email,product,granted_at,revoked_at)
              VALUES (?,?,?,NULL) ON CONFLICT(email,product) DO UPDATE SET revoked_at=NULL""",
              (row[0],PRODUCT,int(time.time())))
        return True
    def has_access(self,email):
        return self.db.execute('SELECT 1 FROM entitlements WHERE email=? AND product=? AND revoked_at IS NULL',
            (email_key(email),PRODUCT)).fetchone() is not None
    def revoke(self,email):
        with self.db: self.db.execute('UPDATE entitlements SET revoked_at=? WHERE email=? AND product=?',
            (int(time.time()),email_key(email),PRODUCT))
    def revoke_session(self,token):
        # Remember revocation for the maximum session lifetime; raw cookies are not stored.
        digest=hashlib.sha256(token.encode()).hexdigest()
        now=int(time.time())
        with self.db:
            self.db.execute('DELETE FROM revoked_sessions WHERE expires_at<?',(now,))
            self.db.execute('INSERT INTO revoked_sessions(token_hash,expires_at) VALUES (?,?) ON CONFLICT(token_hash) DO UPDATE SET expires_at=excluded.expires_at',
                            (digest,now+604800))
    def session_revoked(self,token):
        digest=hashlib.sha256(token.encode()).hexdigest()
        row=self.db.execute('SELECT 1 FROM revoked_sessions WHERE token_hash=? AND expires_at>?',
                            (digest,int(time.time()))).fetchone()
        return row is not None

def _b64(data): return base64.urlsafe_b64encode(data).rstrip(b'=').decode()
def _unb64(s): return base64.urlsafe_b64decode(s+'='*(-len(s)%4))

def issue_session(email,key,ttl=86400):
    # A session is not proof of a paid order, check Store.has_access for every request.
    if not isinstance(key,bytes) or len(key)<32: raise ValueError('weak key')
    if not isinstance(ttl,int) or not 60<=ttl<=604800: raise ValueError('bad TTL')
    body=_b64(json.dumps({'email':email_key(email),'exp':int(time.time())+ttl,
                          'nonce':secrets.token_hex(16)},separators=(',',':')).encode())
    return body+'.'+_b64(hmac.new(key,body.encode(),hashlib.sha256).digest())

def session_email(token,key):
    if not isinstance(token,str) or len(token)>4096 or token.count('.')!=1: raise PermissionError('bad session')
    body,sig=token.split('.')
    expected=_b64(hmac.new(key,body.encode(),hashlib.sha256).digest())
    if not hmac.compare_digest(sig,expected): raise PermissionError('bad signature')
    try:
        data=json.loads(_unb64(body))
        if not isinstance(data['exp'],int) or data['exp']<=int(time.time()): raise PermissionError('expired')
        return email_key(data['email'])
    except (ValueError,KeyError,TypeError,UnicodeError): raise PermissionError('bad session')
