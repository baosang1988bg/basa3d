import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RevenueOrdersChart } from '@/components/admin/dashboard/revenue-orders-chart';
import { ProductionPipelineCard } from '@/components/admin/dashboard/production-pipeline';
import { MaterialHealthCard } from '@/components/admin/dashboard/material-health-card';
import { RecentActionableCard } from '@/components/admin/dashboard/recent-actionable-card';
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
  const today = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} · Vai trò: {role}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Đơn hàng hôm nay" value={operational.ordersToday} />
        <StatCard label="Đơn đang chờ xử lý" value={operational.pendingOrders} />
        <StatCard label="Custom request đang mở" value={operational.customRequestsOpen} />
        <StatCard label="Việc in đang chờ/đang chạy" value={operational.printJobsActive} />
        <StatCard label="Sắp hết hàng" value={operational.lowStockCount} />
        {financial ? <StatCard label="Doanh thu hôm nay" value={`${financial.revenueToday.toLocaleString('vi-VN')}đ`} /> : null}
      </div>
      {role !== 'OWNER' ? (
        <p className="text-sm text-muted-foreground">Số liệu doanh thu/lợi nhuận chỉ hiển thị cho OWNER.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{financial ? 'Doanh thu & sản lượng (14 ngày)' : 'Sản lượng đơn (14 ngày)'}</CardTitle></CardHeader>
          <CardContent>
            <RevenueOrdersChart orderTrends={operational.dailyOrderTrends} revenueTrends={financial?.dailyRevenueTrends} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Phễu vận hành xưởng</CardTitle></CardHeader>
          <CardContent>
            <ProductionPipelineCard productionPipeline={operational.productionPipeline} customRequestPipeline={operational.customRequestPipeline} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sức khỏe kho nhựa</CardTitle></CardHeader>
          <CardContent>
            <MaterialHealthCard materialHealth={operational.materialHealth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Cần xử lý ngay</CardTitle></CardHeader>
          <CardContent>
            <RecentActionableCard actionableItems={operational.actionableItems} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
