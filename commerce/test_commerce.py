import tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from commerce.access import Store,PRICE_KOPEKS,issue_session,session_email
from commerce.catalog_gate import CatalogGate
class CommerceTest(unittest.TestCase):
 def setUp(self):
    self.tmp=tempfile.TemporaryDirectory()
    self.root=Path(self.tmp.name)
    self.store=Store(self.root/'db.sqlite')
    self.order=self.store.create_order('Buyer@Example.ru')
 def tearDown(self):
    self.store.db.close()
    self.tmp.cleanup()
 def pay(self,**kwargs):
    data=dict(order_num=self.order['order_num'],payment_id='p1',amount='1900.00',verified=True)
    data.update(kwargs)
    return self.store.grant_verified_payment(**data)
 def test_order_is_1900_and_unpaid_has_no_access(self):
    self.assertEqual(self.order['amount_kopeks'],PRICE_KOPEKS)
    self.assertFalse(self.store.has_access('buyer@example.ru'))
    with self.assertRaises(PermissionError): self.pay(verified=False)
 def test_wrong_amount_cannot_unlock(self):
    for amount in ['1899.99','1900.01','NaN','1900.001']:
        with self.assertRaises(ValueError): self.pay(amount=amount)
    self.assertFalse(self.store.has_access('buyer@example.ru'))
 def test_unknown_order_cannot_unlock(self):
    with self.assertRaises(ValueError): self.pay(order_num='fake')
 def test_success_persists_and_duplicates_are_safe(self):
    self.assertTrue(self.pay())
    self.assertFalse(self.pay())
    with self.assertRaises(ValueError): self.pay(payment_id='different')
    self.store.db.close()
    self.store=Store(self.root/'db.sqlite')
    self.assertTrue(self.store.has_access('buyer@example.ru'))
    self.assertFalse(self.store.has_access('other@example.ru'))
 def test_session_and_revoke(self):
    self.pay()
    key=b'staging-key-strong-enough-for-tests-123'
    token=issue_session('Buyer@Example.ru',key,60)
    self.assertEqual(session_email(token,key),'buyer@example.ru')
    with self.assertRaises(PermissionError): session_email(token+'X',key)
    with patch('commerce.access.time.time',return_value=9999999999):
        with self.assertRaises(PermissionError): session_email(token,key)
    self.store.revoke('buyer@example.ru')
    self.assertFalse(self.store.has_access('buyer@example.ru'))
 def test_protected_catalog_and_path_traversal(self):
    private=self.root/'private'
    private.mkdir()
    (private/'recipes.json').write_text('1001 recipes')
    (self.root/'public.txt').write_text('leak')
    key=b'staging-key-strong-enough-for-tests-123'
    token=issue_session('buyer@example.ru',key)
    gate=CatalogGate(private,self.store,key)
    with self.assertRaises(PermissionError): gate.read(token,'recipes.json')
    self.pay()
    self.assertEqual(gate.read(token,'recipes.json'),b'1001 recipes')
    for p in ['../public.txt','/etc/passwd','\\..\\public.txt']:
        with self.assertRaises((ValueError,PermissionError)): gate.read(token,p)
    with self.assertRaises(PermissionError): gate.read('forged','recipes.json')
if __name__=='__main__': unittest.main()
