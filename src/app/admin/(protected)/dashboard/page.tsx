import Link from 'next/link';
import { AlertTriangle, ClipboardList, Coins, Layers, MessageSquareText, PackageOpen, Printer, Receipt, ShoppingBag, Wallet } from 'lucide-react';
import { RevenueOrdersChart } from '@/components/admin/dashboard/revenue-orders-chart';
import { ProductionPipelineCard } from '@/components/admin/dashboard/production-pipeline';
import { MaterialHealthCard } from '@/components/admin/dashboard/material-health-card';
import { DashboardTabs } from '@/components/admin/dashboard/dashboard-tabs';
import { ExecutiveRevenueChart } from '@/components/admin/dashboard/executive-revenue-chart';
import { ActivityFeed } from '@/components/admin/dashboard/activity-feed';
import { LiveStatus } from '@/components/admin/dashboard/live-status';
import { AlertStrip, CardLink, DashCard, DonutChart, KpiTile, StatStrip } from '@/components/admin/dashboard/dash-ui';
import { requireAdmin } from '@/lib/auth/require-admin';
import { buildExecutiveDemoMetrics, DEMO_SCENARIO_LABELS, DEMO_SCENARIOS, resolveDemoScenario, type DemoScenario } from '@/lib/executive-demo-data';
import { FILAMENT_LOW_STOCK_PCT, formatVndCompact, resolveDashboardTab } from '@/lib/executive-metrics';
import { getExecutiveBusinessMetrics, getFinancialMetrics, getOperationalMetrics } from '@/services/dashboard.service';

// UX refresh 2026-10-27 (OWNER: "UI cứng quá", reference: realtime-dashboard.html "Pulse"): live status
// + refresh in the header, KPI tiles with sparklines, a stat strip above each chart, a share donut and
// one "việc cần xử lý" feed. Data access and the OWNER/STAFF split are unchanged (ADR-0011 boundary #2:
// STAFF never reaches getFinancialMetrics / getExecutiveBusinessMetrics, and no money prop is passed).

const kg = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const ROLE_LABEL: Record<string, string> = { OWNER: 'Chủ xưởng', STAFF: 'Nhân viên' };

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
  const days = metrics.dailyTrends30d;
  const revenueSeries = days.map((day) => day.revenue);
  const orderSeries = days.map((day) => day.orderCount);
  const aovSeries = days.map((day) => (day.orderCount > 0 ? Math.round(day.revenue / day.orderCount) : 0));
  const total = revenueSeries.reduce((sum, value) => sum + value, 0);
  const best = days.reduce<(typeof days)[number] | null>((top, day) => (!top || day.revenue > top.revenue ? day : top), null);
  const weekend = days.filter((day) => day.isWeekend).reduce((sum, day) => sum + day.revenue, 0);
  const merchandise = metrics.categoryRevenue.reduce((sum, row) => sum + row.revenue, 0);
  const lowFilament = metrics.filamentStock.filter((row) => row.isLow).length;

  return (
    <>
      {demo ? <DemoBanner scenario={demo} /> : null}
      <section aria-label="Chỉ số chính" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Doanh thu đơn hàng shop" value={formatVndCompact(metrics.revenue30d.current)} pct={metrics.revenue30d.pctChange} trend={revenueSeries} icon={<Wallet />} hint="30 ngày, không gồm đơn huỷ/hoàn tiền" />
        <KpiTile label="Đơn hàng" value={String(metrics.orders30d.current)} pct={metrics.orders30d.pctChange} trend={orderSeries} icon={<Receipt />} />
        <KpiTile label="Giá trị TB / đơn" value={formatVndCompact(metrics.aov30d.current)} pct={metrics.aov30d.pctChange} trend={aovSeries} icon={<Coins />} />
        <KpiTile label="Nhựa đã dùng" value={`${kg.format(metrics.filamentUsedGrams30d.current / 1000)} kg`} pct={metrics.filamentUsedGrams30d.pctChange} icon={<Layers />} hint="Theo sổ kho, gồm cả job lỗi/in lại" />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard className="lg:col-span-2" title="Doanh thu theo ngày" subtitle="30 ngày gần nhất · cột đậm là thứ 7 / chủ nhật">
          <div className="flex flex-col gap-4">
            <StatStrip items={[
              { label: 'Hôm nay', value: formatVndCompact(days[days.length - 1]?.revenue ?? 0) },
              { label: 'Ngày cao nhất', value: best && best.revenue > 0 ? `${formatVndCompact(best.revenue)} · ${best.dayLabel}` : '—' },
              { label: 'Trung bình / ngày', value: formatVndCompact(days.length ? Math.round(total / days.length) : 0) },
              { label: 'Cuối tuần chiếm', value: total > 0 ? `${Math.round((weekend / total) * 100)}%` : '—' },
            ]} />
            <ExecutiveRevenueChart points={days} />
          </div>
        </DashCard>

        <DashCard title="Doanh thu theo danh mục" subtitle="Giá trị hàng hoá trước giảm giá, chưa gồm ship/COD/VAT">
          <DonutChart
            slices={metrics.categoryRevenue.map((row) => ({ label: row.categoryName, value: row.revenue }))}
            centerLabel="Tổng hàng hoá"
            centerValue={formatVndCompact(merchandise)}
            formatValue={formatVndCompact}
            emptyText="Chưa có đơn hàng shop trong 30 ngày qua — tỉ trọng theo danh mục sẽ hiện ở đây."
          />
        </DashCard>
      </div>

      {/* Filament detail lives on /admin/materials; the dashboard only raises the alarm. */}
      {lowFilament ? (
        <AlertStrip href="/admin/materials" linkLabel="Xem kho nhựa">
          {lowFilament}/{metrics.filamentStock.length} loại nhựa đang dưới ngưỡng {FILAMENT_LOW_STOCK_PCT}% — cần đặt thêm cuộn.
        </AlertStrip>
      ) : null}
    </>
  );
}

// OWNER keeps "Doanh thu hôm nay" + the 14-day revenue bars here (Phase 41 decision D5); STAFF never
// reaches getFinancialMetrics(), so no money value or revenue series is ever passed in that branch.
async function OperationsTab({ isOwner, now }: { isOwner: boolean; now: string }) {
  const [operational, financial] = await Promise.all([
    getOperationalMetrics(),
    isOwner ? getFinancialMetrics() : Promise.resolve(null),
  ]);
  const orderSeries = operational.dailyOrderTrends.map((day) => day.orderCount);
  const orders14 = orderSeries.reduce((sum, value) => sum + value, 0);
  const busiest = operational.dailyOrderTrends.reduce<(typeof operational.dailyOrderTrends)[number] | null>((top, day) => (!top || day.orderCount > top.orderCount ? day : top), null);

  return (
    <>
      <section aria-label="Chỉ số vận hành" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Đơn hàng hôm nay" value={operational.ordersToday} icon={<ShoppingBag />} trend={orderSeries} hint="14 ngày gần nhất" />
        <KpiTile label="Đơn đang chờ xử lý" value={operational.pendingOrders} icon={<ClipboardList />} tone={operational.pendingOrders > 0 ? 'warning' : 'success'} hint={operational.pendingOrders > 0 ? 'Bấm để xử lý' : 'Không có đơn chờ'} href="/admin/orders" />
        <KpiTile label="Yêu cầu in đang mở" value={operational.customRequestsOpen} icon={<MessageSquareText />} hint="Mới, đang xem, chờ báo giá" href="/admin/custom-requests" />
        <KpiTile label="Việc in đang chạy" value={operational.printJobsActive} icon={<Printer />} hint="Chờ in, đang in, kiểm tra" href="/admin/print-jobs" />
        <KpiTile label="Hàng có sẵn sắp hết" value={operational.lowStockCount} icon={operational.lowStockCount > 0 ? <AlertTriangle /> : <PackageOpen />} tone={operational.lowStockCount > 0 ? 'danger' : 'success'} hint={operational.lowStockCount > 0 ? 'Cần in thêm' : 'Kho ổn'} href="/admin/product-inventory" />
        {financial ? (
          <KpiTile label="Doanh thu hôm nay" value={`${financial.revenueToday.toLocaleString('vi-VN')}đ`} icon={<Wallet />} trend={financial.dailyRevenueTrends.map((day) => day.revenue)} hint="14 ngày gần nhất" />
        ) : null}
      </section>
      {!isOwner ? (
        <p className="text-xs text-muted-foreground">Số liệu doanh thu/lợi nhuận chỉ hiển thị cho OWNER.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashCard className="lg:col-span-2" title={financial ? 'Doanh thu & sản lượng' : 'Sản lượng đơn'} subtitle="14 ngày gần nhất · rê chuột vào cột để xem chi tiết">
          <div className="flex flex-col gap-4">
            <StatStrip items={[
              { label: 'Hôm nay', value: `${operational.ordersToday} đơn` },
              { label: 'Tổng 14 ngày', value: `${orders14} đơn` },
              { label: 'Trung bình / ngày', value: `${kg.format(orderSeries.length ? orders14 / orderSeries.length : 0)} đơn` },
              { label: 'Ngày nhiều đơn nhất', value: busiest && busiest.orderCount > 0 ? `${busiest.orderCount} · ${busiest.dayLabel}` : '—' },
            ]} />
            <RevenueOrdersChart orderTrends={operational.dailyOrderTrends} revenueTrends={financial?.dailyRevenueTrends} />
          </div>
        </DashCard>

        <DashCard title="Cần xử lý ngay" subtitle="Đơn mới và yêu cầu in đang chờ, mới nhất trước" bodyClassName="px-0 pb-0 sm:px-0">
          <ActivityFeed items={operational.actionableItems} now={now} />
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashCard title="Phễu vận hành xưởng" subtitle="Việc in và yêu cầu in theo từng bước">
          <ProductionPipelineCard productionPipeline={operational.productionPipeline} customRequestPipeline={operational.customRequestPipeline} />
        </DashCard>
        <DashCard title="Sức khỏe kho nhựa" subtitle="Cuộn đang dùng, theo mức còn lại" action={<CardLink href="/admin/materials">Xem kho nhựa</CardLink>}>
          <MaterialHealthCard materialHealth={operational.materialHealth} />
        </DashCard>
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
  const now = new Date();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {now.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })} · {ROLE_LABEL[role] ?? role}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveStatus updatedAt={now.toISOString()} />
          {isOwner ? <DashboardTabs active={tab} /> : null}
        </div>
      </div>

      {isOwner && tab === 'business' ? await BusinessTab({ demo }) : await OperationsTab({ isOwner, now: now.toISOString() })}
    </div>
  );
}
