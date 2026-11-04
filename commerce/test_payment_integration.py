import io,json,tempfile,unittest
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from commerce.access import Store,PRODUCT
from commerce.prodamus import sign,verify,payment_url,confirm_notification,PaymentRejected
from commerce.private_catalog import extract
from commerce.http_app import CommerceApp,read_multipart

class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.store=Store(self.root/'orders.sqlite')
        self.order=self.store.create_order('Buyer@example.ru')
        self.key='test-only-secret'
        self.payload={
         'domain':'merchant.payform.ru','sys':'configured-sys',
         'order_num':self.order['order_num'],'order_id':'payment-provider-123',
         'customer_email':'buyer@example.ru','sum':'1900.00','payment_status':'success',
         'products':[{'name':'СНАЧАЛА УЖИН. Бессрочный доступ к 1001 рецепту',
                      'price':'1900.00','quantity':'1','sku':PRODUCT}]}
    def tearDown(self):
        self.store.db.close()
        self.temp.cleanup()
    def approve(self,body=None,signature=None):
        body=body if body is not None else self.payload
        return confirm_notification(body,signature if signature is not None else sign(body,self.key),
                                    merchant_domain='merchant.payform.ru',sys_code='configured-sys',
                                    secret=self.key,store=self.store)
    def test_payment_grant_is_idempotent(self):
        self.assertTrue(self.approve())
        self.assertFalse(self.approve())
        self.assertTrue(self.store.has_access('buyer@example.ru'))
    def test_signature_and_fields_cannot_be_modified(self):
        sig=sign(self.payload,self.key)
        altered=dict(self.payload,sum='1.00')
        with self.assertRaises(PaymentRejected):self.approve(altered,sig)
        for name,value in [('sum','1901.00'),('domain','fake.payform.ru'),('sys','evil'),
                           ('customer_email','somebody@example.ru'),('products',[])]:
            with self.subTest(name=name),self.assertRaises((PaymentRejected,ValueError)):
                self.approve(dict(self.payload,**{name:value}))
        self.assertFalse(self.store.has_access('buyer@example.ru'))
    def test_official_webhook_without_sku_grants_correct_product(self):
        # Prodamus official notification sample has product name/price/quantity but no sku.
        from copy import deepcopy
        payload=deepcopy(self.payload)
        payload['products'][0].pop('sku')
        self.assertTrue(self.approve(payload))
        self.assertTrue(self.store.has_access('buyer@example.ru'))

    def test_forged_product_name_is_rejected_even_with_valid_hmac(self):
        from copy import deepcopy
        payload=deepcopy(self.payload)
        payload['products'][0].pop('sku')
        payload['products'][0]['name']='Другая услуга'
        with self.assertRaises(PaymentRejected):self.approve(payload)
        self.assertFalse(self.store.has_access('buyer@example.ru'))

    def test_actual_merchant_url(self):
        url=payment_url(self.order,merchant_url='https://snachala-uzhin.payform.ru/',
                        sys_code='agreed-integration-code',secret=self.key,
                        return_url='https://site.example/checkout', notification_url='https://site.example/webhooks/prodamus')
        self.assertEqual(urlparse(url).hostname,'snachala-uzhin.payform.ru')
        self.assertEqual(parse_qs(urlparse(url).query)['products[0][price]'],['1900.00'])

    def test_failed_payment_never_grants(self):
        self.assertFalse(self.approve(dict(self.payload,payment_status='order_canceled')))
        self.assertFalse(self.store.has_access('buyer@example.ru'))
    def test_fixed_price_url_and_signature(self):
        url=payment_url(self.order,merchant_url='https://merchant.payform.ru/',
                        sys_code='configured-sys',secret=self.key,return_url='https://site.example/checkout', notification_url='https://site.example/webhooks/prodamus')
        qs=parse_qs(urlparse(url).query)
        self.assertEqual(qs['products[0][price]'],['1900.00'])
        self.assertEqual(qs['order_id'],[self.order['order_num']])
        self.assertNotIn('subscription',qs)
        self.assertIn('signature',qs)
        self.assertEqual(qs['urlNotification'],['https://site.example/webhooks/prodamus'])
        self.assertEqual(qs['currency'],['rub'])
        self.assertEqual(qs['payments_limit'],['1'])
        with self.assertRaises(ValueError):
            payment_url(self.order,merchant_url='https://merchant.payform.ru/',sys_code='configured-sys',
                        secret=self.key,return_url='https://site.example/checkout',
                        notification_url='https://attacker.example/webhooks/prodamus')
        with self.assertRaises(ValueError):
            payment_url(self.order,merchant_url='http://fake.example/',
                        sys_code='configured-sys',secret=self.key,return_url='https://site.example/', notification_url='https://site.example/webhooks/prodamus')
    def test_deep_sort(self):
        data={'z':'1','a':[{'z':'2','a':'3'}]}
        perm={'a':[{'a':'3','z':'2'}],'z':'1'}
        self.assertEqual(sign(data,self.key),sign(perm,self.key))
        self.assertTrue(verify(data,self.key,sign(data,self.key)))
    def test_1001_catalog_export(self):
        source=self.root/'source.html'
        recipes=[{'id':str(i),'title':'recipe','photo':'/assets/recipes-ai/%04d-test.webp'%i} for i in range(1001)]
        html='<script id="recipeData" type="application/json">'+json.dumps(recipes)+'</script>'
        source.write_text(html,encoding='utf-8')
        destination=self.root/'private'/'app.html'
        self.assertEqual(extract(source,destination)['recipes'],1001)
        self.assertEqual(destination.read_text(),html)
        source.write_text('<script id="recipeData" type="application/json">[]</script>')
        with self.assertRaises(ValueError):extract(source,destination)
        recipes[0]['photo']='/assets/public/fake.webp'
        source.write_text('<script id="recipeData" type="application/json">'+json.dumps(recipes)+'</script>')
        with self.assertRaises(ValueError):extract(source,destination)
    def test_public_server_never_serves_full_catalog(self):
        private=self.root/'app.html'
        private.write_text('PRIVATE_CATALOG_1001',encoding='utf-8')
        app=CommerceApp(db_path=self.root/'app.db',private_html=private,
              session_key=b'0123456789abcdef0123456789abcdef',
              base_url='https://site.example')
        try:
            def get(path,cookie=''):
                state={}
                def start(status,headers):state['status']=status
                response=b''.join(app({'REQUEST_METHOD':'GET','PATH_INFO':path,
                         'QUERY_STRING':'','HTTP_COOKIE':cookie},start))
                return state['status'],response
            self.assertEqual(get('/app')[0],'403 Forbidden')
            self.assertEqual(get('/full-catalog/index.html')[0],'403 Forbidden')
            self.assertEqual(get('/commerce/access.py')[0],'404 Not Found')
            self.assertEqual(get('/index.html')[0],'200 OK')
            self.assertNotIn(b'PRIVATE_CATALOG_1001',get('/index.html')[1])
        finally:app.store.db.close()
    def test_multipart_payload_is_nested(self):
        import email
        boundary='testBOUNDARY'
        crlf=chr(13)+chr(10)
        parts=[]
        for key,value in [('order_num','SU-example'),('products[0][sku]',PRODUCT),('products[0][price]','1900.00')]:
            parts.append(('--'+boundary+crlf+'Content-Disposition: form-data; name="'+key+'"'+crlf+crlf+value+crlf).encode())
        payload=b''.join(parts)+('--'+boundary+'--'+crlf).encode()
        result=read_multipart({'CONTENT_TYPE':'multipart/form-data; boundary='+boundary,
                'CONTENT_LENGTH':str(len(payload)),'wsgi.input':io.BytesIO(payload)})
        self.assertEqual(result['products'][0]['sku'],PRODUCT)

if __name__=='__main__':unittest.main()
