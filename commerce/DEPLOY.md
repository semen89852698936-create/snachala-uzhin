# Commercial preview deployment - NOT active production checkout

## Release structure
Build with `Dockerfile.commerce` and deploy **a separate Timeweb Cloud application**, never overwrite the current static site before acceptance. Two-stage build reads 1001-recipe `index.html` once and copies it into `/srv/private/app.html` in the runtime image. The final image does not include `index.html`, `full-catalog/index.html`, `server.py`, `photo-library`, Git history, or original catalog JSON in its public document root.

The WSGI app is an **allowlist router**: GET `/` or `/index.html` serves the public sales-preview landing; GET `/account` serves the **Мой доступ** buyer dashboard (no private data in HTML); GET `/api/me` returns the current signed-in and purchase-right status. GET `/app` and legacy `/full-catalog/index.html` require a signed session AND an unrevoked entitlement. GET `/assets/recipes-ai/*.webp` requires the same entitlement, including normalized/aliased asset paths; other approved marketing photographs can remain public. All other source/data routes are 404. The original recipe HTML and functionality appear only for authorized buyers. No customer data is embedded in public HTML. Earlier public GitHub commits and old Vercel snapshots can never be made secret retrospectively.

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

## My Access and sign-out (PR #89)

- Responsive `commerce/public/account.html` with three states: not logged in (email recovery), valid lifetime purchase (open 1001 recipes), authenticated with no purchase (clear error and change email). Linked from public landing. The buyer's email is returned only for their valid authenticated session, inserted in UI via `textContent`.
- Login links expire in 10 minutes, are single-use and only sent to already-entitled email addresses. API responses do not reveal which emails purchased. A 60-second cooldown applies to repeated requests for the same paid address. Additional per-IP/global throttling must be supplied by the hosting edge before launch.
- Each login issues a unique signed cookie; `POST /api/logout` persists the cookie hash as revoked and clears the Secure, HttpOnly, SameSite=Lax cookie. Previously signed-out cookies must not work even if replayed. Lifetime refers to the entitlement, not the cookie duration.
- Only recipe photographs under `/assets/recipes-ai` are protected; their WebP paths are checked for **all 1001 recipes** in `commerce/private_catalog.py` at build time. Other marketing images are intentionally public.
- `python -m unittest discover -s commerce -p 'test_*.py' -v` checks catalog, private photo paths, revocation, email login and rate limiting. `scripts/e2e-commerce-account.cjs` checks UI on desktop and mobile with mocked API responses. This is not a live buyer/payment test.
