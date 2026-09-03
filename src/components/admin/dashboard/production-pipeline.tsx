import type { CustomRequestPipelineStats, ProductionPipelineStats } from '@/services/dashboard.service';

function SegmentedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = Math.max(1, segments.reduce((sum, s) => sum + s.value, 0));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments.filter((s) => s.value > 0).map((segment) => (
          <div key={segment.label} style={{ width: `${(segment.value / total) * 100}%`, background: segment.color }} title={`${segment.label}: ${segment.value}`} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: segment.color }} />
            {segment.label}: <span className="font-medium text-foreground">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductionPipelineCard({
  productionPipeline,
  customRequestPipeline,
}: {
  productionPipeline: ProductionPipelineStats;
  customRequestPipeline: CustomRequestPipelineStats;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium">Việc in xưởng</p>
        <SegmentedBar
          segments={[
            { label: 'Chờ in', value: productionPipeline.queued, color: '#EAB308' },
            { label: 'Đang in', value: productionPipeline.printing, color: '#3B82F6' },
            { label: 'Kiểm tra', value: productionPipeline.qc, color: '#A855F7' },
            { label: 'Hoàn tất', value: productionPipeline.completed, color: '#10B981' },
            { label: 'Thất bại', value: productionPipeline.failed, color: '#EF4444' },
          ]}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Yêu cầu tuỳ chỉnh</p>
        <SegmentedBar
          segments={[
            { label: 'Mới', value: customRequestPipeline.new, color: '#38BDF8' },
            { label: 'Xem xét', value: customRequestPipeline.reviewing, color: '#818CF8' },
            { label: 'Cần thêm TT', value: customRequestPipeline.needInfo, color: '#F59E0B' },
            { label: 'Đã báo giá', value: customRequestPipeline.quoted, color: '#A855F7' },
            { label: 'Đã duyệt', value: customRequestPipeline.approved, color: '#0EA5E9' },
            { label: 'Đã chốt đơn', value: customRequestPipeline.converted, color: '#10B981' },
          ]}
        />
      </div>
    </div>
  );
}
