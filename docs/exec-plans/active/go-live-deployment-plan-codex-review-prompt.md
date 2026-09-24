Read `AGENTS.md` first, then `docs/exec-plans/active/go-live-deployment-plan.md`
in full — it's the complete context: current verified Vercel/Supabase state, a
blocker Claude found, the missing-env-var list, and 3 open decisions Claude
flagged for the Owner. Also read `src/lib/order-confirmation-token.ts` (the
blocker file) and `src/config/site.ts` (env vars referenced by the plan). Do
not write code and do not run `vercel`/`supabase` commands that change state —
this is a review pass before anything gets executed, not implementation.

## Project context (short version, full detail in the plan doc)
BaSa3D is a Next.js 3D-printing storefront on Vercel + Supabase. It's already
been deployed to Production repeatedly, but never actually opened to real
paying customers with a real domain — that's what this plan is trying to
close out safely. Nobody but Claude has looked at this plan yet.

## Question 1 — Is the blocker really a blocker, and is anything else missing?
Claude's plan claims `ORDER_CONFIRMATION_SECRET` throws at runtime if unset
(`order-confirmation-token.ts:9`) and is absent from `vercel env ls` output
for every environment, so it treats this as a hard blocker for real orders.

Challenge this:
- Verify the throw path actually fires during the real order-confirmation flow
  (which route/service calls this, and does anything catch the throw and
  degrade gracefully instead of failing the request?).
- Grep for any other `process.env.X` reads in the codebase that throw or
  behave unsafely if unset, that Claude's env-var audit (based on
  `.env.example` + `vercel env ls`) might have missed — the audit was a diff
  against a file list, not a full codebase scan.
- Is there any secret currently set in Vercel that looks like a leftover/wrong
  value worth flagging (without printing the actual secret values)?

## Question 2 — Backup strategy: is Option A (Supabase Pro) actually sufficient?
Claude recommends upgrading the Production Supabase project to Pro for daily
backups + PITR, over building a custom `pg_dump` pipeline, mainly to avoid
maintenance burden and silent-failure risk on the DIY option.

Challenge this:
- Does Supabase Pro's backup retention window (check what it actually is, not
  assumed) meet a reasonable RPO/RTO for an order/inventory system where data
  loss means losing real customer orders? If not, what's missing on top of
  Pro (e.g. an additional off-Supabase export)?
- Is there a middle-ground option Claude didn't consider — e.g. a lightweight
  scheduled export that's much simpler than a full DIY pipeline (name it
  concretely), instead of "Pro vs. build everything yourself"?
- Given `docs/roadmap.md` already lists Phase 12 (filament/expense tracking)
  and other inventory-heavy phases, does the backup story need to account for
  anything beyond `orders`/`order_items`/`product_variants` tables?

## Question 3 — Domain → Vercel DNS: which approach, concretely?
Claude recommends pointing DNS records straight at Vercel and leaving
Cloudflare as registrar + DNS-only, instead of keeping Cloudflare's proxy
(orange-cloud) in front, to avoid double-edge conflicts.

Challenge this:
- Is "DNS-only, no Cloudflare proxy" actually the right default for this app,
  or is there a concrete reason (e.g. BotID, firewall, cost) this project
  would want Cloudflare's proxy in front of Vercel despite the added
  complexity?
- What exact DNS records need to be created (A/CNAME/ALIAS, apex vs. `www`),
  and does anything in this plan or `vercel.json`/`next.config` assume a
  specific domain shape (apex-only vs. `www` redirect) that isn't stated yet?

End with one clear final recommendation per question. If you'd make the same
call as the tentative decision, say so explicitly and why — "I'd choose the
same thing" is a valid, useful answer here, not a non-answer.
