# Deployment

MVP target:
- Git repository
- Preview deployments for PRs
- Production deployment from main
- Environment variables managed by platform secret storage
- Database migrations run explicitly as part of release

Do not make production depend on a developer laptop.

## Cloudflare/domain checklist for OWNER

Decision (2026-09-17, see `docs/exec-plans/active/go-live-deployment-plan.md`): Cloudflare stays
registrar + authoritative DNS, **DNS-only** — no orange-cloud proxy in front of Vercel. Vercel's own
guidance (<https://vercel.com/kb/guide/cloudflare-with-vercel>) is that stacking Cloudflare's proxy
in front of Vercel reduces the client signals available to Vercel's own Firewall/BotID, adds a hop,
and creates overlapping caching behavior — and this project has no Cloudflare-specific feature
(WAF/Turnstile/BotID) that would justify the extra layer.

- [ ] Buy the domain and add it to Cloudflare; replace the registrar nameservers with the two Cloudflare nameservers shown for the zone.
- [ ] Add the domain (apex and `www`) to the Vercel project, then use Vercel's own domain-inspection output for the exact `A`/`CNAME` values to add in Cloudflare — do not hardcode values from memory. Set both records' proxy status to **DNS only** (grey cloud, not orange).
- [ ] Keep the apex domain canonical; configure `www` → apex redirect at the Vercel level (DNS records don't perform HTTP redirects).
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin (no trailing slash) and obtain `NEXT_PUBLIC_GA_ID` from GA4 Admin > Data Streams.
- [ ] Before going live on the real domain, verify the public rate-limited routes (order lookup, quote lookup, attachment upload, tool price estimate) are reading the client IP from `x-forwarded-for` via `getClientIp()` in `src/lib/rate-limit.ts` — not `cf-connecting-ip`, which is meaningless without a Cloudflare proxy in the request path and was a launch blocker fixed 2026-09-17.
- [ ] Run the release checklist and smoke-test the storefront through the real domain.

If a Cloudflare proxy is deliberately added later (e.g. for its WAF), this whole checklist needs
revisiting: re-enable the orange-cloud proxy, add cache-bypass rules for `/admin/*`, `/api/*`,
`/cart`, `/checkout`, and `/order-confirmation/*` (confirmation URLs carry customer access
credentials and must never be edge-cached), set SSL/TLS to Full (Strict), and switch
`getClientIp()` back to preferring `cf-connecting-ip` — the two configurations must not drift out
of sync with each other.

## Vercel Firewall rule — MakerWorld estimate (ADR-0033)

The public MakerWorld estimate endpoint has no in-app/DB rate limiter by design (makerworld plan B5).
Before enabling the storefront card in Production, add in Vercel → Project → Firewall → Rules:

- Name: `makerworld-estimate-rate-limit`
- If: Request Path **equals** `/api/public/makerworld-estimate`
- Then: **Rate Limit** — Fixed window, 60 s, **20 requests**, key: IP → action **Deny** (429)

Rate-limit rules depend on the Vercel plan — check the Firewall page shows the Rate Limit action for this project; if not, keep the storefront card's estimate behind the VERIFIED path only (it reads the DB, never MakerWorld) and revisit. The storefront card already shows a friendly message on 429. Leave `MAKERWORLD_PUBLIC_RESOLVER_ENABLED`
unset (off) until the `[MAKERWORLD_RESOLVER]` logs show MakerWorld is reachable from Vercel.
