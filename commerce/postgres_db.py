"""Small DB-API compatibility layer for a persistent PostgreSQL backend.

Only hardcoded application SQL reaches this adapter. The public runtime defaults
to TLS-required PostgreSQL. An explicit CI-only setting may disable TLS for the
isolated GitHub Actions service.
"""
import os

class PostgresDb:
    def __init__(self,dsn):
        try:
            import psycopg
        except ImportError as exc:
            raise RuntimeError('Install psycopg[binary] for PostgreSQL') from exc
        sslmode=os.environ.get('COMMERCE_PG_SSLMODE','require')
        if sslmode not in ('require','verify-full','verify-ca','disable'):
            raise ValueError('invalid PG sslmode')
        if sslmode=='disable' and os.environ.get('COMMERCE_TEST_POSTGRES')!='1':
            raise ValueError('plaintext PostgreSQL connection allowed only in isolated CI tests')
        self.conn=psycopg.connect(dsn,autocommit=True,connect_timeout=10,sslmode=sslmode)
    def execute(self,sql,params=()):
        # Convert sqlite-style placeholders on static, parameterized application SQL.
        # Do not interpolate untrusted data into SQL strings.
        return self.conn.execute(sql.replace('?','%s'),params)
    def executescript(self,script):
        # Application schema contains only plain CREATE TABLE / INDEX statements.
        for statement in script.split(';'):
            if statement.strip():
                self.execute(statement.strip())
    def __enter__(self):
        self.conn.autocommit=False
        return self
    def __exit__(self,kind,value,tb):
        try:
            if kind is None:
                self.conn.commit()
            else:
                self.conn.rollback()
        finally:
            self.conn.autocommit=True
        return False
    def close(self):
        self.conn.close()
