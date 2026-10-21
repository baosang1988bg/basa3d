import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RevenueOrdersChart } from '@/components/admin/dashboard/revenue-orders-chart';
import { ProductionPipelineCard } from '@/components/admin/dashboard/production-pipeline';
import { MaterialHealthCard } from '@/components/admin/dashboard/material-health-card';
import { RecentActionableCard } from '@/components/admin/dashboard/recent-actionable-card';
import { DashboardTabs } from '@/components/admin/dashboard/dashboard-tabs';
import { ExecutiveKpiCard } from '@/components/admin/dashboard/executive-kpi-card';
import { ExecutiveRevenueChart } from '@/components/admin/dashboard/executive-revenue-chart';
import { CategoryRevenueCard } from '@/components/admin/dashboard/category-revenue-card';
import { FilamentThresholdCard } from '@/components/admin/dashboard/filament-threshold-card';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { buildExecutiveDemoMetrics, DEMO_SCENARIO_LABELS, DEMO_SCENARIOS, resolveDemoScenario, type DemoScenario } from '@/lib/executive-demo-data';
import { formatVndCompact, resolveDashboardTab } from '@/lib/executive-metrics';
import { getExecutiveBusinessMetrics, getFinancialMetrics, getOperationalMetrics } from '@/services/dashboard.service';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground whitespace-nowrap truncate" title={label}>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent><p className="text-2xl font-semibold">{value}</p></CardContent>
    </Card>
  );
}

const kg = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

// Dev-only banner: makes it impossible to mistake demo numbers for real ones.
function DemoBanner({ scenario }: { scenario: DemoScenario }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
      <p><span className="font-semibold">DỮ LIỆU GIẢ</span> — kịch bản “{DEMO_SCENARIO_LABELS[scenario]}”. Chỉ có ở <code>npm run dev</code>, không đọc database.</p>
      <div className="flex flex-wrap gap-2">
        {DEMO_SCENARIOS.map((option) => (
          <Link key={option} href={`/admin/dashboard?tab=business&demo=${option}`} aria-current={option === scenario ? 'page' : undefined} className={option === scenario ? 'font-semibold underline' : 'underline-offset-2 hover:underline'}>
            {DEMO_SCENARIO_LABELS[option]}
          </Link>
        ))}
        <Link href="/admin/dashboard?tab=business" className="underline-offset-2 hover:underline">Thoát demo</Link>
      </div>
    </div>
  );
}

async function BusinessTab({ demo }: { demo: DemoScenario | null }) {
  const metrics = demo ? buildExecutiveDemoMetrics(demo) : await getExecutiveBusinessMetrics();
  return (
    <>
      {demo ? <DemoBanner scenario={demo} /> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ExecutiveKpiCard label="Doanh thu đơn hàng shop" value={formatVndCompact(metrics.revenue30d.current)} pctChange={metrics.revenue30d.pctChange} hint="30 ngày gần nhất, không gồm đơn huỷ/hoàn tiền" />
        <ExecutiveKpiCard label="Đơn hàng" value={String(metrics.orders30d.current)} pctChange={metrics.orders30d.pctChange} />
        <ExecutiveKpiCard label="Giá trị TB / đơn" value={formatVndCompact(metrics.aov30d.current)} pctChange={metrics.aov30d.pctChange} />
        <ExecutiveKpiCard label="Nhựa đã dùng" value={`${kg.format(metrics.filamentUsedGrams30d.current / 1000)} kg`} pctChange={metrics.filamentUsedGrams30d.pctChange} hint="Theo sổ kho, gồm cả job lỗi/in lại" />
      </div>

      <Card>
        <CardHeader><CardTitle>Doanh thu theo ngày (30 ngày)</CardTitle></CardHeader>
        <CardContent><ExecutiveRevenueChart points={metrics.dailyTrends30d} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Doanh thu hàng hoá theo danh mục</CardTitle></CardHeader>
          <CardContent><CategoryRevenueCard rows={metrics.categoryRevenue} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tồn kho nhựa in</CardTitle></CardHeader>
          <CardContent><FilamentThresholdCard rows={metrics.filamentStock} /></CardContent>
        </Card>
      </div>
    </>
  );
}

// Unchanged operations view (Phase 11/28). OWNER keeps "Doanh thu hôm nay" + the 14-day revenue
// bars here (Phase 41 decision D5); STAFF never reaches getFinancialMetrics().
async function OperationsTab({ isOwner }: { isOwner: boolean }) {
  const [operational, financial] = await Promise.all([
    getOperationalMetrics(),
    isOwner ? getFinancialMetrics() : Promise.resolve(null),
  ]);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Đơn hàng hôm nay" value={operational.ordersToday} />
        <StatCard label="Đơn chờ xử lý" value={operational.pendingOrders} />
        <StatCard label="Yêu cầu đang mở" value={operational.customRequestsOpen} />
        <StatCard label="Việc in đang chạy" value={operational.printJobsActive} />
        <StatCard label="Sắp hết hàng" value={operational.lowStockCount} />
        {financial ? <StatCard label="Doanh thu hôm nay" value={`${financial.revenueToday.toLocaleString('vi-VN')}đ`} /> : null}
      </div>
      {!isOwner ? (
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
    </>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ tab?: string | string[]; demo?: string | string[] }> }) {
  const { role } = await requireAdmin();
  const params = await searchParams;
  // ADR-0011 boundary #2 / ADR-0044 §6: STAFF always resolves to 'operations', whatever ?tab= says.
  const tab = resolveDashboardTab(role, params?.tab);
  // `next dev` + OWNER only; null everywhere else (Preview/Production run with NODE_ENV=production).
  const demo = resolveDemoScenario(params?.demo, { nodeEnv: process.env.NODE_ENV, role });
  const isOwner = role === 'OWNER';
  const today = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })} · Vai trò: {role}
          </p>
        </div>
        {isOwner ? <DashboardTabs active={tab} /> : null}
      </div>

      {isOwner && tab === 'business' ? await BusinessTab({ demo }) : await OperationsTab({ isOwner })}
    </div>
  );
}
