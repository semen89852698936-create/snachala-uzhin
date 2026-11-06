"""End-to-end WSGI tests for passwordless access, without real email or money."""
import io,json,tempfile,unittest
from pathlib import Path
from urllib.parse import urlencode
from unittest.mock import patch
from commerce.http_app import CommerceApp
from commerce.access import issue_session

KEY=b'0123456789abcdef0123456789abcdef'
class LoginFlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)
        self.private=self.root/'private.html'
        self.private.write_text('<html>BUYER_ONLY_RECIPE_1001</html>',encoding='utf-8')
        self.app=CommerceApp(db_path=self.root/'payments.sqlite',private_html=self.private,
                             session_key=KEY,base_url='https://test.example',
                             smtp={'host':'fake.test','port':'465','user':'x','password':'x','sender':'test@example.org'})
        self.sent=[]
        self.app.send_email=lambda email,token:self.sent.append((email,token))
    def tearDown(self):
        self.app.store.db.close()
        self.tmp.cleanup()
    def request(self,method,path,body=None,cookie=''):
        response={}
        payload=json.dumps(body or {},ensure_ascii=False).encode() if method=='POST' else b''
        environ={'REQUEST_METHOD':method,'PATH_INFO':path.split('?')[0],
                 'QUERY_STRING':path.split('?',1)[1] if '?' in path else '',
                 'HTTP_COOKIE':cookie,'HTTP_ORIGIN':'https://test.example',
                 'CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(payload)),
                 'wsgi.input':io.BytesIO(payload)}
        def start(status,headers):response.update(status=status,headers=dict(headers))
        response['body']=b''.join(self.app(environ,start))
        return response
    def pay(self,email='buyer@example.ru'):
        order=self.app.store.create_order(email)
        self.app.store.grant_verified_payment(order_num=order['order_num'],
            payment_id='payment-'+order['order_num'],amount='1900.00',verified=True)
    def test_unpaid_email_does_not_send_link_and_does_not_reveal_purchase(self):
        r=self.request('POST','/api/auth/request-link',{'email':'unpaid@example.ru'})
        self.assertEqual(r['status'],'200 OK')
        self.assertFalse(self.sent)
        self.assertEqual(self.request('GET','/app')['status'],'403 Forbidden')
        self.assertEqual(r['body'],self.request('POST','/api/auth/request-link',
            {'email':'unknown@example.ru'})['body'])
    def test_paid_email_cross_device_login_and_revoke(self):
        self.pay()
        r=self.request('POST','/api/auth/request-link',{'email':'Buyer@Example.RU'})
        self.assertEqual(r['status'],'200 OK')
        self.assertEqual(len(self.sent),1)
        email,token=self.sent[0]
        self.assertEqual(email,'buyer@example.ru')
        self.assertEqual(self.request('GET','/app')['status'],'403 Forbidden')
        login=self.request('GET','/login?'+urlencode({'token':token}))
        self.assertEqual(login['status'],'303 See Other')
        cookie=login['headers']['Set-Cookie']
        self.assertIn('Secure',cookie)
        self.assertIn('HttpOnly',cookie)
        self.assertIn('SameSite=Lax',cookie)
        authorized=self.request('GET','/app',cookie=cookie)
        self.assertEqual(authorized['status'],'200 OK')
        self.assertIn(b'BUYER_ONLY_RECIPE_1001',authorized['body'])
        self.assertEqual(self.request('GET','/login?'+urlencode({'token':token}))['status'],'403 Forbidden')
        self.app.store.revoke(email)
        self.assertEqual(self.request('GET','/app',cookie=cookie)['status'],'403 Forbidden')
    def test_throttled_paid_requests_do_not_reveal_purchase_or_send_spam(self):
        self.pay()
        first=self.request('POST','/api/auth/request-link',{'email':'buyer@example.ru'})
        second=self.request('POST','/api/auth/request-link',{'email':'buyer@example.ru'})
        self.assertEqual(first['status'],'200 OK')
        self.assertEqual(first['body'],second['body'])
        self.assertEqual(len(self.sent),1)
    def test_logout_revokes_valid_session_not_only_browser_cookie(self):
        self.pay()
        token=issue_session('buyer@example.ru',KEY)
        self.assertEqual(self.request('GET','/app',cookie='su_session='+token)['status'],'200 OK')
        logout=self.request('POST','/api/logout',{},cookie='su_session='+token)
        self.assertEqual(logout['status'],'200 OK')
        self.assertIn('Max-Age=0',logout['headers']['Set-Cookie'])
        self.assertTrue(self.app.store.session_revoked(token))
        # Even reusing a stolen old cookie must not restore access.
        self.assertEqual(self.request('GET','/app',cookie='su_session='+token)['status'],'403 Forbidden')
        state=json.loads(self.request('GET','/api/me',cookie='su_session='+token)['body'])
        self.assertFalse(state['authenticated'])
        self.assertFalse(state['has_access'])
        # The purchase right survives signing out, and a fresh login can still work.
        self.assertTrue(self.app.store.has_access('buyer@example.ru'))
        newer=issue_session('buyer@example.ru',KEY)
        self.assertNotEqual(token,newer)
        self.assertEqual(self.request('GET','/app',cookie='su_session='+newer)['status'],'200 OK')
    def test_sessions_have_unique_random_nonce(self):
        first=issue_session('buyer@example.ru',KEY)
        second=issue_session('buyer@example.ru',KEY)
        self.assertNotEqual(first,second)
    def test_checkout_still_disabled_and_no_order_created(self):
        response=self.request('POST','/api/orders',{'email':'buyer@example.ru'})
        self.assertEqual(response['status'],'503 Service Unavailable')
        count=self.app.store.db.execute('SELECT COUNT(*) FROM orders').fetchone()[0]
        self.assertEqual(count,0)
if __name__=='__main__':unittest.main()
