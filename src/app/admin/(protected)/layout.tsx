import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireAdmin } from '@/lib/auth/require-admin';
import { DomainError } from '@/lib/domain-error';
import { getOperationalMetrics } from '@/services/dashboard.service';

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  try {
    const session = await requireAdmin();
    // requireAdmin() forces a per-request Supabase auth check, so this layout — and the badge
    // counts below — always re-run on navigation; no client-side polling needed for "live" badges.
    const operational = await getOperationalMetrics();
    return (
      <div className="flex min-h-screen">
        <AdminNav
          role={session.role}
          badges={{
            pendingOrders: operational.pendingOrders,
            customRequestsOpen: operational.customRequestsOpen,
            printJobsActive: operational.printJobsActive,
          }}
        />
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    );
  } catch (error) {
    if (error instanceof DomainError && error.code === 'AUTH_REQUIRED') redirect('/admin/login');
    if (error instanceof DomainError && error.code === 'FORBIDDEN') {
      return (
        <div className="flex min-h-screen items-center justify-center p-6 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            Tài khoản của bạn đã đăng nhập nhưng chưa được cấp quyền truy cập khu quản trị. Liên hệ
            OWNER để được cấp quyền.
          </p>
        </div>
      );
    }
    throw error;
  }
}
