'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  computePricingBreakdown,
  resolveMaterialUnitCostVndPerGram,
  type PricingBreakdown,
} from '@/services/pricing.service';
import {
  defaultWasteRatioPctForColorCount,
  estimateWaste,
  estimateWasteWithCustomGrams,
  WASTE_RATIO_OVERRIDE_PRESETS,
} from '@/lib/pricing/smart-waste-estimator';
import { matchAllFilaments, type AutoMatchMaterialOption } from '@/lib/pricing/material-auto-match';
import type { MakerWorldProfile } from '@/lib/parsers/makerworld-resolver';
import type { QuoteModelSnapshot } from '@/services/quote.service';

export type MakerWorldQuoteMaterialOption = AutoMatchMaterialOption & {
  costPerSpool: number | null;
  spoolWeightGrams: number | null;
  currentUnitCost: number | null;
};

export type MakerWorldPricingConfigOption = {
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

function formatVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')}đ`;
}

type FetchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; profile: MakerWorldProfile };

// Staff-facing per-filament row state — materialId defaults to the auto-matched suggestion but is
// always editable, per phase-13.md decision #3 (auto-match by materialType only, Staff confirms the
// exact color by hand — never auto-finalized into a Quote).
type FilamentRow = {
  materialId: string;
  wastePreset: 'DEFAULT' | 'LOW' | 'STANDARD' | 'HIGH' | 'CUSTOM';
  customWasteGrams: string;
};

/**
 * Phase 13 admin panel: paste a MakerWorld link -> auto-fetch profile -> smart AMS waste estimate
 * per color -> auto material-match by type (Staff confirms exact color) -> "Dùng giá này" fills the
 * same subtotal/total inputs and hidden pricingBreakdown/pricingConfigId/modelSnapshot fields that
 * PricingCalculatorPanel already writes into on the parent <form> (createQuoteAction) — this panel
 * is an alternative data-entry path into the exact same quote-creation form, not a separate flow.
 */
export function MakerWorldQuotePanel({
  materials,
  config,
  priceInputIds,
  laborMinutesInputId,
}: {
  materials: MakerWorldQuoteMaterialOption[];
  config: MakerWorldPricingConfigOption | null;
  priceInputIds: string[];
  /** Optional sibling <input id=...> for labor minutes — filled with platesCount*15 as a starting
   * estimate (same convention as the .3mf upload flow in PricingCalculatorPanel), still editable. */
  laborMinutesInputId?: string;
}) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [rows, setRows] = useState<FilamentRow[]>([]);
  const [laborMinutesOverride, setLaborMinutesOverride] = useState<string>('');
  const [appliedBreakdown, setAppliedBreakdown] = useState<PricingBreakdown | null>(null);
  const [appliedSnapshot, setAppliedSnapshot] = useState<QuoteModelSnapshot | null>(null);

  const profile = state.kind === 'ready' ? state.profile : null;
  const colorsCount = profile?.filaments.length ?? 0;

  const matches = useMemo(() => {
    if (!profile) return [];
    return matchAllFilaments(profile.filaments.map((f) => f.materialType), materials);
  }, [profile, materials]);

  async function handleFetch() {
    if (!url.trim()) return;
    setState({ kind: 'loading' });
    setAppliedBreakdown(null);
    setAppliedSnapshot(null);
    try {
      const response = await fetch('/api/admin/pricing/resolve-makerworld', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await response.json();
      if (!response.ok) {
        setState({ kind: 'error', message: body.message ?? 'Không lấy được dữ liệu từ MakerWorld.' });
        return;
      }
      const fetchedProfile = body.data as MakerWorldProfile;
      setState({ kind: 'ready', profile: fetchedProfile });
      setRows(fetchedProfile.filaments.map(() => ({ materialId: '', wastePreset: 'DEFAULT', customWasteGrams: '' })));
      setLaborMinutesOverride(String(fetchedProfile.platesCount * 15));
    } catch {
      setState({ kind: 'error', message: 'Không thể kết nối tới máy chủ để lấy dữ liệu MakerWorld.' });
    }
  }

  function updateRow(index: number, patch: Partial<FilamentRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function wasteRatioPctForRow(row: FilamentRow): number {
    if (row.wastePreset === 'DEFAULT') return defaultWasteRatioPctForColorCount(colorsCount);
    if (row.wastePreset === 'CUSTOM') return 0; // unused — custom uses grams directly, see below
    return WASTE_RATIO_OVERRIDE_PRESETS[row.wastePreset];
  }

  const materialLines = useMemo(() => {
    if (!profile) return [];
    return profile.filaments.map((filament, index) => {
      const row = rows[index];
      if (!row) return null;
      const material = materials.find((m) => m.id === row.materialId);
      const unitCost = material ? resolveMaterialUnitCostVndPerGram(material) : 0;
      const estimate = row.wastePreset === 'CUSTOM'
        ? estimateWasteWithCustomGrams(filament.netWeightGrams, Number(row.customWasteGrams) || 0)
        : estimateWaste({ netWeightGrams: filament.netWeightGrams, wasteRatioPct: wasteRatioPctForRow(row) });
      return {
        label: `${filament.name} (${filament.materialType})`,
        gram: Math.round(estimate.totalWeightGrams * 100) / 100,
        unitCostVndPerGram: unitCost,
        materialId: row.materialId,
      };
    }).filter((line): line is NonNullable<typeof line> => line !== null);
  }, [profile, rows, materials, colorsCount]);

  const breakdown = useMemo<PricingBreakdown | null>(() => {
    if (!config || !profile || !materialLines.length) return null;
    const laborMinutes = Number(laborMinutesOverride);
    if (!Number.isFinite(laborMinutes)) return null;
    return computePricingBreakdown({
      materials: materialLines.map(({ label, gram, unitCostVndPerGram }) => ({ label, gram, unitCostVndPerGram })),
      printMinutes: profile.totalPrintMinutes,
      laborMinutes,
      config,
    });
  }, [config, profile, materialLines, laborMinutesOverride]);

  function applyToForm() {
    if (!breakdown || !config || !profile) return;
    const snapshot: QuoteModelSnapshot = {
      sourceUrl: url,
      title: profile.title,
      coverImageUrl: profile.coverImageUrl,
      platesCount: profile.platesCount,
      totalPrintMinutes: profile.totalPrintMinutes,
      colorsCount,
    };
    setAppliedBreakdown(breakdown);
    setAppliedSnapshot(snapshot);
    for (const id of priceInputIds) {
      const el = document.getElementById(id);
      if (el instanceof HTMLInputElement) el.value = String(breakdown.finalPriceVnd);
    }
    if (laborMinutesInputId) {
      const el = document.getElementById(laborMinutesInputId);
      if (el instanceof HTMLInputElement) el.value = laborMinutesOverride;
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-4">
      <p className="text-sm font-semibold">Tự động lấy báo giá từ link MakerWorld</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://makerworld.com/en/models/...#profileId-..."
          className="min-w-64 flex-1"
        />
        <Button type="button" size="sm" onClick={handleFetch} disabled={state.kind === 'loading' || !url.trim()}>
          {state.kind === 'loading' ? 'Đang lấy dữ liệu…' : 'Tự động lấy dữ liệu'}
        </Button>
      </div>

      {state.kind === 'error' ? (
        <p className="text-xs text-destructive">
          {state.message} — bạn vẫn có thể nhập tay thông số bên dưới (Công cụ tính giá đề xuất) mà không cần chờ MakerWorld.
        </p>
      ) : null}

      {profile ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
            {profile.coverImageUrl ? (
              <Image src={profile.coverImageUrl} alt={profile.title} width={80} height={80} unoptimized className="size-20 rounded-md object-cover" />
            ) : null}
            <div className="text-sm">
              <p className="font-medium text-foreground">{profile.title}</p>
              <p className="text-muted-foreground">
                {profile.platesCount} plates · {Math.round((profile.totalPrintMinutes / 60) * 10) / 10} giờ in · {colorsCount} màu
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Vật liệu từng màu (đã bù hao phí AMS) — xác nhận/chọn tay màu trước khi tính giá</Label>
            {profile.filaments.map((filament, index) => {
              const row = rows[index];
              const match = matches[index];
              if (!row) return null;
              return (
                <div key={index} className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{filament.name} · {filament.materialType} · {filament.colorHex} · {filament.netWeightGrams}g (net)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={row.materialId}
                      onChange={(e) => updateRow(index, { materialId: e.target.value })}
                      className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    >
                      <option value="">
                        {match?.candidates.length ? '— Chọn màu vật liệu phù hợp —' : `— Không có vật liệu loại ${filament.materialType} đang active —`}
                      </option>
                      {match?.candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.color ? ` (${candidate.color})` : ''}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      {(['DEFAULT', 'LOW', 'STANDARD', 'HIGH', 'CUSTOM'] as const).map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          size="sm"
                          variant={row.wastePreset === preset ? 'default' : 'outline'}
                          onClick={() => updateRow(index, { wastePreset: preset })}
                        >
                          {preset === 'DEFAULT' ? `Mặc định ${defaultWasteRatioPctForColorCount(colorsCount)}%`
                            : preset === 'CUSTOM' ? 'Gram tự nhập'
                            : `${WASTE_RATIO_OVERRIDE_PRESETS[preset]}%`}
                        </Button>
                      ))}
                    </div>
                    {row.wastePreset === 'CUSTOM' ? (
                      <Input
                        type="number" min={0} step="0.1" placeholder="Gram hao phí"
                        value={row.customWasteGrams}
                        onChange={(e) => updateRow(index, { customWasteGrams: e.target.value })}
                        className="w-32"
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="makerworld-labor-minutes">Thời gian thao tác (phút — mặc định số plate × 15, có thể sửa)</Label>
            <Input
              id="makerworld-labor-minutes" type="number" min={0}
              value={laborMinutesOverride}
              onChange={(e) => setLaborMinutesOverride(e.target.value)}
              className="w-40"
            />
          </div>

          {breakdown ? (
            <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3 text-sm">
              {breakdown.materialLines.map((line, i) => (
                <div key={i} className="flex justify-between text-muted-foreground">
                  <span>{line.label} — {line.gram}g</span><span>{formatVnd(line.costVnd)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-1 font-medium"><span>Tổng chi phí</span><span>{formatVnd(breakdown.totalCostVnd)}</span></div>
              <div className="flex justify-between text-lg font-semibold text-primary"><span>Giá đề xuất</span><span>{formatVnd(breakdown.finalPriceVnd)}</span></div>
              <Button type="button" size="sm" className="mt-2" onClick={applyToForm}>Dùng giá này &amp; điền form</Button>
              {appliedBreakdown && appliedSnapshot ? (
                <p className="text-xs text-muted-foreground">Đã điền {formatVnd(appliedBreakdown.finalPriceVnd)} + thông tin mẫu &quot;{appliedSnapshot.title}&quot; vào form — vẫn có thể sửa tay trước khi lưu.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Chọn vật liệu cho ít nhất 1 màu để xem giá đề xuất.</p>
          )}
        </div>
      ) : null}

      {appliedBreakdown && appliedSnapshot ? (
        <>
          <input type="hidden" name="pricingBreakdown" value={JSON.stringify(appliedBreakdown)} />
          <input type="hidden" name="pricingConfigId" value={config?.id ?? ''} />
          <input type="hidden" name="modelSnapshot" value={JSON.stringify(appliedSnapshot)} />
        </>
      ) : null}
    </div>
  );
}
