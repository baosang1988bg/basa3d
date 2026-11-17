'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpen, Boxes, Calculator, ChevronDown, ClipboardCheck, FileEdit, LayoutDashboard, Layers, Package, Printer,
  Receipt, ShieldAlert, ShoppingBag, Users,
  Tags, Loader2, Warehouse, FileBox, Menu, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/auth/require-admin';
import { BUILD_INFO, CHANNEL_LABELS, SHORT_COMMIT } from '@/config/build-info';

export interface AdminNavBadges {
  pendingOrders?: number;
  customRequestsOpen?: number;
  printJobsActive?: number;
  blogDrafts?: number;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
  badgeKey?: keyof AdminNavBadges;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Đơn hàng & In',
    items: [
      { href: '/admin/orders', label: 'Đơn hàng', icon: ShoppingBag, badgeKey: 'pendingOrders' },
      { href: '/admin/custom-requests', label: 'Custom request', icon: FileEdit, badgeKey: 'customRequestsOpen' },
      { href: '/admin/print-jobs', label: 'Việc in', icon: Printer, badgeKey: 'printJobsActive' },
    ],
  },
  {
    title: 'Sản phẩm & Nhựa',
    items: [
      { href: '/admin/products', label: 'Sản phẩm', icon: Package },
      { href: '/admin/product-inventory', label: 'Kho & giá', icon: Warehouse },
      { href: '/admin/stl-import', label: 'Duyệt mẫu STL', icon: FileBox },
      { href: '/admin/inventory', label: 'Lịch sử kho', icon: Boxes },
      { href: '/admin/materials', label: 'Nhựa in', icon: Layers },
    ],
  },
  {
    title: 'Làm giá',
    items: [
      { href: '/admin/settings/pricing', label: 'Cấu hình giá', icon: Calculator, ownerOnly: true },
      { href: '/admin/settings/makerworld-prices', label: 'Giá MakerWorld', icon: Tags, ownerOnly: true },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { href: '/admin/staff', label: 'Nhân viên', icon: Users, ownerOnly: true },
      { href: '/admin/expenses', label: 'Chi tiêu', icon: Receipt, ownerOnly: true },
      { href: '/admin/audit-logs', label: 'Nhật ký hệ thống', icon: ShieldAlert, ownerOnly: true },
      { href: '/admin/blog', label: 'Blog', icon: BookOpen },
      { href: '/admin/blog/review', label: 'Duyệt bài', icon: ClipboardCheck, badgeKey: 'blogDrafts' },
    ],
  },
];

const STORAGE_KEY = 'basa3d_admin_nav_expanded';

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
const ALL_HREFS = ALL_ITEMS.map((item) => item.href);

/** Longest matching href wins, so /admin/blog/review highlights "Duyệt bài", not "Blog" too. */
function resolveActiveHref(pathname: string): string | undefined {
  return ALL_HREFS
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export function AdminNav({ role, badges = {} }: { role: StaffRole; badges?: AdminNavBadges }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname);
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);
  // Phase 55 (D1): below `md` the same <nav> is an off-canvas drawer opened from the top bar.
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = ALL_ITEMS.find((item) => item.href === activeHref)?.label;
  const totalBadge = ALL_ITEMS.reduce((sum, item) => sum + (item.badgeKey && (!item.ownerOnly || role === 'OWNER') ? badges[item.badgeKey] ?? 0 : 0), 0);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  // Default: 'Đơn hàng & In' is expanded, others collapsed.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Đơn hàng & In': true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          setOpenSections((prev) => ({
            ...prev,
            ...parsed,
            'Đơn hàng & In': parsed['Đơn hàng & In'] ?? true,
          }));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    setNavigatingHref(null);
    setMobileOpen(false);

    // Auto-expand section if current route is within it
    for (const section of NAV_SECTIONS) {
      if (
        section.title &&
        section.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      ) {
        setOpenSections((prev) => {
          if (prev[section.title!]) return prev;
          const updated = { ...prev, [section.title!]: true };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        });
        break;
      }
    }
  }, [pathname]);

  function toggleSection(title: string) {
    setOpenSections((prev) => {
      const updated = {
        ...prev,
        [title]: !prev[title],
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  function handleItemClick(href: string) {
    if (pathname !== href) {
      setNavigatingHref(href);
    }
  }

  return (
    <>
    <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-background px-2 md:hidden">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Mở menu"
        aria-expanded={mobileOpen}
        aria-controls="admin-nav"
        className="relative flex size-10 items-center justify-center rounded-md hover:bg-accent"
      >
        <Menu className="size-5" />
        {totalBadge > 0 ? <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive" /> : null}
      </button>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{activeLabel ?? 'BaSa3D Admin'}</p>
      {navigatingHref && <Loader2 className="mr-2 size-4 animate-spin text-primary" />}
    </div>
    {mobileOpen ? (
      <button type="button" aria-label="Đóng menu" tabIndex={-1} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/40 md:hidden" />
    ) : null}
    <nav
      id="admin-nav"
      className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col justify-between overflow-y-auto border-r border-border bg-background p-4 transition-transform duration-200 md:visible md:sticky md:bottom-auto md:top-0 md:z-auto md:h-screen md:w-56 md:shrink-0 md:translate-x-0 md:bg-muted/40 md:transition-none ${
        mobileOpen ? 'translate-x-0' : 'invisible -translate-x-full'
      }`}
    >
      <div className="flex flex-col gap-1">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">BaSa3D Admin</p>
          {navigatingHref && <Loader2 className="hidden size-3.5 animate-spin text-primary md:block" />}
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Đóng menu" className="flex size-9 items-center justify-center rounded-md hover:bg-accent md:hidden">
            <X className="size-4" />
          </button>
        </div>
        {NAV_SECTIONS.map((section, sectionIdx) => {
          const visibleItems = section.items.filter((item) => !item.ownerOnly || role === 'OWNER');
          if (visibleItems.length === 0) return null;

          const isOpen = section.title ? Boolean(openSections[section.title]) : true;
          const sectionTotalBadge = visibleItems.reduce((acc, item) => {
            if (!item.badgeKey) return acc;
            return acc + (badges[item.badgeKey] ?? 0);
          }, 0);

          return (
            <div key={section.title ?? `section-${sectionIdx}`} className="flex flex-col gap-0.5">
              {section.title && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title!)}
                  className="mt-2.5 mb-1 flex w-full items-center justify-between rounded px-2 py-1 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                  aria-expanded={isOpen}
                >
                  <span className="truncate">{section.title}</span>
                  <div className="flex items-center gap-1.5">
                    {!isOpen && sectionTotalBadge > 0 && (
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive text-[9px] font-semibold text-white">
                        {sectionTotalBadge > 99 ? '99+' : sectionTotalBadge}
                      </span>
                    )}
                    <ChevronDown
                      className={`size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 ${
                        isOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  </div>
                </button>
              )}
              {isOpen && (
                <div className="flex flex-col gap-0.5">
                  {visibleItems.map((item) => {
                    const isActive = item.href === activeHref;
                    const isNavigatingToThis = navigatingHref === item.href;
                    const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => handleItemClick(item.href)}
                        className={`flex items-center gap-2.5 rounded-md border-l-2 px-2 py-2.5 text-sm transition-colors md:py-1.5 ${
                          isActive || isNavigatingToThis
                            ? 'border-primary bg-primary/10 font-medium text-primary'
                            : 'border-transparent hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {isNavigatingToThis ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                        ) : (
                          <Icon className="size-4 shrink-0" />
                        )}
                        <span className="flex-1">{item.label}</span>
                        {badgeCount ? (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 px-2">
        <p className="text-xs text-muted-foreground">Vai trò: {role}</p>
        <Button variant="outline" size="sm" onClick={handleLogout}>Đăng xuất</Button>
        {/* Phase 44: which build staff are on — quote this line when reporting a bug. */}
        <p className="text-[11px] tabular-nums text-muted-foreground" title={BUILD_INFO.builtAt ? `Build lúc ${BUILD_INFO.builtAt}` : undefined}>
          v{BUILD_INFO.version} · {CHANNEL_LABELS[BUILD_INFO.channel]} · {SHORT_COMMIT}
        </p>
      </div>
    </nav>
    </>
  );
}
