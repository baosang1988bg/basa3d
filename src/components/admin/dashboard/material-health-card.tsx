import type { MaterialHealthOverview } from '@/services/dashboard.service';

// Segment colors mirror filament.service.ts's warningTier() order (CON_NHIEU excluded here — the
// gauge only needs to draw attention to the watch/low/empty tiers, same 20%/50% cutoffs as the
// Materials page, see dashboard.service.ts's getMaterialHealth()).
export function MaterialHealthCard({ materialHealth }: { materialHealth: MaterialHealthOverview }) {
  const { totalSpools, totalRemainingWeightGrams, watchCount, lowStockCount, emptyCount, byMaterialType } = materialHealth;

  const gaugeTotal = Math.max(1, totalSpools);
  const gaugeSegments = [
    { label: 'Còn nhiều', value: Math.max(0, totalSpools - watchCount), color: '#10B981' },
    { label: 'Cần theo dõi', value: Math.max(0, watchCount - lowStockCount), color: '#F59E0B' },
    { label: 'Sắp hết', value: Math.max(0, lowStockCount - emptyCount), color: '#F97316' },
    { label: 'Đã hết', value: emptyCount, color: '#EF4444' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-2xl font-semibold">{totalSpools}</p>
          <p className="text-xs text-muted-foreground">cuộn nhựa đang hoạt động</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">{(totalRemainingWeightGrams / 1000).toFixed(1)}kg</p>
          <p className="text-xs text-muted-foreground">tổng khối lượng còn lại</p>
        </div>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {gaugeSegments.filter((s) => s.value > 0).map((segment) => (
          <div key={segment.label} style={{ width: `${(segment.value / gaugeTotal) * 100}%`, background: segment.color }} title={`${segment.label}: ${segment.value}`} />
        ))}
      </div>

      {lowStockCount > 0 || emptyCount > 0 ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          {emptyCount > 0 ? `${emptyCount} cuộn đã hết. ` : ''}
          {lowStockCount - emptyCount > 0 ? `${lowStockCount - emptyCount} cuộn sắp hết (≤20%), cần thay lõi sớm.` : ''}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Không có cuộn nào cần cảnh báo ngay.</p>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Theo loại vật liệu</p>
        <ul className="flex flex-col gap-1 text-xs">
          {byMaterialType.map((row) => (
            <li key={row.materialType} className="flex items-center justify-between">
              <span>{row.materialType}</span>
              <span className="text-muted-foreground">{row.count} cuộn · {row.totalWeightKg.toFixed(1)}kg</span>
            </li>
          ))}
          {!byMaterialType.length ? <li className="text-muted-foreground">Chưa có dữ liệu</li> : null}
        </ul>
      </div>
    </div>
  );
}
