import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireAdmin } from '@/lib/auth/require-admin';
import { DomainError } from '@/lib/domain-error';

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  try {
    const session = await requireAdmin();
    return (
      <div className="flex min-h-screen">
        <AdminNav role={session.role} />
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
