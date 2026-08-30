import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getFinancialMetrics, getOperationalMetrics } from '@/services/dashboard.service';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><p className="text-2xl font-semibold">{value}</p></CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const { role } = await requireAdmin();
  const operational = await getOperationalMetrics();
  const financial = role === 'OWNER' ? await getFinancialMetrics() : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Đơn hàng hôm nay" value={operational.ordersToday} />
        <StatCard label="Đơn đang chờ xử lý" value={operational.pendingOrders} />
        <StatCard label="Sắp hết hàng" value={operational.lowStockCount} />
        <StatCard label="Custom request đang mở" value={operational.customRequestsOpen} />
        <StatCard label="Việc in đang chờ/đang chạy" value={operational.printJobsActive} />
        {financial ? <StatCard label="Doanh thu hôm nay" value={`${financial.revenueToday.toLocaleString('vi-VN')}đ`} /> : null}
      </div>
      {role !== 'OWNER' ? (
        <p className="text-sm text-muted-foreground">Số liệu doanh thu/lợi nhuận chỉ hiển thị cho OWNER.</p>
      ) : null}
    </div>
  );
}
