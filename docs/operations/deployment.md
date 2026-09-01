# Deployment

MVP target:
- Git repository
- Preview deployments for PRs
- Production deployment from main
- Environment variables managed by platform secret storage
- Database migrations run explicitly as part of release

Do not make production depend on a developer laptop.

## Cloudflare/domain checklist for OWNER

- [ ] Buy the domain and add it to Cloudflare; replace the registrar nameservers with the two Cloudflare nameservers shown for the zone.
- [ ] Add the hosting provider's required `A`/`CNAME` records (Vercel or the production Node host), enable the orange-cloud proxy, and verify both apex and `www`.
- [ ] Prevent direct public access to a self-hosted origin (allow Cloudflare IP ranges at the firewall). On managed hosting, ensure only the intended canonical/proxied host is used for security-sensitive traffic.
- [ ] Redirect HTTP to HTTPS and `www` to the canonical apex domain.
- [ ] Set SSL/TLS mode to **Full (Strict)** only after the production host has a valid origin certificate.
- [ ] Enable TLS 1.3, Brotli, Automatic HTTPS Rewrites, then enable HSTS only after HTTPS works on every production hostname. HSTS is sticky in browsers; start with a short max-age before increasing it.
- [ ] Add cache bypass rules for `/admin/*`, `/api/*`, `/cart`, `/checkout`, and `/order-confirmation/*`. Confirmation URLs contain customer access credentials and must never be edge-cached.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin and obtain `NEXT_PUBLIC_GA_ID` from GA4 Admin > Data Streams.
- [ ] Run the release checklist and smoke-test the storefront through the proxied domain.

Security warning: once Cloudflare Proxy is enabled, do not trust `x-forwarded-for` for rate limits or audit identity. Use Cloudflare's edge-set `cf-connecting-ip`; `x-forwarded-for` is only the local/non-proxied fallback.
