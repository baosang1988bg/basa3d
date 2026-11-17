import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireAdmin } from '@/lib/auth/require-admin';
import { DomainError } from '@/lib/domain-error';
import { getAdminNavBadges } from '@/services/dashboard.service';

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  try {
    // Navigation needs only these counts, not the full dashboard analytics.
    const [session, operational] = await Promise.all([requireAdmin(), getAdminNavBadges()]);
    return (
      <div className="flex min-h-screen">
        <AdminNav
          role={session.role}
          badges={{
            pendingOrders: operational.pendingOrders,
            customRequestsOpen: operational.customRequestsOpen,
            printJobsActive: operational.printJobsActive,
            blogDrafts: operational.blogDrafts,
          }}
        />
        {/* Phase 55: pt-16 clears the fixed mobile top bar rendered by AdminNav (hidden from md up). */}
        <main className="min-w-0 flex-1 bg-background p-4 pt-16 md:p-6">{children}</main>
      </div>
    );
  } catch (error) {
    if (error instanceof DomainError && error.code === 'AUTH_REQUIRED') redirect('/basaadmin/login');
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
