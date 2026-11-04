"""Live-payment activation must fail closed without production dependencies."""
import os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from commerce.http_app import from_environment

class CheckoutStartGuards(unittest.TestCase):
    def test_no_live_checkout_without_postgres(self):
        with patch.dict(os.environ,{'ENABLE_CHECKOUT':'1'},clear=True):
            with self.assertRaisesRegex(RuntimeError,'persistent PostgreSQL'):
                from_environment()
    def test_no_live_checkout_without_transactional_email(self):
        env={'ENABLE_CHECKOUT':'1','COMMERCE_DATABASE_URL':'postgresql://unused.example/db'}
        with patch.dict(os.environ,env,clear=True):
            with self.assertRaisesRegex(RuntimeError,'working SMTP'):
                from_environment()
    def test_no_live_checkout_without_real_merchant(self):
        env={'ENABLE_CHECKOUT':'1','COMMERCE_DATABASE_URL':'postgresql://unused.example/db',
             'SMTP_HOST':'smtp.test','SMTP_PORT':'465','SMTP_USER':'user',
             'SMTP_PASSWORD':'not-a-secret','SMTP_SENDER':'test@example.invalid'}
        with patch.dict(os.environ,env,clear=True):
            with self.assertRaisesRegex(RuntimeError,'configured merchant'):
                from_environment()
    def test_no_live_checkout_without_explicit_signed_payment_qa(self):
        env={'ENABLE_CHECKOUT':'1','COMMERCE_DATABASE_URL':'postgresql://unused.example/db',
             'SMTP_HOST':'smtp.test','SMTP_PORT':'465','SMTP_USER':'user',
             'SMTP_PASSWORD':'not-a-secret','SMTP_SENDER':'test@example.invalid',
             'PRODAMUS_URL':'https://snachala-uzhin.payform.ru/',
             'PRODAMUS_SYS':'unverified','PRODAMUS_SECRET':'test-only'}
        with patch.dict(os.environ,env,clear=True):
            with self.assertRaisesRegex(RuntimeError,'signed payment and refund QA'):
                from_environment()
    def test_ordinary_no_payment_staging_starts_without_merchant(self):
        with tempfile.TemporaryDirectory() as d:
            private=Path(d)/'private.html'
            private.write_text('not for public')
            env={'ENABLE_CHECKOUT':'0','COMMERCE_BASE_URL':'https://test.example',
                 'COMMERCE_DB_PATH':str(Path(d)/'state.sqlite'),
                 'PRIVATE_CATALOG_HTML':str(private),
                 'SESSION_KEY_HEX':'0123456789abcdef'*4}
            with patch.dict(os.environ,env,clear=True):
                app=from_environment()
                try:
                    self.assertFalse(app.checkout_enabled)
                    self.assertFalse(app.store.has_access('nobody@example.invalid'))
                finally:
                    app.store.db.close()
if __name__=='__main__':unittest.main()
