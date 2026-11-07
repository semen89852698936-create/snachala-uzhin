"""Integration smoke test for a DISPOSABLE local PostgreSQL service only.

Never connect to Timeweb or any live customer database. This test refuses
non-loopback hosts and requires explicit CI flags.
"""
import os
import secrets
import uuid
from urllib.parse import urlsplit

from commerce.access import PRODUCT, PRICE_KOPEKS, Store, issue_session, session_email
from commerce.email_auth import EmailAuth


def check(condition, description):
    if not condition:
        raise AssertionError(description)


def rejects(fn, error, description):
    try:
        fn()
    except error:
        return
    raise AssertionError(description)


def main():
    dsn = os.environ.get("COMMERCE_DATABASE_URL", "")
    parsed = urlsplit(dsn)
    check(os.environ.get("COMMERCE_TEST_POSTGRES") == "1", "CI mode required")
    check(os.environ.get("COMMERCE_PG_SSLMODE") == "disable", "CI localhost requires plaintext test mode")
    check(parsed.scheme in ("postgres", "postgresql"), "PostgreSQL URL required")
    check(parsed.hostname in ("127.0.0.1", "localhost", "::1"), "Only loopback test DB allowed")
    check(parsed.path == "/commerce_qa", "Only isolated QA database allowed")

    email = "qa-" + uuid.uuid4().hex + "@example.invalid"
    key = secrets.token_bytes(32)
    store = Store(dsn)
    try:
        check(not store.has_access(email), "New email must not be entitled")
        order = store.create_order(email)
        check(order["product"] == PRODUCT, "Wrong product")
        check(order["amount_kopeks"] == PRICE_KOPEKS, "Wrong amount")
        check(not store.has_access(email), "Creating order must not grant access")

        rejects(lambda: store.grant_verified_payment(
            order_num=order["order_num"], payment_id="ci-only-1",
            amount="1900.00"), PermissionError, "Unsigned order granted access")
        rejects(lambda: store.grant_verified_payment(
            order_num=order["order_num"], payment_id="ci-only-1",
            amount="1900.01", verified=True), ValueError, "Wrong amount accepted")
        check(not store.has_access(email), "Failed callback mutated entitlement")

        check(store.grant_verified_payment(
            order_num=order["order_num"], payment_id="ci-only-1",
            amount="1900.00", verified=True) is True, "Verified payment did not grant")
        check(store.has_access(email), "Paid entitlement absent")
        check(store.grant_verified_payment(
            order_num=order["order_num"], payment_id="ci-only-1",
            amount="1900.00", verified=True) is False, "Duplicate payment not idempotent")
        rejects(lambda: store.grant_verified_payment(
            order_num=order["order_num"], payment_id="ci-only-OTHER",
            amount="1900.00", verified=True), ValueError,
            "Conflicting payment reference accepted")

        token = issue_session(email, key)
        check(session_email(token, key) == email, "Signed cookie email mismatch")
        check(not store.session_revoked(token), "New cookie already revoked")
        store.revoke_session(token)
        check(store.session_revoked(token), "Signed-out cookie not revoked")
        check(session_email(issue_session(email, key), key) == email,
              "New legitimate session broken")

        auth = EmailAuth(store)
        magic = auth.request(email)
        check(auth.consume(magic) == email, "Magic link did not authenticate buyer")
        rejects(lambda: auth.consume(magic), PermissionError,
                "Magic link could be replayed")

        store.db.close()
        persisted = Store(dsn)
        try:
            check(persisted.has_access(email), "Lifetime entitlement lost after reconnect")
            check(persisted.session_revoked(token), "Logout revocation lost after reconnect")
            persisted.revoke(email)
            check(not persisted.has_access(email), "Refund/revocation did not remove access")
        finally:
            persisted.db.close()
    finally:
        try:
            store.db.close()
        except Exception:
            pass
    print("PASS: real local PostgreSQL: 1900 RUB entitlement, unsigned/wrong payment fail-closed, duplicate callback, sessions, one-use mail token, persistence, refund revocation.")


if __name__ == "__main__":
    main()
