'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { StaffRole } from '@/lib/auth/require-admin';

const NAV_ITEMS: { href: string; label: string; ownerOnly?: boolean }[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/products', label: 'Sản phẩm' },
  { href: '/admin/inventory', label: 'Tồn kho' },
  { href: '/admin/orders', label: 'Đơn hàng' },
  { href: '/admin/custom-requests', label: 'Custom request' },
  { href: '/admin/staff', label: 'Nhân viên', ownerOnly: true },
  { href: '/admin/audit-logs', label: 'Nhật ký hệ thống', ownerOnly: true },
];

export function AdminNav({ role }: { role: StaffRole }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col justify-between border-r border-border bg-muted/40 p-4">
      <div className="flex flex-col gap-1">
        <p className="mb-2 px-2 text-xs font-medium uppercase text-muted-foreground">BaSa3D Admin</p>
        {NAV_ITEMS.filter((item) => !item.ownerOnly || role === 'OWNER').map((item) => (
          <Link key={item.href} href={item.href} className="rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
            {item.label}
          </Link>
        ))}
      </div>
      <div className="flex flex-col gap-2 px-2">
        <p className="text-xs text-muted-foreground">Vai trò: {role}</p>
        <Button variant="outline" size="sm" onClick={handleLogout}>Đăng xuất</Button>
      </div>
    </nav>
  );
}
