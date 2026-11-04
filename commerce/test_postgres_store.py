"""Persistent PostgreSQL payment and email access tests against temporary CI database.

Runs only with COMMERCE_TEST_POSTGRES=1 and test-only connection string.
No production database or real payments are touched.
"""
import os,unittest
from commerce.access import Store,issue_session
from commerce.email_auth import EmailAuth

DSN=os.environ.get('COMMERCE_TEST_POSTGRES_DSN','')
@unittest.skipUnless(os.environ.get('COMMERCE_TEST_POSTGRES')=='1' and DSN, 'isolated PostgreSQL CI only')
class PostgresCommerceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.store=Store(DSN)
        cls.auth=EmailAuth(cls.store)
    @classmethod
    def tearDownClass(cls):
        cls.store.db.close()
    def setUp(self):
        # Disposable CI database only. NEVER use against real buyer records.
        with self.store.db:
            for table in ('email_tokens','revoked_sessions','entitlements','orders'):
                self.store.db.execute('DELETE FROM '+table)
    def test_paid_entitlement_survives_reopening_database(self):
        order=self.store.create_order('BUYER@example.ru')
        self.assertEqual(order['amount_kopeks'],190000)
        self.assertFalse(self.store.has_access('buyer@example.ru'))
        self.assertTrue(self.store.grant_verified_payment(order_num=order['order_num'],
                        payment_id='pg-ci-pay-1',amount='1900.00',verified=True))
        self.assertFalse(self.store.grant_verified_payment(order_num=order['order_num'],
                         payment_id='pg-ci-pay-1',amount='1900.00',verified=True))
        with self.assertRaises(ValueError):
            self.store.grant_verified_payment(order_num=order['order_num'],
                         payment_id='pg-ci-different',amount='1900.00',verified=True)
        reopened=Store(DSN)
        try:
            self.assertTrue(reopened.has_access('buyer@example.ru'))
            reopened.revoke('buyer@example.ru')
        finally:
            reopened.db.close()
        self.assertFalse(self.store.has_access('buyer@example.ru'))
    def test_unsigned_wrong_sum_and_unknown_order_never_grant(self):
        order=self.store.create_order('buyer@example.ru')
        data={'order_num':order['order_num'],'payment_id':'p2','amount':'1900.00'}
        with self.assertRaises(PermissionError):
            self.store.grant_verified_payment(**data)
        with self.assertRaises(ValueError):
            self.store.grant_verified_payment(**dict(data,amount='1899.99'),verified=True)
        with self.assertRaises(ValueError):
            self.store.grant_verified_payment(**dict(data,order_num='unknown'),verified=True)
        self.assertFalse(self.store.has_access('buyer@example.ru'))
    def test_one_time_login_survives_database_connection(self):
        token=self.auth.request('buyer@example.ru')
        separate_store=Store(DSN)
        try:
            separate_auth=EmailAuth(separate_store)
            self.assertEqual(separate_auth.consume(token),'buyer@example.ru')
            with self.assertRaises(PermissionError):
                self.auth.consume(token)
        finally:
            separate_store.db.close()
    def test_logout_revocation_persists_across_database_connections(self):
        key=b'postgres-staging-key-only-0123456789'
        token=issue_session('buyer@example.ru',key)
        self.assertFalse(self.store.session_revoked(token))
        self.store.revoke_session(token)
        reopened=Store(DSN)
        try:
            self.assertTrue(reopened.session_revoked(token))
        finally:
            reopened.db.close()
    def test_epoched_lifetime_is_safe_after_2038(self):
        # Bigint timestamps prevent 2038 overflow for genuinely lifetime rights.
        from unittest.mock import patch
        with patch('commerce.access.time.time',return_value=2300000000):
            order=self.store.create_order('future@example.ru')
            self.assertTrue(self.store.grant_verified_payment(
                order_num=order['order_num'],payment_id='futurepg',amount='1900.00',verified=True))
            self.assertTrue(self.store.has_access('future@example.ru'))
            self.store.revoke_session(issue_session('future@example.ru',b'postgres-staging-key-only-0123456789'))
if __name__=='__main__':unittest.main()
