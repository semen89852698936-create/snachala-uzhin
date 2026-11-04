"""Regression suite for private recipe/photo access and buyer account."""
import io,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from commerce.access import issue_session
from commerce.http_app import CommerceApp

SECRET=b'0123456789abcdef0123456789abcdef'
class PrivateCatalogSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.public=self.root/'webroot'
        (self.public/'assets'/'recipes-ai').mkdir(parents=True)
        (self.public/'commerce'/'public').mkdir(parents=True)
        (self.public/'assets'/'recipes-ai'/'private.webp').write_bytes(b'PRIVATE_RECIPE_PHOTO')
        (self.public/'assets'/'our-evening-together-approved.webp').write_bytes(b'PUBLIC_APPROVED_EVENING')
        (self.public/'commerce'/'public'/'index.html').write_bytes(b'<html>ONLY_PUBLIC_LANDING</html>')
        (self.public/'commerce'/'public'/'account.html').write_bytes(b'<html>MY_ACCESS_ACCOUNT</html>')
        self.private=self.root/'vault'/'recipes.html'
        self.private.parent.mkdir()
        self.private.write_bytes(b'<html>PRIVATE_RECIPE_TEXT_AND_STEPS_1001</html>')
        self.app=CommerceApp(db_path=self.root/'commerce.db',private_html=self.private,
                             session_key=SECRET,base_url='https://test.example')
        self.buyer='buyer@example.ru'
        self.session=issue_session(self.buyer,SECRET)
    def tearDown(self):
        self.app.store.db.close()
        self.temp.cleanup()
    def get(self,path,cookie=None):
        info={}
        environ={'REQUEST_METHOD':'GET','PATH_INFO':path.split('?')[0],
                 'QUERY_STRING':path.partition('?')[2],
                 'HTTP_COOKIE':('su_session='+cookie) if cookie else '',
                 'wsgi.input':io.BytesIO(b'')}
        def start(status,headers):info.update(status=status,headers=dict(headers))
        with patch('commerce.http_app.ROOT',self.public):
            info['body']=b''.join(self.app(environ,start))
        return info
    def pay(self):
        order=self.app.store.create_order(self.buyer)
        self.app.store.grant_verified_payment(order_num=order['order_num'],
             payment_id='paid-'+order['order_num'],amount='1900.00',verified=True)
    def test_unpaid_and_unsigned_cannot_read_recipe_text(self):
        for path in ['/app','/full-catalog/index.html']:
            for cookie in [None,self.session,'malformed.fake']:
                with self.subTest(path=path,cookie=cookie):
                    result=self.get(path,cookie)
                    self.assertEqual(result['status'],'403 Forbidden')
                    self.assertNotIn(b'PRIVATE_RECIPE_TEXT_AND_STEPS_1001',result['body'])
                    self.assertEqual(result['headers']['Cache-Control'],'no-store')
        for path in ['/recipeData.json','/api/recipes','/full-catalog/','/commerce/access.py',
                     '/index.html.bak','/.git/config','/vault/recipes.html']:
            with self.subTest(path=path):
                self.assertEqual(self.get(path)['status'],'404 Not Found')
    def test_photos_are_protected_by_resolved_path(self):
        for path in ['/assets/recipes-ai/private.webp',
                     '/assets/other/../recipes-ai/private.webp']:
            with self.subTest(path=path):
                r=self.get(path)
                self.assertEqual(r['status'],'403 Forbidden')
                self.assertNotIn(b'PRIVATE_RECIPE_PHOTO',r['body'])
        self.assertEqual(self.get('/assets/our-evening-together-approved.webp')['body'],
                         b'PUBLIC_APPROVED_EVENING')
        self.assertEqual(self.get('/assets/recipes-ai/../../vault/recipes.html')['status'],
                         '404 Not Found')
    def test_paid_user_can_get_full_html_and_photo_then_revoke(self):
        self.pay()
        self.assertEqual(self.get('/app',self.session)['body'],self.private.read_bytes())
        self.assertEqual(self.get('/full-catalog/index.html',self.session)['body'],self.private.read_bytes())
        self.assertEqual(self.get('/assets/recipes-ai/private.webp',self.session)['body'],
                         b'PRIVATE_RECIPE_PHOTO')
        self.app.store.revoke(self.buyer)
        self.assertEqual(self.get('/app',self.session)['status'],'403 Forbidden')
        self.assertEqual(self.get('/assets/recipes-ai/private.webp',self.session)['status'],
                         '403 Forbidden')
    def test_account_is_public_without_private_content(self):
        for path in ['/', '/index.html','/account','/account/']:
            r=self.get(path)
            self.assertEqual(r['status'],'200 OK')
            self.assertNotIn(b'PRIVATE_RECIPE_TEXT_AND_STEPS_1001',r['body'])
            self.assertNotIn(b'PRIVATE_RECIPE_PHOTO',r['body'])
    def test_session_status_only_shows_owner_email(self):
        anon=self.get('/api/me')
        self.assertEqual(anon['status'],'200 OK')
        state=json.loads(anon['body'])
        self.assertEqual(state['authenticated'],False)
        self.assertFalse(state['has_access'])
        self.assertIsNone(state['email'])
        self.assertEqual(json.loads(self.get('/api/me','invalid.cookie')['body']),state)
        auth=json.loads(self.get('/api/me',self.session)['body'])
        self.assertTrue(auth['authenticated'])
        self.assertFalse(auth['has_access'])
        self.pay()
        status=json.loads(self.get('/api/me',self.session)['body'])
        self.assertTrue(status['has_access'])
        self.assertEqual(status['email'],self.buyer)
        self.assertEqual(status['access_type'],'lifetime')
    def test_real_public_pages_do_not_embed_recipes_or_pretend_to_charge(self):
        files=Path(__file__).resolve().parent/'public'
        main=(files/'index.html').read_text(encoding='utf-8')
        account=(files/'account.html').read_text(encoding='utf-8')
        self.assertIn('href="/account"',main)
        self.assertNotIn('id="recipeData"',main)
        self.assertNotIn('id="recipeData"',account)
        self.assertIn('href="/app"',account)
        self.assertIn("fetch('/api/me'",account)
        self.assertIn("fetch('/api/logout'",account)
        self.assertIn("fetch('/api/auth/request-link'",account)
        self.assertNotIn('href="https://snachala-uzhin.payform.ru/"',main)
if __name__=='__main__':
    unittest.main()
