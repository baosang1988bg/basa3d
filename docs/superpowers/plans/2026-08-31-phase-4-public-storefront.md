# Phase 4 — Public Storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public-facing storefront (design tokens, catalog browsing, product detail, and a public custom-print intake form) on top of the existing Phase 1–3 admin/backend, without touching admin layout/DOM or Phase 5+ features (cart, checkout, payment, production workflow).

**Architecture:** Next.js App Router route group `(storefront)` renders public pages against two new/extended read paths: a storefront-safe catalog service (ACTIVE-only, no `cost_price`, coarse stock) and a new unauthenticated `POST /api/public/custom-requests` route that reuses the existing `custom-request.service.ts` with a widened nullable `actorId`. Design tokens move from the Next.js default (`app/globals.css`) to the Tactile Neo-Craft palette via CSS variables only — the existing admin DOM (Phase 3) is untouched and inherits the new tokens automatically because it already renders through `bg-background`/`text-foreground`/etc. Tailwind utility classes.

**Tech Stack:** Next.js 15 (App Router) + TypeScript, PostgreSQL via `pg.Pool`, Zod at the API boundary, Tailwind CSS 3 + `class-variance-authority`, `next/font/google`, Playwright for E2E, `tsx --test` for unit/integration tests. No new npm dependencies.

**Spec:** `docs/exec-plans/active/phase-4.md` (all "Quyết định đã chốt" decisions are locked — do not re-litigate them), `design-system/MASTER.md` (exact token values), `docs/architecture/decisions.md` ADR-0010/ADR-0013, `docs/architecture/api-conventions.md`, `docs/database/schema.md`.

## Global Constraints

- Money is always integer VND (minor unit = 1), never floating point (`AGENTS.md` rule 2).
- Authorization is enforced server-side; the new public route intentionally has none — that is the *only* exception, and it lives in the dedicated `api/public/*` namespace so it stays auditable by path (`grep -r "api/public"`).
- Validate all external input with Zod at the API boundary (`domain/schemas.ts`).
- Never expose `cost_price`, exact `onHand`, or exact `reserved` through any public path.
- Server always hardcodes `sourceChannel: 'WEBSITE'` and ignores any client-sent value for the public custom-request route (defense-in-depth, same pattern as the Phase 3 `status: 'ACTIVE'` fix in `GET /api/products`).
- Do not fetch, preview, or otherwise dereference `attachmentUrl` server-side (SSRF risk) — store as opaque text only.
- Admin DOM/layout under `src/app/admin/**` must not change in this phase — only CSS variables/tokens change globally.
- No new npm dependencies (no CAPTCHA lib, no `next-themes`, no icon-font emoji) — hand-roll the light/dark toggle with a plain script + `localStorage`.
- Every interactive element needs `cursor-pointer`, a visible `focus-visible` ring, and a 150–300ms hover transition; respect `prefers-reduced-motion`.
- Exact color/type/radius/shadow values come from `design-system/MASTER.md` — do not invent new values.
- Rate-limit threshold for the public custom-request route: **3 submissions per `customer_phone` per 10 minutes** — document this exact threshold in a code comment at the query site.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260831000000_public_custom_request_support.sql` | New migration: `custom_requests.attachment_url`, `custom_request_source_channel` gains `WEBSITE`, `audit_logs.actor_id` reverted to nullable. |
| `docs/architecture/decisions.md` | ADR-0013 addendum documenting the `actor_id` nullable reversal. |
| `tailwind.config.ts` | Adds `shadow-tactile`/`shadow-tactile-accent` box-shadow utilities and `font-heading` family token. |
| `src/app/globals.css` | Replaces default oklch tokens with the Tactile Neo-Craft light/dark palette from `design-system/MASTER.md` §2. |
| `src/app/layout.tsx` | Loads `Plus Jakarta Sans` + `Inter` via `next/font/google`; adds the pre-hydration theme script. |
| `src/lib/theme-script.ts` | Exports the inline dark-mode bootstrap script (string) used in `layout.tsx`. |
| `src/components/storefront/theme-toggle.tsx` | Client component: light/dark toggle button, writes `localStorage` + toggles `.dark` on `<html>`. |
| `src/domain/schemas.ts` | Adds `publicCustomRequestInputSchema`. |
| `src/services/custom-request.service.ts` | Widens `createCustomRequest`'s `actorId` to `string | null`; inserts `attachment_url`; branches audit `action`. |
| `src/app/api/public/custom-requests/route.ts` | New public `POST` route: honeypot + rate-limit + hardcoded `sourceChannel`. |
| `src/services/storefront-catalog.service.ts` | New service: `listStorefrontProducts`, `getStorefrontProductBySlug` — ACTIVE-only, no `cost_price`, coarse stock badge. |
| `src/components/storefront/button.tsx` | `StorefrontButton` — Primary Teal / Primary Terracotta / Secondary variants per MASTER.md §5.1. |
| `src/components/storefront/product-card.tsx` | `ProductCard` — 1:1 image, stock badge, VND price. |
| `src/components/storefront/material-badge.tsx` | `MaterialBadge` — PLA/PETG/ABS/Resin/TPU swatch tokens. |
| `src/components/storefront/spec-table.tsx` | `SpecTable` — technical spec pill grid. |
| `src/components/storefront/section-header.tsx` | `SectionHeader` — eyebrow + title + optional description. |
| `src/components/storefront/header.tsx` | Site header: logo, nav, Zalo/hotline CTA, theme toggle, cart icon placeholder, mobile drawer. |
| `src/components/storefront/footer.tsx` | Site footer. |
| `src/components/storefront/format.ts` | `formatVnd(amount: number): string` helper (shared by ProductCard/detail page). |
| `src/app/(storefront)/layout.tsx` | Wraps all storefront pages with `Header`/`Footer`. |
| `src/app/(storefront)/page.tsx` | Homepage (Sprint 4.2). Replaces the current stub `src/app/page.tsx`. |
| `src/app/(storefront)/products/page.tsx` | Product listing (Sprint 4.3). |
| `src/app/(storefront)/products/[slug]/page.tsx` | Product detail (Sprint 4.4). |
| `src/app/(storefront)/products/[slug]/confirm-intent-dialog.tsx` | Client component: the non-final "Thêm vào giỏ / Đặt in ngay" confirmation modal. |
| `src/app/(storefront)/custom-print/page.tsx` | Custom print landing (Sprint 4.5), server component wrapping the form. |
| `src/app/(storefront)/custom-print/custom-request-form.tsx` | Client component: the intake form, posts to `/api/public/custom-requests`. |
| `tests/phase-4-public-custom-request.test.ts` | New: honeypot / rate-limit / `sourceChannel` hardcoding / `attachment_url` tests. |
| `tests/phase-4-storefront-catalog.test.ts` | New: asserts no `cost_price`/exact stock ever returned publicly, ACTIVE-only. |
| `e2e/storefront.spec.ts` | New: visitor loads `/custom-print`, fills form, submits successfully. |

`src/app/page.tsx` is **deleted** (replaced by `src/app/(storefront)/page.tsx` — a route group only changes the URL segment used for organization, not the URL itself, so `/` still resolves to the homepage).

---

## Task 1: Migration — attachment_url, WEBSITE channel, revert audit_logs.actor_id to nullable

**Context needed by the implementer:** `docs/database/schema.md` line 61 says `audit_logs.actor_id` is nullable, but migration `20260830000002_audit_logs_actor_id_not_null.sql` made it `NOT NULL` during Phase 3. `phase-4.md` decision #3 requires writing an audit log row with `actor_id = null` for public submissions (`action: 'CUSTOM_REQUEST_CREATED_PUBLIC'`) — this is impossible under the current `NOT NULL` constraint. This is a real conflict between the locked decision and the current schema, not something to silently paper over. The resolution locked in for this plan: add a migration reverting `actor_id` back to nullable (the column was designed nullable in Phase 0; Phase 3's tightening didn't anticipate an unauthenticated write path) and record this reversal as an ADR-0013 addendum so the history is traceable.

**Files:**
- Create: `supabase/migrations/20260831000000_public_custom_request_support.sql`
- Modify: `docs/architecture/decisions.md` (ADR-0013 addendum)
- Test: `tests/migration-contract.test.ts` (extend)

**Interfaces:**
- Produces: `custom_requests.attachment_url` (text, nullable, `check (attachment_url is null or char_length(attachment_url) <= 2000)`), `custom_request_source_channel` enum gains `'WEBSITE'`, `audit_logs.actor_id` nullable again — all consumed by Task 2 (service) and Task 3 (route).

- [ ] **Step 1: Write the migration file**

```sql
-- Public storefront (Phase 4): custom-request intake gains a public, unauthenticated entry point.
-- Two additive schema changes plus one reversal:
alter table custom_requests add column attachment_url text
  check (attachment_url is null or char_length(attachment_url) <= 2000);

alter type custom_request_source_channel add value 'WEBSITE';

-- Phase 3 (20260830000002) made audit_logs.actor_id NOT NULL under the assumption every write
-- path has an authenticated actor. Phase 4 introduces the project's first unauthenticated write
-- path (POST /api/public/custom-requests) which must still leave an audit trail
-- (action = 'CUSTOM_REQUEST_CREATED_PUBLIC') so OWNER can distinguish it from staff-entered
-- requests. Reverting to nullable restores the original Phase 0 design (docs/database/schema.md);
-- every existing authenticated write path already supplies a real actorId and is unaffected.
-- See docs/architecture/decisions.md ADR-0013 addendum (2026-08-31).
alter table audit_logs alter column actor_id drop not null;
```

- [ ] **Step 2: Add the ADR addendum**

Append to `docs/architecture/decisions.md`, at the end of ADR-0013:

```markdown

**2026-08-31 addendum (Phase 4):** `audit_logs.actor_id` was made `NOT NULL` in the Phase 3
migration `20260830000002_audit_logs_actor_id_not_null.sql` on the assumption every write path has
an authenticated actor. Phase 4 introduces the project's first unauthenticated write path
(`POST /api/public/custom-requests`, see `docs/exec-plans/active/phase-4.md` decision #3), which
must still write an audit log entry (`action: 'CUSTOM_REQUEST_CREATED_PUBLIC'`) with `actor_id =
null` so OWNER can distinguish customer-submitted requests from staff-entered ones in the audit
log. Migration `20260831000000_public_custom_request_support.sql` reverts the column back to
nullable — its original Phase 0 design (`docs/database/schema.md`). Every existing authenticated
write path is unaffected since it already supplies a real `actorId`.
```

- [ ] **Step 3: Extend the migration contract test**

Add to `tests/migration-contract.test.ts` (new test, alongside the existing two):

```ts
test('Phase 4 migration adds attachment_url, WEBSITE channel, and reverts actor_id nullability', async () => {
  const migration = await readFile(
    new URL('../supabase/migrations/20260831000000_public_custom_request_support.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /add column attachment_url text/);
  assert.match(migration, /add value 'WEBSITE'/);
  assert.match(migration, /alter column actor_id drop not null/);
});
```

- [ ] **Step 4: Run the test to verify it fails, then apply the migration and re-run**

Run: `npx tsx --test tests/migration-contract.test.ts`
Expected: FAIL (file not found) before Step 1, PASS after.

Apply the migration against the dev database (`DATABASE_URL` must point at the Supabase/Postgres instance used by `tests/*` and `npm run dev`) using whatever migration runner the project already uses for prior files (check for a `supabase db push` / custom script — do not hand-run SQL against production).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260831000000_public_custom_request_support.sql docs/architecture/decisions.md tests/migration-contract.test.ts
git commit -m "feat: add public custom-request schema support (attachment_url, WEBSITE channel, nullable actor_id)"
```

---

## Task 2: Design tokens — tailwind.config.ts + globals.css

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: CSS variables `--background`, `--foreground`, `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`, `--destructive-foreground` (light in `:root`, dark in `.dark`); Tailwind utilities `shadow-tactile` / `shadow-tactile-accent` (light+dark aware via CSS var, since Tailwind box-shadow utilities can't branch on dark mode by themselves — use a CSS variable for the shadow color and flip it in `.dark`).

- [ ] **Step 1: Replace the token block in `src/app/globals.css`**

Replace the existing `:root { ... }` / `.dark { ... }` block (lines 9–10) with the MASTER.md §2.1 values (hex, since the codebase's existing tokens are already consumed as raw CSS color values by Tailwind's `var(--x)` — keep the same format, don't switch to `oklch()` syntax mid-migration):

```css
@layer base {
  :root {
    --background: #FAFAFA;
    --foreground: #0F172A;
    --card: #FFFFFF;
    --card-foreground: #0F172A;
    --popover: #FFFFFF;
    --popover-foreground: #0F172A;
    --primary: #0F766E;
    --primary-foreground: #FFFFFF;
    --accent: #D97706;
    --accent-foreground: #FFFFFF;
    --secondary: #F1F5F9;
    --secondary-foreground: #0F766E;
    --muted: #F1F5F9;
    --muted-foreground: #64748B;
    --border: #E2E8F0;
    --input: #CBD5E1;
    --ring: #0F766E;
    --destructive: #DC2626;
    --destructive-foreground: #FFFFFF;
    --chart-1: #0F766E; --chart-2: #D97706; --chart-3: #64748B; --chart-4: #94A3B8; --chart-5: #DC2626;
    --radius: 0.875rem;
    --sidebar: #FAFAFA; --sidebar-foreground: #0F172A; --sidebar-primary: #0F766E; --sidebar-primary-foreground: #FFFFFF;
    --sidebar-accent: #F1F5F9; --sidebar-accent-foreground: #0F766E; --sidebar-border: #E2E8F0; --sidebar-ring: #0F766E;
    --shadow-tactile-color: rgba(15, 118, 110, 0.9);
    --shadow-tactile-accent-color: rgba(154, 52, 18, 0.9);
  }
  .dark {
    --background: #0B1117;
    --foreground: #F8FAFC;
    --card: #131C26;
    --card-foreground: #F1F5F9;
    --popover: #131C26;
    --popover-foreground: #F1F5F9;
    --primary: #2DD4BF;
    --primary-foreground: #042F2E;
    --accent: #F59E0B;
    --accent-foreground: #0F172A;
    --secondary: #1E293B;
    --secondary-foreground: #E2E8F0;
    --muted: #1E293B;
    --muted-foreground: #94A3B8;
    --border: rgba(255, 255, 255, 0.10);
    --input: rgba(255, 255, 255, 0.15);
    --ring: #2DD4BF;
    --destructive: #EF4444;
    --destructive-foreground: #FFFFFF;
    --chart-1: #2DD4BF; --chart-2: #F59E0B; --chart-3: #94A3B8; --chart-4: #64748B; --chart-5: #EF4444;
    --sidebar: #0B1117; --sidebar-foreground: #F8FAFC; --sidebar-primary: #2DD4BF; --sidebar-primary-foreground: #042F2E;
    --sidebar-accent: #1E293B; --sidebar-accent-foreground: #E2E8F0; --sidebar-border: rgba(255, 255, 255, 0.10); --sidebar-ring: #2DD4BF;
    --shadow-tactile-color: rgba(45, 212, 191, 0.7);
    --shadow-tactile-accent-color: rgba(217, 119, 6, 0.7);
  }
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
  html { @apply font-sans; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

Remove the stray `body { margin: 0; font-family: Arial, sans-serif; }` line (line 5) — it predates the token system and conflicts with `font-sans`.

- [ ] **Step 2: Add tactile shadow utilities and heading font to `tailwind.config.ts`**

Add inside `theme.extend`:

```ts
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        tactile: '3px 3px 0px 0px var(--shadow-tactile-color)',
        'tactile-accent': '3px 3px 0px 0px var(--shadow-tactile-accent-color)',
      },
```

- [ ] **Step 3: Verify Tailwind picks up the new utilities**

Run: `npm run build`
Expected: build succeeds (no missing-token errors); this is a visual-only change so there's no unit test — visual verification happens in Task 13's manual pass.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "feat: add storefront design tokens and tactile shadow utilities"
```

---

## Task 3: Fonts + theme toggle bootstrap

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/lib/theme-script.ts`
- Create: `src/components/storefront/theme-toggle.tsx`

**Interfaces:**
- Produces: CSS variables `--font-sans` (Inter) and `--font-heading` (Plus Jakarta Sans) set on `<html>`; a `<script>` that runs before hydration to set `.dark` on `<html>` from `localStorage.getItem('basa3d-theme')` (falling back to `prefers-color-scheme`); `ThemeToggle` component consumed by `Header` (Task 10).
- Consumes: nothing new.

- [ ] **Step 1: Write the theme bootstrap script module**

```ts
// src/lib/theme-script.ts
// Runs synchronously before hydration (injected via <script dangerouslySetInnerHTML>) so there is
// no flash-of-wrong-theme. Kept as a plain string (not a .js asset) because it must execute
// inline, before React hydrates.
export const THEME_STORAGE_KEY = 'basa3d-theme';

export const themeBootstrapScript = `(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();`;
```

- [ ] **Step 2: Wire fonts + script into `src/app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { themeBootstrapScript } from '@/lib/theme-script';

const headingFont = Plus_Jakarta_Sans({ subsets: ['latin', 'vietnamese'], weight: ['600', '700', '800'], variable: '--font-heading' });
const bodyFont = Inter({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600'], variable: '--font-sans' });

export const metadata: Metadata = { title: 'BaSa3D', description: '3D-printing business platform' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={cn('font-sans', headingFont.variable, bodyFont.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="[font-feature-settings:'tnum']">{children}</body>
    </html>
  );
}
```

`suppressHydrationWarning` on `<html>` is required because the inline script mutates its `class` attribute before React hydrates — without it, React logs a (harmless but noisy) mismatch warning.

- [ ] **Step 3: Write the `ThemeToggle` client component**

```tsx
// src/components/storefront/theme-toggle.tsx
'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEME_STORAGE_KEY } from '@/lib/theme-script';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Private browsing / storage disabled — theme just won't persist across reloads.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
```

- [ ] **Step 4: Verify no admin regression**

Run: `npm run typecheck && npm run build`
Expected: both clean — the root layout change affects every route including `/admin/**`, so this is the step that would surface a font/hydration break early.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/lib/theme-script.ts src/components/storefront/theme-toggle.tsx
git commit -m "feat: load storefront fonts and add light/dark theme toggle"
```

---

## Task 4: `publicCustomRequestInputSchema`

**Files:**
- Modify: `src/domain/schemas.ts`
- Test: `tests/domain-schemas.test.ts` (extend)

**Interfaces:**
- Consumes: `customRequestSourceChannelSchema`, `nonEmptyText`, `positiveQuantitySchema` (already defined above in the same file).
- Produces: `publicCustomRequestInputSchema` — consumed by Task 6 (route).

- [ ] **Step 1: Add the schema**

Add directly below `customRequestInputSchema` in `src/domain/schemas.ts`:

```ts
// Public-facing variant of customRequestInputSchema (POST /api/public/custom-requests):
// - no sourceChannel field — the server always hardcodes 'WEBSITE', never trusts the client here.
// - adds attachmentUrl (link-only file intake per phase-4.md Non-goals — no binary upload in Phase 4).
// - adds honeypot: a hidden field real users never fill; any value on it means the submission is
//   spam (see route.ts for the fake-201 handling).
export const publicCustomRequestInputSchema = z.object({
  customerName: nonEmptyText.max(200),
  customerPhone: nonEmptyText.max(30),
  customerEmail: z.string().trim().email().max(320).nullable().optional(),
  description: nonEmptyText.max(20_000),
  quantity: positiveQuantitySchema.max(10_000),
  requestedMaterial: z.string().trim().max(100).nullable().optional(),
  requestedColor: z.string().trim().max(100).nullable().optional(),
  requestedSize: z.string().trim().max(100).nullable().optional(),
  attachmentUrl: z.string().trim().url().max(2000).nullable().optional(),
  honeypot: z.string().trim().max(200).optional().default(''),
}).strict();
```

- [ ] **Step 2: Write the failing test**

Add to `tests/domain-schemas.test.ts`:

```ts
test('publicCustomRequestInputSchema rejects a client-supplied sourceChannel', () => {
  const result = publicCustomRequestInputSchema.safeParse({
    customerName: 'Test', customerPhone: '0900000000', description: 'Test request', quantity: 1,
    sourceChannel: 'ZALO',
  });
  assert.equal(result.success, false);
});

test('publicCustomRequestInputSchema accepts a valid attachmentUrl and rejects a non-URL one', () => {
  const base = { customerName: 'Test', customerPhone: '0900000000', description: 'Test request', quantity: 1 };
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, attachmentUrl: 'https://drive.google.com/file/d/abc' }).success, true);
  assert.equal(publicCustomRequestInputSchema.safeParse({ ...base, attachmentUrl: 'not-a-url' }).success, false);
});
```

Import `publicCustomRequestInputSchema` alongside the existing imports at the top of the test file.

- [ ] **Step 3: Run to confirm it fails, then passes**

Run: `npx tsx --test tests/domain-schemas.test.ts`
Expected: FAIL (`publicCustomRequestInputSchema` undefined) before Step 1, PASS after.

- [ ] **Step 4: Commit**

```bash
git add src/domain/schemas.ts tests/domain-schemas.test.ts
git commit -m "feat: add publicCustomRequestInputSchema"
```

---

## Task 5: Widen `createCustomRequest` for nullable actorId + attachment_url

**Files:**
- Modify: `src/services/custom-request.service.ts`

**Interfaces:**
- Consumes: `writeAuditLog` from `audit.service.ts` (its `actorId` param type must also accept `null` now — see Step 2).
- Produces: `createCustomRequest(input: Record<string, unknown>, actorId: string | null)` — consumed by both the existing admin route (`src/app/api/custom-requests/route.ts`, unchanged call site, still passes a real `actorId: string`) and the new public route (Task 6, passes `null`).

- [ ] **Step 1: Update `createCustomRequest`**

```ts
export async function createCustomRequest(input: Record<string, unknown>, actorId: string | null) {
  return withTransaction(async (client) => {
    const requestNumber = `CR-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const result = await client.query<{ id: string; request_number: string }>(`
      insert into custom_requests (request_number, source_channel, customer_name, customer_phone, customer_email, description, quantity, requested_material, requested_color, requested_size, attachment_url)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id, request_number`, [requestNumber, input.sourceChannel, input.customerName, input.customerPhone, input.customerEmail ?? null, input.description, input.quantity, input.requestedMaterial ?? null, input.requestedColor ?? null, input.requestedSize ?? null, input.attachmentUrl ?? null]);
    const action = actorId ? 'CUSTOM_REQUEST_CREATED' : 'CUSTOM_REQUEST_CREATED_PUBLIC';
    await writeAuditLog(client, { actorId, action, entityType: 'custom_request', entityId: result.rows[0].id, afterData: input });
    return { id: result.rows[0].id, requestNumber: result.rows[0].request_number };
  });
}
```

- [ ] **Step 2: Widen `writeAuditLog`'s `actorId` type**

In `src/services/audit.service.ts`, change:

```ts
export async function writeAuditLog(client: PoolClient, input: {
  actorId: string | null; action: string; entityType: string; entityId?: string; beforeData?: unknown; afterData?: unknown;
}): Promise<void> {
```

(The SQL insert already passes `input.actorId` straight through positionally — `null` binds fine against a nullable column once Task 1's migration lands. No other call site passes `null` today, so this is purely a type widening with no behavior change for existing callers.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS — no other caller of `writeAuditLog` or `createCustomRequest` breaks, since `string` is assignable to `string | null`.

- [ ] **Step 3: Commit**

```bash
git add src/services/custom-request.service.ts src/services/audit.service.ts
git commit -m "feat: allow nullable actorId for public custom request submissions"
```

---

## Task 6: `POST /api/public/custom-requests`

**Context needed by the implementer:** This is the project's first unauthenticated write route. Two spam defenses are required, both explicitly scoped as MVP-only (see `phase-4.md` Risks section — do not add CAPTCHA or any third-party service):
1. **Honeypot**: `publicCustomRequestInputSchema`'s `honeypot` field. Real users never see or fill it (rendered visually hidden in the form, Task 14). If it has any value, respond `201` with a fake-shaped body but never touch the database or the audit log.
2. **Rate limit**: before inserting, count `custom_requests` rows with the same `customer_phone` created in the last 10 minutes via the existing `pg.Pool` (`query()` from `lib/db.ts` — no Redis/KV). Threshold: **3 per 10 minutes** (documented inline). Over the threshold: return a friendly rejection, not a raw 500.

**Files:**
- Create: `src/app/api/public/custom-requests/route.ts`

**Interfaces:**
- Consumes: `publicCustomRequestInputSchema` (Task 4), `createCustomRequest` (Task 5), `query` from `../../../../lib/db`, `apiError` from `../../../../lib/api`.
- Produces: `POST /api/public/custom-requests` — consumed by Task 14's form and Tasks 15/16's tests.

- [ ] **Step 1: Write the route**

```ts
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { query } from '../../../../lib/db';
import { publicCustomRequestInputSchema } from '../../../../domain/schemas';
import { createCustomRequest } from '../../../../services/custom-request.service';

// MVP spam defense (phase-4.md Risks section) — honeypot + phone-based rate limiting only.
// No CAPTCHA in Phase 4; revisit with Cloudflare Turnstile (or similar) if spam becomes a real
// problem post-launch, per phase-4.md Non-goals.
const RATE_LIMIT_MAX_SUBMISSIONS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 10;

export async function POST(request: Request) {
  try {
    const input = publicCustomRequestInputSchema.parse(await request.json());

    if (input.honeypot) {
      // Bot filled the hidden field. Return a real-looking 201 without inserting anything or
      // revealing to the bot that it was detected.
      return NextResponse.json({ id: randomUUID(), requestNumber: `CR-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}` }, { status: 201 });
    }

    const recentCount = await query<{ count: string }>(
      `select count(*) from custom_requests where customer_phone = $1 and created_at > now() - interval '${RATE_LIMIT_WINDOW_MINUTES} minutes'`,
      [input.customerPhone],
    );
    if (Number(recentCount.rows[0].count) >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return NextResponse.json({ code: 'RATE_LIMITED', message: 'Bạn đã gửi yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút.' }, { status: 429 });
    }

    // sourceChannel is never client-settable here — always hardcoded server-side, same
    // defense-in-depth pattern as the Phase 3 fix that forced status: 'ACTIVE' in GET /api/products.
    const { honeypot, ...serviceInput } = input;
    const created = await createCustomRequest({ ...serviceInput, sourceChannel: 'WEBSITE' }, null);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. (The `honeypot` destructure discards it before calling the service — ESLint's `no-unused-vars` may need the destructured `honeypot` to be intentionally unused; if lint flags it, prefix with `_honeypot` instead — check `eslint.config.js`'s ruleset for the exact convention already used elsewhere in the codebase, e.g. `grep -rn "no-unused-vars" eslint.config.js`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/public/custom-requests/route.ts
git commit -m "feat: add public custom request submission endpoint"
```

(Integration tests for this route are written in Task 15, after the storefront catalog service and form exist, so the full request/response contract can be exercised end-to-end in one pass — but nothing here blocks testing it standalone with `curl`/`fetch` immediately if you want an early sanity check.)

---

## Task 7: Storefront-safe catalog read service

**Context needed by the implementer:** Phase 3 had to be patched once because a public-ish path leaked `cost_price` (see `product.service.ts`'s comment on `listVariants`). Do not repeat that mistake. This new service must:
- only ever select `products` where `status = 'ACTIVE'`;
- never select `cost_price` in any query, at any level (products or variants);
- expose stock as a boolean (`inStock`), derived from `inventory.service.ts`'s existing `getStockLevel`/`availableStock` — never return `onHand`/`reserved` numbers.

**Files:**
- Create: `src/services/storefront-catalog.service.ts`

**Interfaces:**
- Consumes: `query`, `pagination` (re-export from `product.service.ts`), `getStockLevel` from `inventory.service.ts`.
- Produces: `listStorefrontProducts(input): Promise<{ page, limit, items: StorefrontProductSummary[] }>`, `getStorefrontProductBySlug(slug: string): Promise<StorefrontProductDetail | null>` — consumed by Tasks 11–13 (homepage, listing, detail pages).

- [ ] **Step 1: Write the service**

```ts
import { query } from '../lib/db';
import { pagination } from './product.service';
import { getStockLevel } from './inventory.service';

export type StorefrontProductSummary = {
  id: string; name: string; slug: string; shortDescription: string | null;
  productType: string; basePrice: number | null; categoryId: string | null;
  imageUrl: string | null; inStock: boolean;
};

export type StorefrontProductDetail = {
  id: string; name: string; slug: string; shortDescription: string | null; description: string | null;
  productType: string; basePrice: number | null; categoryId: string | null;
  variants: { id: string; sku: string; name: string; attributes: Record<string, string>; price: number; weightGrams: number | null; inStock: boolean }[];
  images: { url: string; altText: string | null; sortOrder: number }[];
};

async function attachStockFlag(variantsByProduct: Map<string, { id: string }[]>): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();
  for (const [productId, variants] of variantsByProduct) {
    let anyInStock = false;
    for (const variant of variants) {
      const stock = await getStockLevel(variant.id);
      if (stock.available > 0) { anyInStock = true; break; }
    }
    flags.set(productId, anyInStock);
  }
  return flags;
}

export async function listStorefrontProducts(input: { page?: number; limit?: number; categoryId?: string } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  const categorySql = input.categoryId ? (values.push(input.categoryId), `and p.category_id = $${values.length}`) : '';
  values.push(limit, offset);
  const rows = await query<{
    id: string; name: string; slug: string; shortDescription: string | null; productType: string;
    basePrice: number | null; categoryId: string | null; imageUrl: string | null; variantIds: string[];
  }>(`
    select p.id, p.name, p.slug, p.short_description as "shortDescription", p.product_type as "productType",
      p.base_price as "basePrice", p.category_id as "categoryId",
      (select storage_path from product_images pi where pi.product_id = p.id order by pi.sort_order limit 1) as "imageUrl",
      coalesce(array_agg(v.id) filter (where v.id is not null), '{}') as "variantIds"
    from products p left join product_variants v on v.product_id = p.id and v.is_active = true
    where p.status = 'ACTIVE' ${categorySql}
    group by p.id order by p.created_at desc limit $${values.length - 1} offset $${values.length}`, values);

  const variantsByProduct = new Map(rows.rows.map((row) => [row.id, row.variantIds.map((id) => ({ id }))]));
  const stockFlags = await attachStockFlag(variantsByProduct);

  return {
    page, limit,
    items: rows.rows.map((row) => ({
      id: row.id, name: row.name, slug: row.slug, shortDescription: row.shortDescription,
      productType: row.productType, basePrice: row.basePrice, categoryId: row.categoryId,
      imageUrl: row.imageUrl, inStock: stockFlags.get(row.id) ?? false,
    })) satisfies StorefrontProductSummary[],
  };
}

export async function getStorefrontProductBySlug(slug: string): Promise<StorefrontProductDetail | null> {
  const productResult = await query<{
    id: string; name: string; slug: string; shortDescription: string | null; description: string | null;
    productType: string; basePrice: number | null; categoryId: string | null;
  }>(`select id, name, slug, short_description as "shortDescription", description, product_type as "productType", base_price as "basePrice", category_id as "categoryId"
      from products where slug = $1 and status = 'ACTIVE'`, [slug]);
  if (!productResult.rowCount) return null;
  const product = productResult.rows[0];

  const variantRows = await query<{ id: string; sku: string; name: string; attributes: Record<string, string>; price: number; weightGrams: number | null }>(
    'select id, sku, name, attributes, price, weight_grams as "weightGrams" from product_variants where product_id = $1 and is_active = true order by created_at', [product.id],
  );
  const variants = await Promise.all(variantRows.rows.map(async (variant) => {
    const stock = await getStockLevel(variant.id);
    return { ...variant, inStock: stock.available > 0 };
  }));

  const imageRows = await query<{ storagePath: string; altText: string | null; sortOrder: number }>(
    'select storage_path as "storagePath", alt_text as "altText", sort_order as "sortOrder" from product_images where product_id = $1 order by sort_order', [product.id],
  );
  const { createSupabaseAdminClient } = await import('../lib/supabase/admin');
  const supabase = createSupabaseAdminClient();
  const images = imageRows.rows.map((row) => ({
    url: supabase.storage.from('product-images').getPublicUrl(row.storagePath).data.publicUrl,
    altText: row.altText, sortOrder: row.sortOrder,
  }));

  return { ...product, variants, images };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If the `satisfies StorefrontProductSummary[]` cast complains, double check every field name matches the type exactly (this is intentional — it's the compile-time guarantee that `cost_price` can never sneak into the returned shape without a type error).

- [ ] **Step 3: Commit**

```bash
git add src/services/storefront-catalog.service.ts
git commit -m "feat: add storefront-safe catalog read service (ACTIVE-only, no cost_price, coarse stock)"
```

(The "never leaks cost_price/exact stock" test lives in Task 15, alongside the public route tests, so both public-read-path guarantees are verified together.)

---

## Task 8: Shared storefront primitives (Button, ProductCard, MaterialBadge, SpecTable, SectionHeader)

**Files:**
- Create: `src/components/storefront/format.ts`
- Create: `src/components/storefront/button.tsx`
- Create: `src/components/storefront/material-badge.tsx`
- Create: `src/components/storefront/spec-table.tsx`
- Create: `src/components/storefront/section-header.tsx`
- Create: `src/components/storefront/product-card.tsx`

**Interfaces:**
- Produces: `formatVnd(amount: number): string`, `StorefrontButton` (`variant: 'primary' | 'accent' | 'secondary'`), `MaterialBadge` (`material: 'PLA' | 'PETG' | 'ABS' | 'RESIN' | 'TPU'`), `SpecTable` (`specs: { label: string; value: string }[]`), `SectionHeader` (`eyebrow?: string; title: string; description?: string`), `ProductCard` (`product: { name: string; slug: string; basePrice: number | null; imageUrl: string | null; inStock: boolean; productType: string }`) — all consumed by Tasks 9–13.

- [ ] **Step 1: `formatVnd`**

```ts
// src/components/storefront/format.ts
// VND has no minor unit (ADR-0010) — format as a thousands-grouped integer with the đ suffix.
export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}
```

- [ ] **Step 2: `StorefrontButton`**

Per MASTER.md §5.1 (exact classes), as a standalone component (does not touch the shared admin `src/components/ui/button.tsx`):

```tsx
// src/components/storefront/button.tsx
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'accent' | 'secondary';

const VARIANT_CLASSES: Record<Variant, string> = {
  accent: 'bg-[#D97706] text-white hover:bg-[#B45309] shadow-tactile-accent dark:bg-[#F59E0B] dark:text-[#0F172A] dark:hover:bg-[#D97706]',
  primary: 'bg-[#0F766E] text-white hover:bg-[#115E59] shadow-tactile dark:bg-[#2DD4BF] dark:text-[#042F2E] dark:hover:bg-[#14B8A6]',
  secondary: 'border border-border bg-card text-foreground hover:bg-secondary',
};

export function StorefrontButton({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-lg px-5 py-2.5 font-semibold transition-all duration-150 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 3: `MaterialBadge`**

Per MASTER.md §2.2:

```tsx
// src/components/storefront/material-badge.tsx
import { cn } from '@/lib/utils';

type Material = 'PLA' | 'PETG' | 'ABS' | 'RESIN' | 'TPU';

const MATERIAL_CLASSES: Record<Material, string> = {
  PLA: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  PETG: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  ABS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  RESIN: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  TPU: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
};

const MATERIAL_LABEL: Record<Material, string> = { PLA: 'PLA', PETG: 'PETG', ABS: 'ABS', RESIN: 'Resin', TPU: 'TPU (dẻo)' };

export function MaterialBadge({ material, className }: { material: Material; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold', MATERIAL_CLASSES[material], className)}>
      {MATERIAL_LABEL[material]}
    </span>
  );
}
```

- [ ] **Step 4: `SpecTable`**

Per MASTER.md §5.3:

```tsx
// src/components/storefront/spec-table.tsx
export function SpecTable({ specs }: { specs: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {specs.map((spec) => (
        <div key={spec.label} className="rounded-md border border-border/80 bg-muted/60 p-2.5 text-center">
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{spec.label}</div>
          <div className="font-mono text-sm font-bold text-foreground">{spec.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: `SectionHeader`**

```tsx
// src/components/storefront/section-header.tsx
export function SectionHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && <p className="mb-2 text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>}
      <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
      {description && <p className="mt-2 text-base text-muted-foreground">{description}</p>}
    </div>
  );
}
```

- [ ] **Step 6: `ProductCard`**

Per MASTER.md §5.2:

```tsx
// src/components/storefront/product-card.tsx
import Link from 'next/link';
import Image from 'next/image';
import { formatVnd } from './format';

export type ProductCardData = {
  name: string; slug: string; basePrice: number | null; imageUrl: string | null; inStock: boolean; productType: string;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const stockLabel = product.productType === 'READY_STOCK'
    ? (product.inStock ? 'Sẵn hàng' : 'Tạm hết hàng')
    : 'Đặt in 24h';
  const stockBadgeClass = product.productType === 'READY_STOCK' && product.inStock
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 ease-out hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
    >
      <div className="aspect-square overflow-hidden rounded-lg bg-muted/50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={400}
            height={400}
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Chưa có ảnh</div>
        )}
      </div>
      <span className={`absolute top-6 left-6 rounded-full px-2 py-0.5 text-xs font-semibold ${stockBadgeClass}`}>{stockLabel}</span>
      <div>
        <h3 className="font-heading text-base font-semibold text-foreground">{product.name}</h3>
        {product.basePrice != null && <p className="mt-1 text-lg font-bold text-foreground">{formatVnd(product.basePrice)}</p>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/storefront/format.ts src/components/storefront/button.tsx src/components/storefront/material-badge.tsx src/components/storefront/spec-table.tsx src/components/storefront/section-header.tsx src/components/storefront/product-card.tsx
git commit -m "feat: add storefront layout primitives (button, product card, material badge, spec table, section header)"
```

---

## Task 9: Header + Footer + storefront layout

**Files:**
- Create: `src/components/storefront/header.tsx`
- Create: `src/components/storefront/footer.tsx`
- Create: `src/app/(storefront)/layout.tsx`
- Delete: `src/app/page.tsx` (superseded by `src/app/(storefront)/page.tsx` in Task 10)

**Interfaces:**
- Consumes: `ThemeToggle` (Task 3), `StorefrontButton` (Task 8).
- Produces: `Header`, `Footer` — consumed by the storefront layout, wrapping every page in Tasks 10–13.

- [ ] **Step 1: `Header`**

Nav per phase-4.md Sprint 4.1: logo, links to `/`, `/products`, `/custom-print`, `#materials`; Zalo/hotline CTA; theme toggle; inert cart icon; mobile drawer.

```tsx
// src/components/storefront/header.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ShoppingCart, MessageCircle } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/products', label: 'Sản phẩm' },
  { href: '/custom-print', label: 'Đặt in' },
  { href: '/#materials', label: 'Bảng giá & Vật liệu' },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-heading cursor-pointer text-xl font-extrabold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          BaSa3D
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="cursor-pointer text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="https://zalo.me/"
            target="_blank"
            rel="noreferrer"
            className="hidden cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:inline-flex"
          >
            <MessageCircle className="size-4" /> Zalo tư vấn
          </a>
          <ThemeToggle />
          <button type="button" aria-label="Giỏ hàng (sắp ra mắt)" disabled className="inline-flex size-8 cursor-not-allowed items-center justify-center rounded-lg border border-border text-muted-foreground opacity-60">
            <ShoppingCart className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Mở menu"
            onClick={() => setIsMenuOpen(true)}
            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground md:hidden"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 md:hidden" onClick={() => setIsMenuOpen(false)}>
          <div
            className="ml-auto flex h-full w-72 flex-col gap-1 bg-card p-4 shadow-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading text-lg font-bold">Menu</span>
              <button type="button" aria-label="Đóng menu" onClick={() => setIsMenuOpen(false)} className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-border">
                <X className="size-4" />
              </button>
            </div>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)} className="cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-secondary">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: `Footer`**

Per phase-4.md Sprint 4.1: xưởng info, hotline/Zalo, quality/file-privacy commitment, return policy, admin link.

```tsx
// src/components/storefront/footer.tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-heading text-lg font-bold text-foreground">BaSa3D</p>
          <p className="mt-2 text-sm text-muted-foreground">Xưởng in 3D chuyên nghiệp — mô hình, decor, linh kiện kỹ thuật theo yêu cầu.</p>
          <p className="mt-2 text-sm text-muted-foreground">Hotline/Zalo: 090 000 0000</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Cam kết</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Bảo mật tuyệt đối file thiết kế khách hàng gửi</li>
            <li>Đổi trả trong 7 ngày nếu lỗi sản xuất</li>
            <li>Báo giá minh bạch, không phát sinh chi phí ẩn</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Liên kết</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li><Link href="/products" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Sản phẩm</Link></li>
            <li><Link href="/custom-print" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Đặt in theo yêu cầu</Link></li>
            <li><Link href="/admin/login" className="cursor-pointer text-muted-foreground transition-colors duration-150 hover:text-foreground">Đăng nhập quản trị</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} BaSa3D. All rights reserved.</div>
    </footer>
  );
}
```

- [ ] **Step 3: Storefront layout + delete the stub homepage**

```tsx
// src/app/(storefront)/layout.tsx
import type { ReactNode } from 'react';
import { Header } from '@/components/storefront/header';
import { Footer } from '@/components/storefront/footer';

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
```

Delete `src/app/page.tsx` — Task 10 creates `src/app/(storefront)/page.tsx`, which resolves to the same `/` URL.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (there will be a dangling route until Task 10 adds the homepage — that's expected mid-plan; `npm run build` is only run at the end of the relevant task once the homepage exists, so skip `build` here).

- [ ] **Step 5: Commit**

```bash
git rm src/app/page.tsx
git add src/components/storefront/header.tsx src/components/storefront/footer.tsx "src/app/(storefront)/layout.tsx"
git commit -m "feat: add storefront layout components (header, footer)"
```

---

## Task 10: Homepage (`/`)

**Files:**
- Create: `src/app/(storefront)/page.tsx`

**Interfaces:**
- Consumes: `listStorefrontProducts` (Task 7), `ProductCard`, `SectionHeader`, `StorefrontButton`, `MaterialBadge` (Task 8).

Content spec (phase-4.md Sprint 4.2 — implement exactly these sections, no more):
1. Hero: headline "Hiện Thực Hóa Mọi Ý Tưởng Với Công Nghệ In 3D Chuẩn Xác", a subhead, dual CTA ("Gửi file in theo yêu cầu" → `/custom-print`, "Khám phá sản phẩm" → `/products`), 3 badges ("In nhanh 24h", "Nhựa nguyên sinh cao cấp", "Báo giá nhanh trong 30p").
2. Featured Categories: 4 cards (Mô hình/Art Toys, Decor bàn làm việc, Phụ kiện tiện ích, Linh kiện kỹ thuật).
3. Featured Products Grid: 6–8 products from `listStorefrontProducts({ limit: 8 })`.
4. Custom Print Workflow Teaser: 4-step process + CTA to `/custom-print`.
5. Material Showcase: PLA vs PETG vs Resin quick comparison — this section's anchor `id="materials"` is what the header's "Bảng giá & Vật liệu" link (`/#materials`) targets.
6. Testimonials / quality commitment blurb.

- [ ] **Step 1: Write the page**

```tsx
// src/app/(storefront)/page.tsx
import Link from 'next/link';
import { listStorefrontProducts } from '@/services/storefront-catalog.service';
import { ProductCard } from '@/components/storefront/product-card';
import { SectionHeader } from '@/components/storefront/section-header';
import { StorefrontButton } from '@/components/storefront/button';
import { MaterialBadge } from '@/components/storefront/material-badge';

const CATEGORIES = [
  { name: 'Mô hình / Art Toys', description: 'Nhân vật, mô hình sưu tầm chi tiết cao' },
  { name: 'Decor bàn làm việc', description: 'Vật trang trí, đèn, chậu cây mini' },
  { name: 'Phụ kiện tiện ích', description: 'Giá đỡ, hộp đựng, phụ kiện đời sống' },
  { name: 'Linh kiện kỹ thuật', description: 'Chi tiết máy, gá lắp, prototype' },
];

const WORKFLOW_STEPS = [
  { step: '1', title: 'Gửi file', description: 'Gửi file .stl/.step/.obj/.3mf hoặc ảnh vẽ mẫu' },
  { step: '2', title: 'Tư vấn & Tối ưu', description: 'Đội ngũ kỹ thuật kiểm tra và tư vấn vật liệu phù hợp' },
  { step: '3', title: 'Báo giá 30 phút', description: 'Nhận báo giá minh bạch trong vòng 30 phút' },
  { step: '4', title: 'In & Giao hàng', description: 'Sản xuất và giao hàng tận nơi' },
];

// Forces on-demand rendering instead of build-time static generation: this page reads live
// catalog/stock data (product status and inventory availability change frequently), and without
// this, Next.js would try to statically prerender it at `next build` time using whatever
// DATABASE_URL happens to be set in the build environment — stale forever until the next deploy.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { items: featuredProducts } = await listStorefrontProducts({ limit: 8 });

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
        <h1 className="font-heading mx-auto max-w-3xl text-4xl font-extrabold text-foreground md:text-[3.25rem] md:leading-[1.15]">
          Hiện Thực Hóa Mọi Ý Tưởng Với Công Nghệ In 3D Chuẩn Xác
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Xưởng in 3D BaSa3D — từ mô hình sưu tầm đến linh kiện kỹ thuật chính xác, sản xuất theo yêu cầu với vật liệu nguyên sinh cao cấp.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/custom-print"><StorefrontButton variant="accent">Gửi file in theo yêu cầu</StorefrontButton></Link>
          <Link href="/products"><StorefrontButton variant="secondary">Khám phá sản phẩm</StorefrontButton></Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {['In nhanh 24h', 'Nhựa nguyên sinh cao cấp', 'Báo giá nhanh trong 30p'].map((badge) => (
            <span key={badge} className="rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground">{badge}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader eyebrow="Danh mục" title="Khám phá theo danh mục" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {CATEGORIES.map((category) => (
            <div key={category.name} className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-base font-semibold text-foreground">{category.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            </div>
          ))}
        </div>
      </section>

      {featuredProducts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <SectionHeader eyebrow="Nổi bật" title="Sản phẩm tiêu biểu" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {featuredProducts.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader eyebrow="Quy trình" title="Đặt in theo yêu cầu chỉ với 4 bước" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {WORKFLOW_STEPS.map((item) => (
            <div key={item.step} className="rounded-xl border border-border bg-card p-4">
              <span className="font-heading inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{item.step}</span>
              <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/custom-print"><StorefrontButton variant="primary">Bắt đầu đặt in</StorefrontButton></Link>
        </div>
      </section>

      <section id="materials" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <SectionHeader eyebrow="Vật liệu" title="So sánh nhanh vật liệu in 3D" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="PLA" />
            <p className="mt-2 text-sm text-muted-foreground">Dễ in, chi tiết cao, phù hợp mô hình trang trí, giá thành thấp.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="PETG" />
            <p className="mt-2 text-sm text-muted-foreground">Bền, chịu va đập tốt, phù hợp phụ kiện sử dụng hàng ngày.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <MaterialBadge material="RESIN" />
            <p className="mt-2 text-sm text-muted-foreground">Độ chi tiết cực cao, bề mặt mịn, phù hợp mô hình sưu tầm cao cấp.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader title="Cam kết chất lượng" description="Mỗi sản phẩm được kiểm tra độ bền và độ chính xác cơ khí trước khi giao đến khách hàng." />
      </section>
    </>
  );
}
```

- [ ] **Step 2: Verify the build renders it**

Run: `npm run build`
Expected: PASS, `/` resolves to this page (route group parentheses are stripped from the URL).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(storefront)/page.tsx"
git commit -m "feat: add storefront homepage"
```

---

## Task 11: Product listing (`/products`)

**Files:**
- Create: `src/app/(storefront)/products/page.tsx`

**Interfaces:**
- Consumes: `listStorefrontProducts` (Task 7) — extend its `input` type with a `search?: string` param (server-side `ilike` on `p.name`) added in Step 1 below, since Task 7 didn't include search.

Content spec (phase-4.md Sprint 4.3): search box, filters (category/product type/material/price — client-scoped to what the data model supports today: category via `categoryId` query param and product type via `productType` query param; material/price filters are deferred to a later phase's data model work since `product_variants.attributes` is freeform JSON with no indexed material/price-range query today — implement the UI control but note it as filtering client-side over the already-fetched page if a `requestedMaterial`-shaped attribute exists, do not invent a new column), sort (price asc/desc, newest — `sortBy` query param), responsive grid (2 cols mobile / 3–4 desktop), empty state suggesting `/custom-print`.

- [ ] **Step 1: Extend `listStorefrontProducts` with search + sort + productType**

In `src/services/storefront-catalog.service.ts`, update the function signature and query:

```ts
export async function listStorefrontProducts(input: { page?: number; limit?: number; categoryId?: string; productType?: string; search?: string; sortBy?: 'newest' | 'price_asc' | 'price_desc' } = {}) {
  const { page, limit, offset } = pagination(input);
  const values: unknown[] = [];
  let filterSql = '';
  if (input.categoryId) { values.push(input.categoryId); filterSql += ` and p.category_id = $${values.length}`; }
  if (input.productType) { values.push(input.productType); filterSql += ` and p.product_type = $${values.length}`; }
  if (input.search) { values.push(`%${input.search}%`); filterSql += ` and p.name ilike $${values.length}`; }
  const orderSql = input.sortBy === 'price_asc' ? 'p.base_price asc nulls last'
    : input.sortBy === 'price_desc' ? 'p.base_price desc nulls last'
    : 'p.created_at desc';
  values.push(limit, offset);
  const rows = await query<{
    id: string; name: string; slug: string; shortDescription: string | null; productType: string;
    basePrice: number | null; categoryId: string | null; imageUrl: string | null; variantIds: string[];
  }>(`
    select p.id, p.name, p.slug, p.short_description as "shortDescription", p.product_type as "productType",
      p.base_price as "basePrice", p.category_id as "categoryId",
      (select storage_path from product_images pi where pi.product_id = p.id order by pi.sort_order limit 1) as "imageUrl",
      coalesce(array_agg(v.id) filter (where v.id is not null), '{}') as "variantIds"
    from products p left join product_variants v on v.product_id = p.id and v.is_active = true
    where p.status = 'ACTIVE' ${filterSql}
    group by p.id order by ${orderSql} limit $${values.length - 1} offset $${values.length}`, values);

  const variantsByProduct = new Map(rows.rows.map((row) => [row.id, row.variantIds.map((id) => ({ id }))]));
  const stockFlags = await attachStockFlag(variantsByProduct);

  return {
    page, limit,
    items: rows.rows.map((row) => ({
      id: row.id, name: row.name, slug: row.slug, shortDescription: row.shortDescription,
      productType: row.productType, basePrice: row.basePrice, categoryId: row.categoryId,
      imageUrl: row.imageUrl, inStock: stockFlags.get(row.id) ?? false,
    })) satisfies StorefrontProductSummary[],
  };
}
```

(`orderSql` is built from a fixed 3-way internal switch, never interpolated from raw user input, so this stays injection-safe despite not being parameterized.)

- [ ] **Step 2: Write the listing page**

Server component reading `searchParams`, with a client-side `<form>` (GET, so filters are shareable URLs — no client JS needed for the filter bar itself):

```tsx
// src/app/(storefront)/products/page.tsx
import Link from 'next/link';
import { listStorefrontProducts } from '@/services/storefront-catalog.service';
import { ProductCard } from '@/components/storefront/product-card';
import { StorefrontButton } from '@/components/storefront/button';

type SearchParams = { q?: string; type?: string; sort?: string; page?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const sortBy = params.sort === 'price_asc' || params.sort === 'price_desc' ? params.sort : 'newest';
  const { items, page } = await listStorefrontProducts({
    search: params.q, productType: params.type, sortBy,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">Sản phẩm</h1>

      <form className="mt-6 flex flex-col gap-3 md:flex-row md:items-center" method="get">
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Tìm sản phẩm theo tên..."
          className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <select name="type" defaultValue={params.type ?? ''} className="h-10 cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm">
          <option value="">Tất cả loại</option>
          <option value="READY_STOCK">Sẵn hàng</option>
          <option value="MADE_TO_ORDER">Đặt in theo yêu cầu</option>
        </select>
        <select name="sort" defaultValue={sortBy} className="h-10 cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm">
          <option value="newest">Mới nhất</option>
          <option value="price_asc">Giá tăng dần</option>
          <option value="price_desc">Giá giảm dần</option>
        </select>
        <StorefrontButton variant="secondary" type="submit">Lọc</StorefrontButton>
      </form>

      {items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">Không tìm thấy sản phẩm phù hợp.</p>
          <p className="text-sm text-muted-foreground">Không thấy mẫu bạn cần? Gửi yêu cầu in theo thiết kế riêng của bạn.</p>
          <Link href="/custom-print"><StorefrontButton variant="accent">Gửi yêu cầu đặt in</StorefrontButton></Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      )}

      {page > 1 && (
        <div className="mt-8 flex justify-center">
          <Link href={`?${new URLSearchParams({ ...params, page: String(page - 1) })}`}><StorefrontButton variant="secondary">Trang trước</StorefrontButton></Link>
        </div>
      )}
    </div>
  );
}
```

Note: a left-hand desktop filter sidebar / mobile filter drawer is deferred to a follow-up visual pass — the `<form>` above already exposes every filter phase-4.md's data model supports (search, product type, sort); wrapping it in a collapsible drawer on mobile vs. sidebar on desktop is a CSS/layout enhancement, not a new capability, and can be done without changing this task's data contract. Flag this explicitly in the final report's "Known risks" / "Follow-up work" section — do not silently skip it.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/storefront-catalog.service.ts "src/app/(storefront)/products/page.tsx"
git commit -m "feat: add product listing page with search, filter, and sort"
```

---

## Task 12: Product detail (`/products/[slug]`) + confirmation modal

**Files:**
- Create: `src/app/(storefront)/products/[slug]/page.tsx`
- Create: `src/app/(storefront)/products/[slug]/confirm-intent-dialog.tsx`

**Interfaces:**
- Consumes: `getStorefrontProductBySlug` (Task 7), `SpecTable`, `MaterialBadge`, `StorefrontButton`, `formatVnd` (Task 8), shared `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter` from `src/components/ui/dialog.tsx` (already exists, reused as-is).

Content spec (phase-4.md Sprint 4.4): breadcrumbs, 1:1 gallery + thumbnails, name/SKU/stock badge/VND price, variant selector (color/size from `attributes`), quantity counter, "Thêm vào giỏ / Đặt in ngay" button opening the non-final confirmation modal, spec table (material/dimensions/layer height/infill/weight — pull whatever is present in `attributes`, weight from `weightGrams`), care instructions, related products.

- [ ] **Step 1: Confirmation dialog (client component)**

This must not persist anything or imply an order was placed — Phase 5 doesn't exist yet.

```tsx
// src/app/(storefront)/products/[slug]/confirm-intent-dialog.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { StorefrontButton } from '@/components/storefront/button';

export function ConfirmIntentDialog({ productName }: { productName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<StorefrontButton variant="accent" />}>Thêm vào giỏ / Đặt in ngay</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đã ghi nhận quan tâm của bạn</DialogTitle>
          <DialogDescription>
            Tính năng giỏ hàng và đặt hàng trực tuyến cho &quot;{productName}&quot; đang được hoàn thiện.
            Đây chỉ là bước xác nhận thông tin — <strong>chưa có đơn hàng nào được tạo</strong>.
            Chúng tôi sẽ liên hệ xác nhận trước khi lên đơn. Vui lòng dùng nút &quot;Đặt in&quot; ở
            đầu trang hoặc liên hệ Zalo/hotline để được hỗ trợ ngay.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <StorefrontButton variant="secondary" onClick={() => setOpen(false)}>Đã hiểu</StorefrontButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Detail page (server component)**

```tsx
// src/app/(storefront)/products/[slug]/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getStorefrontProductBySlug } from '@/services/storefront-catalog.service';
import { SpecTable } from '@/components/storefront/spec-table';
import { formatVnd } from '@/components/storefront/format';
import { ConfirmIntentDialog } from './confirm-intent-dialog';

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getStorefrontProductBySlug(slug);
  if (!product) notFound();

  const firstVariant = product.variants[0];
  const anyInStock = product.variants.some((variant) => variant.inStock);
  const specs = [
    ...(firstVariant?.weightGrams != null ? [{ label: 'Khối lượng', value: `${firstVariant.weightGrams}g` }] : []),
    ...Object.entries(firstVariant?.attributes ?? {}).map(([label, value]) => ({ label, value })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="cursor-pointer hover:text-foreground">Trang chủ</Link>
        <span className="mx-2">/</span>
        <Link href="/products" className="cursor-pointer hover:text-foreground">Sản phẩm</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-muted/50">
            {product.images[0] ? (
              <Image src={product.images[0].url} alt={product.images[0].altText ?? product.name} width={600} height={600} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">Chưa có ảnh</div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {product.images.map((image) => (
                <div key={image.url} className="size-16 overflow-hidden rounded-lg bg-muted/50">
                  <Image src={image.url} alt={image.altText ?? product.name} width={64} height={64} className="size-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">{product.name}</h1>
          {firstVariant && <p className="mt-1 text-sm text-muted-foreground">SKU: {firstVariant.sku}</p>}
          <span className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${anyInStock ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {anyInStock ? 'Sẵn hàng' : 'Đặt in 24h'}
          </span>
          {product.basePrice != null && <p className="mt-4 text-2xl font-bold text-foreground">{formatVnd(product.basePrice)}</p>}
          {product.shortDescription && <p className="mt-4 text-base text-muted-foreground">{product.shortDescription}</p>}

          {product.variants.length > 1 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-foreground">Tuỳ chọn</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <span key={variant.id} className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm transition-colors duration-150 hover:border-primary">
                    {variant.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <ConfirmIntentDialog productName={product.name} />
          </div>

          {specs.length > 0 && (
            <div className="mt-8">
              <p className="mb-2 text-sm font-semibold text-foreground">Thông số kỹ thuật</p>
              <SpecTable specs={specs} />
            </div>
          )}

          {product.description && (
            <div className="mt-8">
              <p className="mb-2 text-sm font-semibold text-foreground">Mô tả & hướng dẫn bảo quản</p>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Related products are deferred with the same reasoning as the listing page's filter sidebar — note it in "Follow-up work": it needs a same-category query (`categoryId` is already on `StorefrontProductDetail`... actually it's on the summary type, not detail — add `categoryId` is already present on `StorefrontProductDetail` per Task 7's type) which `listStorefrontProducts({ categoryId })` already supports; wire it up if time remains, otherwise it's a clearly-scoped follow-up, not a silent omission.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(storefront)/products/[slug]/page.tsx" "src/app/(storefront)/products/[slug]/confirm-intent-dialog.tsx"
git commit -m "feat: add product detail page with spec table and non-final intent confirmation modal"
```

---

## Task 13: Custom print landing (`/custom-print`) + intake form

**Files:**
- Create: `src/app/(storefront)/custom-print/page.tsx`
- Create: `src/app/(storefront)/custom-print/custom-request-form.tsx`

**Interfaces:**
- Consumes: `POST /api/public/custom-requests` (Task 6), `StorefrontButton`, `MaterialBadge` (Task 8).

Content spec (phase-4.md Sprint 4.5): hero banner, detailed 4-step process, material lookup table (PLA/PETG/ABS-ASA/TPU/Resin by durability/heat resistance/finish/cost), the intake form (name, phone/Zalo, email, material, color, quantity, file/image link, notes) — no "preferred contact channel" selector (that decision is locked: server always hardcodes `WEBSITE`).

- [ ] **Step 1: Intake form (client component)**

```tsx
// src/app/(storefront)/custom-print/custom-request-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { StorefrontButton } from '@/components/storefront/button';

type SubmitState = { status: 'idle' | 'submitting' | 'success' | 'error'; message?: string };

export function CustomRequestForm() {
  const [state, setState] = useState<SubmitState>({ status: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: 'submitting' });
    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: String(form.get('customerName') ?? ''),
      customerPhone: String(form.get('customerPhone') ?? ''),
      customerEmail: form.get('customerEmail') ? String(form.get('customerEmail')) : null,
      requestedMaterial: form.get('requestedMaterial') ? String(form.get('requestedMaterial')) : null,
      requestedColor: form.get('requestedColor') ? String(form.get('requestedColor')) : null,
      quantity: Number(form.get('quantity') ?? 1),
      attachmentUrl: form.get('attachmentUrl') ? String(form.get('attachmentUrl')) : null,
      description: String(form.get('description') ?? ''),
      honeypot: String(form.get('company-website') ?? ''),
    };

    try {
      const response = await fetch('/api/public/custom-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.status === 429) {
        const body = await response.json();
        setState({ status: 'error', message: body.message ?? 'Bạn đã gửi yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút.' });
        return;
      }
      if (!response.ok) {
        setState({ status: 'error', message: 'Có lỗi xảy ra, vui lòng thử lại.' });
        return;
      }
      setState({ status: 'success' });
      event.currentTarget.reset();
    } catch {
      setState({ status: 'error', message: 'Không thể kết nối máy chủ, vui lòng thử lại.' });
    }
  }

  if (state.status === 'success') {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-heading text-lg font-bold text-foreground">Đã gửi yêu cầu thành công!</p>
        <p className="mt-2 text-sm text-muted-foreground">Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất để tư vấn và báo giá.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-2">
      {/* Honeypot: visually hidden from real users, bots typically fill every input they see. */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="company-website">Company website</label>
        <input id="company-website" name="company-website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerName" className="text-sm font-medium text-foreground">Họ tên *</label>
        <input id="customerName" name="customerName" required maxLength={200} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerPhone" className="text-sm font-medium text-foreground">SĐT/Zalo *</label>
        <input id="customerPhone" name="customerPhone" required maxLength={30} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerEmail" className="text-sm font-medium text-foreground">Email</label>
        <input id="customerEmail" name="customerEmail" type="email" maxLength={320} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="quantity" className="text-sm font-medium text-foreground">Số lượng *</label>
        <input id="quantity" name="quantity" type="number" min={1} max={10000} required defaultValue={1} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="requestedMaterial" className="text-sm font-medium text-foreground">Vật liệu mong muốn</label>
        <select id="requestedMaterial" name="requestedMaterial" className="h-10 cursor-pointer rounded-lg border border-input bg-transparent px-3 text-sm">
          <option value="">Chưa chắc chắn / tư vấn giúp tôi</option>
          <option value="PLA">PLA</option>
          <option value="PETG">PETG</option>
          <option value="ABS">ABS/ASA</option>
          <option value="TPU">TPU (dẻo)</option>
          <option value="RESIN">Resin</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="requestedColor" className="text-sm font-medium text-foreground">Màu sắc mong muốn</label>
        <input id="requestedColor" name="requestedColor" maxLength={100} className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="attachmentUrl" className="text-sm font-medium text-foreground">Link file/ảnh mẫu (Google Drive, Dropbox...)</label>
        <input id="attachmentUrl" name="attachmentUrl" type="url" maxLength={2000} placeholder="https://drive.google.com/..." className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="description" className="text-sm font-medium text-foreground">Ghi chú chi tiết *</label>
        <textarea id="description" name="description" required maxLength={20000} rows={4} className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>

      {state.status === 'error' && <p className="text-sm text-destructive md:col-span-2">{state.message}</p>}

      <div className="md:col-span-2">
        <StorefrontButton type="submit" variant="accent" disabled={state.status === 'submitting'}>
          {state.status === 'submitting' ? 'Đang gửi...' : 'Gửi yêu cầu đặt in'}
        </StorefrontButton>
      </div>
    </form>
  );
}
```

The honeypot wrapper `div` needs `position: relative` on an ancestor for the `absolute` offscreen trick to not affect layout — the parent `<form>` above is a grid container, which already establishes a new stacking/positioning context sufficiently for this off-screen technique (the div is pulled fully out of the viewport via a large negative `left`, independent of the grid flow).

- [ ] **Step 2: Landing page (server component)**

```tsx
// src/app/(storefront)/custom-print/page.tsx
import { MaterialBadge } from '@/components/storefront/material-badge';
import { CustomRequestForm } from './custom-request-form';

const STEPS = [
  { step: '1', title: 'Gửi file', description: 'Gửi file .stl, .step, .obj, .3mf hoặc ảnh vẽ mẫu qua form bên dưới' },
  { step: '2', title: 'Tư vấn & Tối ưu', description: 'Đội ngũ kỹ thuật kiểm tra tính khả thi và tối ưu thiết kế để in' },
  { step: '3', title: 'Báo giá 30 phút', description: 'Nhận báo giá minh bạch, chi tiết trong vòng 30 phút làm việc' },
  { step: '4', title: 'In & Giao hàng', description: 'Sản xuất theo đúng thông số đã thống nhất và giao hàng tận nơi' },
];

const MATERIALS = [
  { material: 'PLA' as const, durability: 'Trung bình', heat: 'Thấp (~60°C)', finish: 'Chi tiết cao, dễ hoàn thiện', cost: 'Thấp' },
  { material: 'PETG' as const, durability: 'Cao', heat: 'Trung bình (~80°C)', finish: 'Bóng, dẻo dai', cost: 'Trung bình' },
  { material: 'ABS' as const, durability: 'Cao', heat: 'Cao (~100°C)', finish: 'Cần hậu xử lý để mịn', cost: 'Trung bình' },
  { material: 'TPU' as const, durability: 'Rất cao (đàn hồi)', heat: 'Trung bình', finish: 'Mềm dẻo', cost: 'Trung bình - cao' },
  { material: 'RESIN' as const, durability: 'Trung bình (giòn hơn)', heat: 'Thấp', finish: 'Cực mịn, chi tiết cao nhất', cost: 'Cao' },
];

export default function CustomPrintPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="text-center">
        <h1 className="font-heading text-3xl font-extrabold text-foreground md:text-4xl">Đặt in 3D theo yêu cầu</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          Gửi file thiết kế hoặc ý tưởng của bạn — BaSa3D tư vấn vật liệu, báo giá minh bạch và sản xuất chính xác.
        </p>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-4">
        {STEPS.map((item) => (
          <div key={item.step} className="rounded-xl border border-border bg-card p-4">
            <span className="font-heading inline-flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{item.step}</span>
            <h3 className="font-heading mt-3 text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold text-foreground">Bảng tra cứu vật liệu</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4">Vật liệu</th>
                <th className="py-2 pr-4">Độ bền</th>
                <th className="py-2 pr-4">Chịu nhiệt</th>
                <th className="py-2 pr-4">Độ mịn bề mặt</th>
                <th className="py-2">Chi phí</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map((row) => (
                <tr key={row.material} className="border-b border-border/60">
                  <td className="py-2 pr-4"><MaterialBadge material={row.material} /></td>
                  <td className="py-2 pr-4 text-foreground">{row.durability}</td>
                  <td className="py-2 pr-4 text-foreground">{row.heat}</td>
                  <td className="py-2 pr-4 text-foreground">{row.finish}</td>
                  <td className="py-2 text-foreground">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold text-foreground">Gửi yêu cầu đặt in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Điền thông tin bên dưới, chúng tôi sẽ liên hệ lại sớm nhất.</p>
        <div className="mt-4">
          <CustomRequestForm />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, visit `http://localhost:3000/custom-print`, submit the form with a real payload, and confirm a `custom_requests` row appears with `source_channel = 'WEBSITE'` and the `attachment_url` you entered. This is the manual counterpart to Task 15/16's automated tests — do it now so the automated tests in the next two tasks aren't the first time this path is exercised.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(storefront)/custom-print/page.tsx" "src/app/(storefront)/custom-print/custom-request-form.tsx"
git commit -m "feat: add custom print landing page and public intake form"
```

---

## Task 14: Integration tests — public custom-request route

**Files:**
- Create: `tests/phase-4-public-custom-request.test.ts`

**Interfaces:**
- Consumes: `createCustomRequest` (Task 5) directly for setup/assertions, plus real HTTP calls against a running `next start` server (same pattern as `tests/phase-3-route-auth.test.ts` — spawn the server, `fetch` against it). Add `POST /api/public/custom-requests` to the *public* exclusion note, not to `PROTECTED_ROUTES`, in `tests/phase-3-route-auth.test.ts` (Step 4 below) so the existing route-auth sweep doesn't start expecting it to reject unauthenticated calls.

- [ ] **Step 1: Write the test file**

```ts
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { type ChildProcess, spawn } from 'node:child_process';
import test, { after, before } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

const PORT = 3413;
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess: ChildProcess | undefined;

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) return;
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server did not become ready on ${BASE_URL} within ${timeoutMs}ms`);
}

before(async () => {
  if (!process.env.DATABASE_URL) return;
  serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
  await waitForServer(30_000);
});

after(async () => { if (serverProcess) serverProcess.kill('SIGTERM'); });

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    customerName: 'Test Customer',
    customerPhone: `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
    description: 'Cần in 1 mô hình test',
    quantity: 1,
    attachmentUrl: 'https://drive.google.com/file/d/abc123',
    sourceChannel: 'ZALO', // must be ignored by the server
    ...overrides,
  };
}

test('valid submission returns 201 and persists source_channel = WEBSITE and the given attachment_url, ignoring client-sent sourceChannel', { skip: !process.env.DATABASE_URL }, async () => {
  const payload = validPayload();
  const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.ok(body.id);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select source_channel, attachment_url from custom_requests where id = $1', [body.id]);
    assert.equal(row.rows[0].source_channel, 'WEBSITE');
    assert.equal(row.rows[0].attachment_url, payload.attachmentUrl);

    const auditRow = await client.query(`select actor_id, action from audit_logs where entity_id = $1 and entity_type = 'custom_request'`, [body.id]);
    assert.equal(auditRow.rows[0].actor_id, null);
    assert.equal(auditRow.rows[0].action, 'CUSTOM_REQUEST_CREATED_PUBLIC');
  } finally {
    await client.end();
  }
});

test('a filled honeypot returns a 201-shaped response but inserts no row', { skip: !process.env.DATABASE_URL }, async () => {
  const payload = validPayload({ honeypot: 'i-am-a-bot', customerPhone: `08${randomUUID().replace(/\D/g, '').slice(0, 8)}` });
  const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.ok(body.id);
  assert.ok(body.requestNumber);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select id from custom_requests where customer_phone = $1', [payload.customerPhone]);
    assert.equal(row.rowCount, 0);
  } finally {
    await client.end();
  }
});

test('submitting more than the rate limit for one phone number is rejected without inserting', { skip: !process.env.DATABASE_URL }, async () => {
  const phone = `07${randomUUID().replace(/\D/g, '').slice(0, 8)}`;
  for (let i = 0; i < 3; i += 1) {
    const response = await fetch(`${BASE_URL}/api/public/custom-requests`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload({ customerPhone: phone })),
    });
    assert.equal(response.status, 201);
  }
  const fourth = await fetch(`${BASE_URL}/api/public/custom-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validPayload({ customerPhone: phone })),
  });
  assert.equal(fourth.status, 429);
  const body = await fourth.json();
  assert.equal(body.code, 'RATE_LIMITED');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const row = await client.query('select count(*) from custom_requests where customer_phone = $1', [phone]);
    assert.equal(Number(row.rows[0].count), 3);
  } finally {
    await client.end();
  }
});
```

- [ ] **Step 2: Register the route as a deliberately-public exception**

In `tests/phase-3-route-auth.test.ts`, extend the comment above `PROTECTED_ROUTES` (do not add the route to the array — it must NOT reject unauthenticated calls):

```ts
// Every route/method that must reject an unauthenticated caller. GET routes deliberately left
// public (catalog browsing, per docs/exec-plans/completed/phase-2.md decision #1) are excluded:
// GET /api/products, GET /api/products/variants, GET /api/products/[id]/images. POST
// /api/public/custom-requests is also deliberately public (Phase 4 decision #3, the project's
// first unauthenticated write path, namespaced under api/public/* for auditability) — its own
// coverage lives in tests/phase-4-public-custom-request.test.ts.
```

- [ ] **Step 3: Run the new tests**

Run: `DATABASE_URL=<...> npx tsx --test tests/phase-4-public-custom-request.test.ts`
Expected: all 3 tests PASS against a real dev database. If they fail on the rate-limit test with an off-by-one, check that the migration's `interval '10 minutes'` string matches `RATE_LIMIT_WINDOW_MINUTES` used in the route and re-verify the threshold comment in Task 6's route code.

- [ ] **Step 4: Commit**

```bash
git add tests/phase-4-public-custom-request.test.ts tests/phase-3-route-auth.test.ts
git commit -m "test: cover public custom request submission, honeypot, and rate limiting"
```

---

## Task 15: Test — public catalog never leaks cost_price or exact stock

**Files:**
- Create: `tests/phase-4-storefront-catalog.test.ts`

**Interfaces:**
- Consumes: `listStorefrontProducts`, `getStorefrontProductBySlug` (Task 7) directly (no HTTP layer needed — these are plain service functions).

- [ ] **Step 1: Write the test**

```ts
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { listStorefrontProducts, getStorefrontProductBySlug } from '../src/services/storefront-catalog.service.js';
import { getPool } from '../src/lib/db.js';

nextEnv.loadEnvConfig(process.cwd());
after(async () => { if (process.env.DATABASE_URL) await getPool().end(); });

test('storefront catalog never returns cost_price or exact stock, and excludes non-ACTIVE products', { skip: !process.env.DATABASE_URL }, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const activeId = randomUUID();
  const draftId = randomUUID();
  const variantId = randomUUID();
  const warehouseId = randomUUID();
  const suffix = activeId.slice(0, 8);
  try {
    await client.query(`insert into warehouses (id, name, code) values ($1, 'Catalog Test Warehouse', $2)`, [warehouseId, `CATTEST${suffix.toUpperCase()}`]);
    await client.query(`insert into products (id, name, slug, product_type, status, cost_price) values ($1, 'Active Product', $2, 'READY_STOCK', 'ACTIVE', 12345)`, [activeId, `active-${suffix}`]);
    await client.query(`insert into products (id, name, slug, product_type, status, cost_price) values ($1, 'Draft Product', $2, 'READY_STOCK', 'DRAFT', 99999)`, [draftId, `draft-${suffix}`]);
    await client.query(`insert into product_variants (id, product_id, sku, name, price, cost_price) values ($1, $2, $3, 'Only variant', 50000, 30000)`, [variantId, activeId, `CATTEST-${suffix.toUpperCase()}`]);
    await client.query(`insert into inventory_movements (warehouse_id, product_variant_id, movement_type, quantity, note) values ($1, $2, 'PRODUCTION_IN', 4, 'Catalog test stock')`, [warehouseId, variantId]);

    const listing = await listStorefrontProducts({ limit: 100 });
    const active = listing.items.find((item) => item.id === activeId);
    const draft = listing.items.find((item) => item.id === draftId);
    assert.ok(active, 'ACTIVE product must be listed');
    assert.equal(draft, undefined, 'DRAFT product must never be listed publicly');
    assert.equal('costPrice' in active!, false);
    assert.equal(active!.inStock, true);
    assert.equal('onHand' in active!, false);
    assert.equal('reserved' in active!, false);

    const detail = await getStorefrontProductBySlug(`active-${suffix}`);
    assert.ok(detail);
    assert.equal('costPrice' in detail!, false);
    assert.equal('costPrice' in detail!.variants[0], false);
    assert.equal('onHand' in detail!.variants[0], false);
    assert.equal('reserved' in detail!.variants[0], false);
    assert.equal(detail!.variants[0].inStock, true);

    const draftDetail = await getStorefrontProductBySlug(`draft-${suffix}`);
    assert.equal(draftDetail, null, 'DRAFT product detail must not be reachable publicly');
  } finally {
    await client.end();
  }
});
```

- [ ] **Step 2: Run**

Run: `DATABASE_URL=<...> npx tsx --test tests/phase-4-storefront-catalog.test.ts`
Expected: PASS. If `'costPrice' in active!` fails because the row shape includes an `undefined`-valued key rather than omitting it entirely, fix `listStorefrontProducts`'s `select` list in Task 7/11 to never name `cost_price` at all (the current implementation already never selects it — this assertion is a regression guard, not expected to need a code change).

- [ ] **Step 3: Commit**

```bash
git add tests/phase-4-storefront-catalog.test.ts
git commit -m "test: verify public catalog never exposes cost_price or exact stock counts"
```

---

## Task 16: E2E — custom-print submission smoke test

**Files:**
- Create: `e2e/storefront.spec.ts`

**Interfaces:**
- Consumes: the running app under `playwright.config.ts`'s `webServer` (port 3412), the real `/custom-print` page and form (Task 13).

- [ ] **Step 1: Write the test**

```ts
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import nextEnv from '@next/env';
import { Client } from 'pg';

nextEnv.loadEnvConfig(process.cwd());

test('a visitor can load /custom-print, fill the form, and submit successfully', async ({ page }) => {
  const phone = `09${randomUUID().replace(/\D/g, '').slice(0, 8)}`;

  await page.goto('/custom-print');
  await expect(page.getByRole('heading', { name: 'Đặt in 3D theo yêu cầu' })).toBeVisible();

  await page.locator('#customerName').fill('Playwright E2E Visitor');
  await page.locator('#customerPhone').fill(phone);
  await page.locator('#quantity').fill('2');
  await page.locator('#description').fill('E2E smoke test submission — vui lòng bỏ qua.');
  await page.getByRole('button', { name: 'Gửi yêu cầu đặt in' }).click();

  await expect(page.getByText('Đã gửi yêu cầu thành công!')).toBeVisible();

  if (process.env.DATABASE_URL) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const row = await client.query('select source_channel from custom_requests where customer_phone = $1', [phone]);
      expect(row.rowCount).toBe(1);
      expect(row.rows[0].source_channel).toBe('WEBSITE');
    } finally {
      await client.end();
    }
  }
});
```

- [ ] **Step 2: Run the full Playwright suite (existing + new)**

Run: `npx playwright test`
Expected: `e2e/admin.spec.ts` (both existing tests) and the new `e2e/storefront.spec.ts` test all PASS — this is the regression check that the root layout/token/font retrofit (Tasks 2–3) didn't break the admin login/product/inventory flows.

- [ ] **Step 3: Commit**

```bash
git add e2e/storefront.spec.ts
git commit -m "test: add E2E smoke test for public custom print submission"
```

---

## Task 17: Full verification pass + pre-delivery checklist

**Files:** none (verification only).

- [ ] **Step 1: Run every automated gate**

```bash
npm run lint
npm run typecheck
npm run build
npm test
npx playwright test
```

All must be clean, including every pre-existing `tests/phase-3-*.test.ts` file (unchanged behavior, per Definition of Done) and `e2e/admin.spec.ts`.

- [ ] **Step 2: Manually verify phase-4.md's Pre-delivery checklist**

Start `npm run dev` and manually check, on `/`, `/products`, `/products/[slug]`, and `/custom-print`, in both light and dark mode:
- No emoji used as icons anywhere (only `lucide-react` SVGs).
- Every clickable element has `cursor-pointer` (buttons, links, the theme toggle, form submit).
- Hover states transition smoothly within 150–300ms (`transition-*` classes already applied throughout Tasks 8–13).
- Text contrast ≥ 4.5:1 in both themes — spot-check body text on card backgrounds and button labels against MASTER.md's documented ratios.
- Keyboard focus is visible when tabbing through nav links, buttons, and form fields (the shared `focus-visible:ring-2 focus-visible:ring-ring` pattern used throughout).
- `prefers-reduced-motion: reduce` (toggle via browser devtools rendering emulation) removes hover-scale/translate transitions — verify via the `@media (prefers-reduced-motion: reduce)` block added in Task 2 and the `motion-reduce:` utility variants used in Tasks 8/9.
- Responsive layout holds at 375px, 768px, 1024px, and 1440px viewport widths (resize devtools) — check the header's mobile drawer breakpoint (`md:`), the product grid's column counts, and the custom-print material table's horizontal scroll on narrow viewports.

- [ ] **Step 3: Report**

Write up the final report using the exact 5-section format from `AGENTS.md`/the handoff prompt (Files changed / Behavior / Tests+checks run / Known risks / Follow-up work). Explicitly call out as **known risks/follow-up**:
- The `audit_logs.actor_id` nullable reversal (Task 1) — a schema decision made to resolve a genuine conflict between `phase-4.md` and the actual Phase 3 schema; flag it for Gemini/Claude review specifically.
- The product listing page's filter UI is a flat `<form>`, not yet a collapsible sidebar/drawer (Task 11) — same data contract, deferred visual polish.
- Related products on the detail page are deferred (Task 12).
- Material/price-range filters on `/products` are deferred pending a real materials/price-range column on `products`/`product_variants` (Task 11) — today's filters are limited to what the schema actually supports (category, product type, search, sort).

Do **not** move `docs/exec-plans/active/phase-4.md` to `completed/` — that happens after human/Claude/Gemini review, per the handoff instructions.

- [ ] **Step 4: No commit for this task** (verification only — nothing to stage).
