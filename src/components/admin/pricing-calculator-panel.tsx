'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  computePricingBreakdown,
  resolveMaterialUnitCostVndPerGram,
  type PricingBreakdown,
} from '@/services/pricing.service';

export type PricingMaterialOption = {
  id: string;
  name: string;
  unit: string;
  costPerSpool: number | null;
  spoolWeightGrams: number | null;
  currentUnitCost: number | null;
};

export type PricingConfigOption = {
  id: string;
  electricityVndPerKwh: number;
  machinePriceVnd: number;
  machineLifetimeHours: number;
  printerPowerKw: number;
  laborVndPerHour: number;
  failureBufferPct: number;
  marginPct: number;
  packagingFeeVnd: number;
};

type MaterialRow = { key: string; materialId: string; label: string; gram: string };

let rowKeyCounter = 0;
function nextRowKey(): string {
  rowKeyCounter += 1;
  return `row-${rowKeyCounter}`;
}

function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

/**
 * Phase 9 pricing engine UI. Computes the breakdown entirely client-side (pricing.service is a
 * pure function, no DB access) from materials/config already resolved server-side and passed in
 * as props — no network round-trip needed for the live preview, only for parsing an uploaded .3mf.
 *
 * On "Áp dụng", writes finalPriceVnd into the sibling price input(s) identified by `priceInputIds`
 * (plain DOM lookup — those inputs are rendered by the parent server page, not by this component,
 * but share the same <form>) and renders hidden `pricingBreakdown`/`pricingConfigId` inputs inside
 * itself so the enclosing form submits the full snapshot alongside the manually-editable price.
 */
export function PricingCalculatorPanel({
  materials,
  config,
  priceInputIds,
  breakdownFieldName = 'pricingBreakdown',
  configIdFieldName = 'pricingConfigId',
}: {
  materials: PricingMaterialOption[];
  config: PricingConfigOption | null;
  priceInputIds: string[];
  breakdownFieldName?: string;
  configIdFieldName?: string;
}) {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [printMinutes, setPrintMinutes] = useState('');
  const [laborMinutes, setLaborMinutes] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [appliedBreakdown, setAppliedBreakdown] = useState<PricingBreakdown | null>(null);

  const breakdown = useMemo<PricingBreakdown | null>(() => {
    if (!config) return null;
    const printMin = Number(printMinutes);
    const laborMin = Number(laborMinutes);
    if (!Number.isFinite(printMin) || !Number.isFinite(laborMin)) return null;
    const materialLines = rows
      .filter((row) => row.materialId && Number(row.gram) > 0)
      .map((row) => {
        const material = materials.find((m) => m.id === row.materialId);
        const unitCost = material ? resolveMaterialUnitCostVndPerGram(material) : 0;
        return { label: row.label || material?.name, gram: Number(row.gram), unitCostVndPerGram: unitCost };
      });
    if (!materialLines.length && printMin === 0 && laborMin === 0) return null;
    return computePricingBreakdown({
      materials: materialLines,
      printMinutes: printMin,
      laborMinutes: laborMin,
      config,
    });
  }, [rows, printMinutes, laborMinutes, materials, config]);

  function addRow(prefill?: { label: string; gram: number }) {
    setRows((prev) => [...prev, { key: nextRowKey(), materialId: '', label: prefill?.label ?? '', gram: prefill ? String(prefill.gram) : '' }]);
  }

  function updateRow(key: string, patch: Partial<MaterialRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/admin/pricing/parse-3mf', { method: 'POST', body: formData });
      const body = await response.json();
      if (!response.ok) {
        setParseError(body.message ?? 'Không đọc được file .3mf.');
        return;
      }
      const data = body.data as { plateCount: number; totalPrintMinutes: number; filaments: { color: string | null; type: string | null; totalGrams: number }[] };
      setPrintMinutes(String(data.totalPrintMinutes));
      setLaborMinutes(String(data.plateCount * 15));
      setRows(data.filaments.map((filament) => ({
        key: nextRowKey(), materialId: '', gram: String(Math.round(filament.totalGrams * 100) / 100),
        label: [filament.color, filament.type].filter(Boolean).join(' '),
      })));
    } catch {
      setParseError('Không thể kết nối tới máy chủ để đọc file .3mf.');
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  }

  function applyToForm() {
    if (!breakdown || !config) return;
    setAppliedBreakdown(breakdown);
    for (const id of priceInputIds) {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement) el.value = String(breakdown.finalPriceVnd);
    }
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Chưa có cấu hình giá (điện/nhân công/máy/margin) — vào{' '}
        <a href="/admin/settings/pricing" className="font-medium text-primary hover:underline">Cài đặt giá</a>{' '}
        để tạo trước khi dùng công cụ tính giá đề xuất.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Công cụ tính giá đề xuất</p>
        <label className="cursor-pointer text-xs text-muted-foreground file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90">
          {isParsing ? 'Đang đọc file…' : 'Tải file .3mf'}
          <input type="file" accept=".3mf" className="hidden" onChange={handleFileChange} disabled={isParsing} />
        </label>
      </div>
      {parseError ? <p className="text-xs text-destructive">{parseError}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-print-minutes">Thời gian in (phút, tổng các plate)</Label>
          <Input id="pricing-print-minutes" type="number" min={0} value={printMinutes} onChange={(e) => setPrintMinutes(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pricing-labor-minutes">Thời gian thao tác (phút — setup + đổi plate + hậu kỳ + đóng gói)</Label>
          <Input id="pricing-labor-minutes" type="number" min={0} value={laborMinutes} onChange={(e) => setLaborMinutes(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Vật liệu tiêu thụ (mỗi màu 1 dòng — đã gồm hao phí/purge/support)</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => addRow()}>+ Thêm dòng</Button>
        </div>
        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-center gap-2">
            <select
              value={row.materialId}
              onChange={(e) => updateRow(row.key, { materialId: e.target.value })}
              className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">— Chọn vật liệu {row.label ? `(${row.label})` : ''} —</option>
              {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
            </select>
            <Input
              type="number" min={0} step="0.01" value={row.gram} placeholder="Gram"
              onChange={(e) => updateRow(row.key, { gram: e.target.value })}
              className="w-28"
            />
            <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(row.key)}>Xoá</Button>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-xs text-muted-foreground">Chưa có dòng vật liệu nào — tải file .3mf hoặc thêm tay.</p> : null}
      </div>

      {breakdown ? (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3 text-sm">
          {breakdown.materialLines.map((line, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>Vật liệu {line.label ? `(${line.label})` : ''} — {line.gram}g</span><span>{formatVnd(line.costVnd)}</span>
            </div>
          ))}
          <div className="flex justify-between text-muted-foreground"><span>Điện</span><span>{formatVnd(breakdown.electricityCostVnd)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Khấu hao máy</span><span>{formatVnd(breakdown.machineDepreciationVnd)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Dự phòng lỗi in</span><span>{formatVnd(breakdown.failureBufferVnd)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Nhân công</span><span>{formatVnd(breakdown.laborCostVnd)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Đóng gói</span><span>{formatVnd(breakdown.packagingFeeVnd)}</span></div>
          <div className="flex justify-between border-t border-border pt-1 font-medium"><span>Tổng chi phí</span><span>{formatVnd(breakdown.totalCostVnd)}</span></div>
          <div className="flex justify-between text-lg font-semibold text-primary"><span>Giá đề xuất</span><span>{formatVnd(breakdown.finalPriceVnd)}</span></div>
          <Button type="button" size="sm" className="mt-2" onClick={applyToForm}>Dùng giá này</Button>
          {appliedBreakdown ? <p className="text-xs text-muted-foreground">Đã điền {formatVnd(appliedBreakdown.finalPriceVnd)} vào form — vẫn có thể sửa tay trước khi lưu.</p> : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nhập thời gian in + ít nhất 1 dòng vật liệu để xem giá đề xuất.</p>
      )}

      {appliedBreakdown ? (
        <>
          <input type="hidden" name={breakdownFieldName} value={JSON.stringify(appliedBreakdown)} />
          <input type="hidden" name={configIdFieldName} value={config.id} />
        </>
      ) : null}
    </div>
  );
}
