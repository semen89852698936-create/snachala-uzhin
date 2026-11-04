"""Passwordless access regression without network or real buyer data."""
import tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from http.cookies import SimpleCookie
from commerce.access import Store,issue_session
from commerce.email_auth import EmailAuth
from commerce.http_app import CommerceApp

class EmailAccessTests(unittest.TestCase):
    def setUp(self):
        self.dir=tempfile.TemporaryDirectory()
        self.root=Path(self.dir.name)
        self.store=Store(self.root/'db.sqlite')
        self.auth=EmailAuth(self.store)
        self.address='buyer@example.ru'
    def tearDown(self):
        self.store.db.close()
        self.dir.cleanup()
    def test_magic_link_is_one_time(self):
        token=self.auth.request(self.address)
        self.assertEqual(self.auth.consume(token),self.address)
        with self.assertRaises(PermissionError):self.auth.consume(token)
    def test_cannot_reuse_old_or_expired_link(self):
        with patch('commerce.email_auth.time.time',return_value=100000):
            token=self.auth.request(self.address)
        with patch('commerce.email_auth.time.time',return_value=100602):
            with self.assertRaises(PermissionError):self.auth.consume(token)
        with patch('commerce.email_auth.time.time',return_value=100000):
            with self.assertRaises(PermissionError):self.auth.request(self.address)
    def test_new_device_needs_email_but_preserves_lifetime_purchase(self):
        order=self.store.create_order(self.address)
        self.store.grant_verified_payment(order_num=order['order_num'],payment_id='payment1',
                                           amount='1900.00',verified=True)
        self.assertTrue(self.store.has_access(self.address))
        one=self.auth.request(self.address)
        self.assertEqual(self.auth.consume(one),self.address)
        self.store.db.close()
        self.store=Store(self.root/'db.sqlite')
        self.auth=EmailAuth(self.store)
        with patch('commerce.email_auth.time.time',return_value=9999999999):
            second=self.auth.request(self.address)
            self.assertEqual(self.auth.consume(second),self.address)
        self.assertTrue(self.store.has_access(self.address))
    def test_api_denies_paid_catalog_even_with_valid_unpaid_session(self):
        private=self.root/'app.html'
        private.write_text('PRIVATE_CONTENT',encoding='utf-8')
        secret=b'0123456789abcdef0123456789abcdef'
        app=CommerceApp(db_path=self.root/'server.sqlite',private_html=private,
                        session_key=secret,base_url='https://site.example')
        try:
            token=issue_session(self.address,secret)
            def request(cookie):
                info={}
                def start(status,headers):info['status']=status
                result=b''.join(app({'REQUEST_METHOD':'GET','PATH_INFO':'/app',
                   'HTTP_COOKIE':'su_session='+cookie},start))
                return info['status'],result
            self.assertEqual(request(token)[0],'403 Forbidden')
            self.assertNotIn(b'PRIVATE_CONTENT',request(token)[1])
            order=app.store.create_order(self.address)
            app.store.grant_verified_payment(order_num=order['order_num'],payment_id='paid2',
                                             amount='1900.00',verified=True)
            self.assertEqual(request(token)[0],'200 OK')
            app.store.revoke(self.address)
            self.assertEqual(request(token)[0],'403 Forbidden')
        finally:app.store.db.close()
if __name__=='__main__':unittest.main()
