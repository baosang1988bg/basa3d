import type { CategoryRevenueRow } from '@/services/dashboard.service';
import { formatVndCompact } from '@/lib/executive-metrics';

// Phase 41 — OWNER-only. Horizontal bars with plain Tailwind (Rule #8). Revenue here is merchandise
// (`order_items.line_total`, before order discount and fees — ADR-0044 §2), so the share is computed
// over the category total, never over the KPI revenue card.
export function CategoryRevenueCard({ rows }: { rows: CategoryRevenueRow[] }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Chưa có đơn hàng shop trong 30 ngày qua.</p>;
  }
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const max = Math.max(1, ...rows.map((row) => row.revenue));

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const share = total > 0 ? Math.round((row.revenue / total) * 100) : 0;
          return (
            <li key={row.categoryId ?? 'uncategorized'} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium" title={row.categoryName}>{row.categoryName}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatVndCompact(row.revenue)} · {row.orderCount} đơn · {share}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-blue-500 dark:bg-blue-400" style={{ width: `${(row.revenue / max) * 100}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Giá trị hàng hoá trước giảm giá, chưa gồm phí ship/COD/VAT — nên tổng không bằng thẻ Doanh thu. Một đơn có nhiều danh mục được đếm ở mỗi danh mục.
      </p>
    </div>
  );
}
