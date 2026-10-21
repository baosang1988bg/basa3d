'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpen, Boxes, Calculator, ChevronDown, FileEdit, LayoutDashboard, Layers, Package, Printer,
  Receipt, ShieldAlert, ShoppingBag, Users,
  Tags, Loader2, Warehouse, FileBox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/auth/require-admin';
import { BUILD_INFO, CHANNEL_LABELS, SHORT_COMMIT } from '@/config/build-info';

export interface AdminNavBadges {
  pendingOrders?: number;
  customRequestsOpen?: number;
  printJobsActive?: number;
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
      { href: '/admin/product-inventory', label: 'Kho sản phẩm', icon: Warehouse },
      { href: '/admin/stl-import', label: 'Kho nhập STL', icon: FileBox },
      { href: '/admin/inventory', label: 'Tồn kho', icon: Boxes },
      { href: '/admin/materials', label: 'Kho nhựa', icon: Layers },
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
    ],
  },
];

const STORAGE_KEY = 'basa3d_admin_nav_expanded';

export function AdminNav({ role, badges = {} }: { role: StaffRole; badges?: AdminNavBadges }) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);

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
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col justify-between overflow-y-auto border-r border-border bg-muted/40 p-4">
      <div className="flex flex-col gap-1">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">BaSa3D Admin</p>
          {navigatingHref && <Loader2 className="size-3.5 animate-spin text-primary" />}
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
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const isNavigatingToThis = navigatingHref === item.href;
                    const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => handleItemClick(item.href)}
                        className={`flex items-center gap-2.5 rounded-md border-l-2 px-2 py-1.5 text-sm transition-colors ${
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
  );
}
