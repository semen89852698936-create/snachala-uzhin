# Commercial preview deployment - NOT active production checkout

## Release structure
Build with `Dockerfile.commerce` and deploy **a separate Timeweb Cloud application**, never overwrite the current static site before acceptance. Two-stage build reads 1001-recipe `index.html` once and copies it into `/srv/private/app.html` in the runtime image. The final image does not include `index.html`, `full-catalog/index.html`, `server.py`, `photo-library`, Git history, or original catalog JSON in its public document root.

The WSGI app is an **allowlist router**: GET `/` or `/index.html` serves the public sales-preview landing; GET `/account` serves the **Мой доступ** buyer dashboard (no private data in HTML); GET `/api/me` returns the current signed-in and purchase-right status. GET `/app` and legacy `/full-catalog/index.html` require a signed session AND an unrevoked entitlement. GET `/assets/recipes-ai/*.webp` requires the same entitlement, including normalized/aliased asset paths; other approved marketing photographs can remain public. All other source/data routes are 404. The original recipe HTML and functionality appear only for authorized buyers. No customer data is embedded in public HTML. Earlier public GitHub commits and old Vercel snapshots can never be made secret retrospectively.

## Environment and persistence
Copy the **variable names** from `commerce/.env.example` into the Timeweb Cloud secret store; never copy actual secrets into a repository, ticket or chat. Set `COMMERCE_BASE_URL` to the protected HTTPS origin. Real purchases require an EXTERNAL PostgreSQL database in a Russian region, reachable through the private network: set secret `COMMERCE_DATABASE_URL` and use TLS (`COMMERCE_PG_SSLMODE=require`, the default). Timeweb App Platform recreates containers on redeploy, so SQLite inside the application container cannot safely hold paid orders. `COMMERCE_DB_PATH` remains only for disposable local or CI testing; it must not be used to take payments. Set up automated database backups, recovery tests and a migration procedure. Checkout startup fails closed without PostgreSQL, working SMTP, configured merchant and explicit `COMMERCE_PAYMENT_QA_APPROVED=1` after real signed-payment/refund tests. `SESSION_KEY_HEX` must have >=32 secret bytes. Store and rotate `PRODAMUS_SECRET` securely. Configure SMTP with a commercial sender domain and test delivery to popular Russian providers. A production HTTPS reverse proxy is mandatory.

## Provider requirements
Confirm the merchant's actual `*.payform.ru` URL and the integration-specific `sys` code with Prodamus. The backend signs checkout parameters and validates incoming multipart notifications with HMAC; verify canonical serialization against an **official live signed fixture** before enabling `ENABLE_CHECKOUT=1`. Webhook URL: `POST https://<configured-base-domain>/webhooks/prodamus`. Prodamus sends header `Sign`, `order_num` (merchant order), `order_id` (provider transaction), `domain`, `sum`, `sys`, `payment_status`, `products`. Demo signatures deliberately differ from production signatures. Redirect from payment page is not proof of payment.

## Prodamus merchant notifications (06.11.2026)

The seller's Prodamus interface may automatically enable **"All events"** when
"Order paid" is selected. That is acceptable **only with a fail-closed backend**:
every callback must pass the provider signature check, merchant/domain check,
merchant-generated order ID, email, amount and product checks. A signed event
with `payment_status=order_canceled` or `order_denied` (or an unknown status)
must never grant access; only `success` may do so. Duplicate paid callbacks
must be idempotent. The new regression test checks these cases without external
API calls or money.

The official provider documents `multipart/form-data`, header `Sign`,
`payment_status=success`, `order_canceled`, `order_denied`, and retries after
non-200 responses:
https://help.prodamus.ru/payform/uvedomleniya/kak-ustroena-otpravka-uvedomlenii-ob-oplate

**Do not paste the current reusable payment URL into the buy button as a
substitute for per-buyer orders.** The checkout must originate from
`POST /api/orders` and carry our unique order identifier. Do not configure
the merchant webhook URL until a tested live HTTPS backend exists. The signed
fixture and refund semantics still require merchant QA before enabling
`ENABLE_CHECKOUT=1`.

## Gating tests
1. No session: `/app` -> 403; old catalogue routes must not leak full recipes.
2. Signed but unpaid session: `/app` -> 403.
3. Valid signed order paid 1900.00 RUB: permanent entitlement, refresh and new login -> 200 `/app`.
4. Wrong sum, wrong merchant domain, wrong email, wrong SKU, tampered HMAC, duplicate payment with different ID -> no new access.
5. Duplicate *same* successful callback -> idempotent and HTTP 200.
6. Redispatch / delivery delay, SMTP failure, second device, refund and revoked purchase -> correct access.
7. 1001 unique recipe IDs, all images, interactive search/cooking, mobile and RF without VPN, existing approved images, timed playlists.
8. Privacy offer, data localization obligations, chargeback / refund policy and self-employed receipts verified before receiving money.

**Important:** `/api/orders` and checkout on the separated preview are OFF by default. Existing Vercel public site remains unchanged. The new product is not yet for sale.

## My Access and sign-out (PR #89)

- Responsive `commerce/public/account.html` with three states: not logged in (email recovery), valid lifetime purchase (open 1001 recipes), authenticated with no purchase (clear error and change email). Linked from public landing. The buyer's email is returned only for their valid authenticated session, inserted in UI via `textContent`.
- Login links expire in 10 minutes, are single-use and only sent to already-entitled email addresses. API responses do not reveal which emails purchased. A 60-second cooldown applies to repeated requests for the same paid address. Additional per-IP/global throttling must be supplied by the hosting edge before launch.
- Each login issues a unique signed cookie; `POST /api/logout` persists the cookie hash as revoked and clears the Secure, HttpOnly, SameSite=Lax cookie. Previously signed-out cookies must not work even if replayed. Lifetime refers to the entitlement, not the cookie duration.
- Only recipe photographs under `/assets/recipes-ai` are protected; their WebP paths are checked for **all 1001 recipes** in `commerce/private_catalog.py` at build time. Other marketing images are intentionally public.
- `python -m unittest discover -s commerce -p 'test_*.py' -v` checks catalog, private photo paths, revocation, email login and rate limiting. `scripts/e2e-commerce-account.cjs` checks UI on desktop and mobile with mocked API responses. This is not a live buyer/payment test.

## Verified no-cost CI staging (not live hosting)

- Job commerce-docker-http builds the actual production Dockerfile and starts Gunicorn with a disposable database and ENABLE_CHECKOUT=0.
- Script scripts/smoke-commerce-http.py sends 27 HTTP requests. It confirms protected 1001-recipe HTML and paid WebP, anonymous/legacy route denials, a synthetic test purchase, account status, server-side sign-out revocation, and disabled checkout.
- Successful run: https://github.com/semen89852698936-create/snachala-uzhin/actions/runs/41899815848
- This is NOT a merchant payment, email delivery, real HTTPS, persistent production database, or a cloud-hosted website. The test database and container are destroyed after CI.
- Keep the commercial Docker image in a private registry: the private catalog is embedded in its internal filesystem, and URL access checks do not encrypt the image. .dockerignore excludes local .env files, Git and irrelevant temporary data from build context.

## Persistent PostgreSQL tested, no paid cloud instance provisioned

- Optional `COMMERCE_DATABASE_URL=postgresql://...` selects psycopg 3 with TLS required by default; `COMMERCE_PG_SSLMODE=disable` is accepted only in an isolated CI test with `COMMERCE_TEST_POSTGRES=1`.
- SQL schemas use BIGINT timestamps (year 2038-safe). Payment grant uses transactional PostgreSQL `FOR UPDATE` lock for idempotent webhook updates. Magic-link redemption uses atomic `DELETE ... RETURNING` to prevent link reuse when more than one worker is serving customers.
- GitHub Actions `postgres-store` creates a disposable PostgreSQL 17 server and tests purchase persistence after reconnect, invalid payment denial, one-use email login, session revocation, and timestamps beyond 2038. The test DB has no actual customer information and is destroyed afterward.
- Before enabling payment: provision *your own* Postgres instance in the Russian region, configure credentials in secret environment (not GitHub), encrypted backups, a tested restore operation, and review commercial and privacy requirements. Do not create a paid cloud database without explicit approval of pricing.
