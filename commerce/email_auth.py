"""Passwordless email login. OTP is never returned to the browser or logged."""
import hashlib,secrets,sqlite3,time
from .access import email_key
class EmailAuth:
    def __init__(self,store):
        self.store=store
        self.store.db.executescript("""
        CREATE TABLE IF NOT EXISTS email_tokens(
          token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,
          expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_email_tokens_email ON email_tokens(email);
        """)
    def request(self,email):
        email=email_key(email)
        now=int(time.time())
        recent=self.store.db.execute('SELECT MAX(created_at) FROM email_tokens WHERE email=?',(email,)).fetchone()[0]
        if recent and now-recent<60:raise PermissionError('retry later')
        raw=secrets.token_urlsafe(32)
        digest=hashlib.sha256(raw.encode()).hexdigest()
        with self.store.db:
            self.store.db.execute('DELETE FROM email_tokens WHERE expires_at<? OR email=?',(now,email))
            self.store.db.execute('INSERT INTO email_tokens(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)',
                                  (digest,email,now+600,now))
        return raw
    def consume(self,raw):
        if not isinstance(raw,str) or len(raw)>200:raise PermissionError('invalid login token')
        digest=hashlib.sha256(raw.encode()).hexdigest()
        now=int(time.time())
        with self.store.db:
            record=self.store.db.execute('SELECT email,expires_at FROM email_tokens WHERE token_hash=?',(digest,)).fetchone()
            if not record or record[1]<=now:raise PermissionError('invalid or expired login token')
            self.store.db.execute('DELETE FROM email_tokens WHERE token_hash=?',(digest,))
        return record[0]
    def invalidate_email(self,email):
        with self.store.db:
            self.store.db.execute('DELETE FROM email_tokens WHERE email=?',(email_key(email),))
