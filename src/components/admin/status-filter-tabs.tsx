export interface StatusFilterGroup {
  key: string;
  label: string;
  statuses?: string[];
}

// Server-rendered filter pills driven by a `?filter=` query param — no client state, no polling,
// consistent with these list pages already being plain server components.
//
// Deliberately a plain <a>, not next/link's <Link>: in a production build (next build && next
// start — not next dev), clicking a Link that changes only the search string on the exact same
// route silently no-ops in this app (confirmed via real browser testing, Phase 11 closing review,
// 2026-09-03) — the RSC fetch for the new URL succeeds (200), but the client router never commits
// the navigation, so the URL/DOM never updates. Root cause traced to Next.js's client-side App
// Router soft-navigation, not this component's own logic — reproduced with prefetch disabled too,
// and does NOT reproduce in `next dev`, only in the production build actually used by
// `npm test`/deployment. A plain anchor forces a full page reload per filter click, trading the
// soft-navigation transition for guaranteed correctness; acceptable for an internal admin filter.
export function StatusFilterTabs({ basePath, groups, activeKey }: { basePath: string; groups: StatusFilterGroup[]; activeKey: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group) => {
        const isActive = group.key === activeKey;
        const href = group.key === 'all' ? basePath : `${basePath}?filter=${group.key}`;
        return (
          <a
            key={group.key}
            href={href}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {group.label}
          </a>
        );
      })}
    </div>
  );
}

export function resolveStatusFilter(groups: StatusFilterGroup[], filterParam: string | undefined) {
  const active = groups.find((group) => group.key === filterParam) ?? groups[0];
  return { activeKey: active.key, statuses: active.statuses };
}
