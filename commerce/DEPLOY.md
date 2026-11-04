# Commercial preview deployment - NOT active production checkout

## Release structure
Build with `Dockerfile.commerce` and deploy **a separate Timeweb Cloud application**, never overwrite the current static site before acceptance. Two-stage build reads 1001-recipe `index.html` once and copies it into `/srv/private/app.html` in the runtime image. The final image does not include `index.html`, `full-catalog/index.html`, `server.py`, `photo-library`, Git history, or original catalog JSON in its public document root.

The WSGI app is an *allowlist router*: GET `/` serves the public sales-preview landing; GET `/app` requires a signed session AND an unrevoked purchase entitlement; GET `/full-catalog/index.html` and /index.html from the old site do not serve any recipes; GET `/assets/*` serves only images; everything else is 404. The original visual HTML and full functionality appear only for an authorized buyer in `/app`. However, previous public GitHub commits / old caches can never be made private retrospectively.

## Environment and persistence
Copy the **variable names** from `commerce/.env.example` into the Timeweb Cloud secret store; never copy actual secrets into a repository, ticket or chat. Set `COMMERCE_BASE_URL` to the protected HTTPS origin, and set a persistent mounted volume for `COMMERCE_DB_PATH`. SQLite is only the initial single-process preview DB: before production scale/multiple instances move to Postgres stored in Russia, enable encrypted backups, restore tests and a migration procedure. `SESSION_KEY_HEX` must have >=32 secret bytes. Store and rotate `PRODAMUS_SECRET` securely. Configure SMTP with a commercial sender domain and test delivery to popular Russian providers. A production HTTPS reverse proxy is mandatory.

## Provider requirements
Confirm the merchant's actual `*.payform.ru` URL and the integration-specific `sys` code with Prodamus. The backend signs checkout parameters and validates incoming multipart notifications with HMAC; verify canonical serialization against an **official live signed fixture** before enabling `ENABLE_CHECKOUT=1`. Webhook URL: `POST https://<configured-base-domain>/webhooks/prodamus`. Prodamus sends header `Sign`, `order_num` (merchant order), `order_id` (provider transaction), `domain`, `sum`, `sys`, `payment_status`, `products`. Demo signatures deliberately differ from production signatures. Redirect from payment page is not proof of payment.

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
