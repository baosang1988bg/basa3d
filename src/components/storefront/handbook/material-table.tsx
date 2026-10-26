'use client';

import { useState } from 'react';
import type { HandbookMaterial, MaterialTag } from '@/data/handbook/types';
import { cn } from '@/lib/utils';

// Phase 50 — client island only for the filter chips. Data arrives as props (7 rows); the initial
// render is "all", so the full table is in the server HTML for crawlers and no-JS visitors.

const range = ([min, max]: [number, number], unit: string) => (min === max ? `${min}${unit}` : `${min}–${max}${unit}`);

export function MaterialTable({
  materials,
  tagLabels,
  enclosureLabels,
}: {
  materials: HandbookMaterial[];
  tagLabels: Record<MaterialTag, string>;
  enclosureLabels: Record<HandbookMaterial['enclosure'], string>;
}) {
  const [filter, setFilter] = useState<MaterialTag | 'all'>('all');
  const rows = filter === 'all' ? materials : materials.filter((material) => material.tags.includes(filter));
  const filters: (MaterialTag | 'all')[] = ['all', ...(Object.keys(tagLabels) as MaterialTag[])];

  return (
    <div className="not-prose">
      <div role="group" aria-label="Lọc vật liệu" className="flex flex-wrap gap-2">
        {filters.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              'min-h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {key === 'all' ? 'Tất cả' : tagLabels[key]}
          </button>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">Thông số in tham khảo theo vật liệu (°C, giờ, %)</caption>
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 bg-muted px-3 py-2">Vật liệu</th>
              <th scope="col" className="px-3 py-2">Đầu phun</th>
              <th scope="col" className="px-3 py-2">Bàn in</th>
              <th scope="col" className="px-3 py-2">Sấy</th>
              <th scope="col" className="px-3 py-2">Quạt</th>
              <th scope="col" className="px-3 py-2">Buồng kín</th>
              <th scope="col" className="px-3 py-2">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((material) => (
              <tr key={material.id} className="border-t border-border align-top">
                <th scope="row" className="sticky left-0 bg-card px-3 py-2 font-semibold whitespace-nowrap">{material.name}</th>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{range(material.nozzleC, ' °C')}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{range(material.bedC, ' °C')}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{range(material.dryingC, ' °C')} · {range(material.dryingHours, ' h')}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">{range(material.fanPercent, '%')}</td>
                <td className="px-3 py-2 whitespace-nowrap">{enclosureLabels[material.enclosure]}</td>
                <td className="min-w-[16rem] px-3 py-2 text-muted-foreground">{material.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
