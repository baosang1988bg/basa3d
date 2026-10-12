'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveMaterialUnitCostVndPerGram, type PricingBreakdown } from '@/services/pricing.service';
import { defaultWasteRatioPctForProfile, WASTE_RATIO_OVERRIDE_PRESETS } from '@/lib/pricing/smart-waste-estimator';
import {
  buildMakerWorldMaterialLines,
  defaultLaborMinutes,
  needsAmsChoice as profileNeedsAmsChoice,
  priceMakerWorldLines,
  type MakerWorldMaterialLine,
} from '@/lib/pricing/makerworld-pricing';
import { matchAllFilaments, type AutoMatchMaterialOption } from '@/lib/pricing/material-auto-match';
import { ASSEMBLY_TIERS, ASSEMBLY_TIER_KEYS, type AssemblyTier } from '@/lib/pricing/assembly-tiers';
import {
  isMakerWorldModelUrl,
  parseMakerWorldUrl,
  type MakerWorldProfileItem,
  type MakerWorldResolution,
} from '@/lib/parsers/makerworld-resolver';
import { sanitizeMakerWorldImageUrl } from '@/lib/parsers/makerworld-image';
import { parseMakerWorldSpecText } from '@/lib/parsers/makerworld-spec-text';
import { quoteModelSnapshotSchema } from '@/domain/schemas';
import type { QuoteModelSnapshot } from '@/services/quote.service';
import { ProfileVerificationCard } from '@/components/makerworld/profile-verification-card';
import { PRINT_SERVICE_POLICY } from '@/lib/copyright/print-service-policy';

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

/** Writes `value` into the parent <form>'s sibling inputs (subtotal/total/labor). '' = clear. */
function setSiblingInputs(ids: readonly string[], value: string) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el instanceof HTMLInputElement) el.value = value;
  }
}

/** Canonical source URL for the snapshot: the pasted model URL with the hash pointing at the profile
 * actually selected (staff may pick a different profile than the pasted link's #profileId). Quote
 * auto-reject (acceptQuote) scopes siblings by this exact string. */
function sourceUrlForProfile(rawUrl: string, profileId: string | null): string {
  const url = new URL(parseMakerWorldUrl(rawUrl).url.toString());
  url.search = '';
  url.hash = !profileId ? '' : /^\d+$/.test(profileId) ? `profileId-${profileId}` : profileId.toLowerCase();
  return url.toString();
}

/** Small stable non-crypto hash (FNV-1a) — only used to give manual profiles a distinct id. */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; code: string | null; message: string }
  | { kind: 'ready'; resolution: MakerWorldResolution };

/** Everything the per-profile pricing step needs, regardless of whether the numbers came from the
 * resolver or the manual Quick-Form. `key` changes => the pricing subtree remounts with clean state. */
type PricingSource = {
  key: string;
  dataSource: 'RESOLVER' | 'MANUAL';
  sourceUrl: string;
  modelTitle: string;
  modelCoverImageUrl: string | null;
  colorsCount: number;
  profile: MakerWorldProfileItem;
  license: string | null;
  licenseCommercialUse: 'NOT_ALLOWED' | 'UNKNOWN';
};

type ManualDraft = {
  profileTitle: string;
  printerTarget: string;
  hours: string;
  plates: string;
  grams: string;
  colors: string;
  materialType: string;
  ams: 'unknown' | 'yes' | 'no';
  imageUrl: string;
};

const EMPTY_MANUAL_DRAFT: ManualDraft = {
  profileTitle: '', printerTarget: '', hours: '', plates: '', grams: '', colors: '1', materialType: 'PLA', ams: 'unknown', imageUrl: '',
};

const BLOCKED_CODES = new Set(['MAKERWORLD_BLOCKED_OR_TIMEOUT', 'MAKERWORLD_PROFILE_NOT_FOUND']);

/**
 * makerworld-profile-verification Phase A admin panel:
 * paste a MakerWorld link -> resolver returns ALL print profiles -> staff picks one (no silent
 * default when the link has no #profileId) -> visual verification card -> per-profile pricing
 * (AMS-aware waste, tier ASSEMBLED/KIT) -> "✓ Đã xác nhận đúng profile" gate -> "Dùng giá này" fills
 * the parent quote form + hidden pricingBreakdown/pricingConfigId/modelSnapshot (v2).
 * When MakerWorld blocks the server (Cloudflare 403), the Quick-Form + "Dán đoạn thông số" parser
 * produce the same PricingSource with dataSource MANUAL.
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
  /** Optional sibling <input id=...> for labor minutes — filled on "Dùng giá này", cleared with it. */
  laborMinutesInputId?: string;
}) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(EMPTY_MANUAL_DRAFT);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSource, setManualSource] = useState<PricingSource | null>(null);
  const [specText, setSpecText] = useState('');
  const manualRevision = useRef(0);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => () => inflight.current?.abort(), []);

  async function handleFetch() {
    if (!url.trim()) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setState({ kind: 'loading' });
    setSelectedProfileId('');
    setManualSource(null);
    try {
      const response = await fetch('/api/admin/pricing/resolve-makerworld', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const code = typeof body.code === 'string' ? body.code : null;
        setState({ kind: 'error', code, message: body.message ?? 'Không lấy được dữ liệu từ MakerWorld.' });
        if (code && BLOCKED_CODES.has(code)) setManualOpen(true);
        return;
      }
      const resolution = body.data as MakerWorldResolution;
      setState({ kind: 'ready', resolution });
      setSelectedProfileId(resolution.activeProfileId ?? '');
      setManualOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setState({ kind: 'error', code: null, message: 'Không thể kết nối tới máy chủ để lấy dữ liệu MakerWorld.' });
    }
  }

  const resolution = state.kind === 'ready' ? state.resolution : null;
  const selectedProfile = resolution?.profiles.find((p) => p.profileId === selectedProfileId) ?? null;

  const resolverSource = useMemo<PricingSource | null>(() => {
    if (!resolution || !selectedProfile) return null;
    return {
      key: `resolver:${resolution.modelId}:${selectedProfile.profileId}`,
      dataSource: 'RESOLVER',
      sourceUrl: sourceUrlForProfile(resolution.sourceUrl, selectedProfile.profileId),
      modelTitle: resolution.modelTitle,
      modelCoverImageUrl: resolution.modelCoverImageUrl,
      colorsCount: selectedProfile.filaments.length,
      license: resolution.license,
      licenseCommercialUse: resolution.licenseCommercialUse,
      profile: selectedProfile,
    };
  }, [resolution, selectedProfile]);

  const activeSource = manualSource ?? resolverSource;

  function updateManualDraft(patch: Partial<ManualDraft>) {
    setManualDraft((prev) => ({ ...prev, ...patch }));
    // Any edit after "Dùng thông số này" invalidates the committed manual profile (unmounting the
    // pricing subtree clears an applied price from the parent form — see ProfilePricing cleanup).
    setManualSource(null);
    setManualError(null);
  }

  function applySpecText() {
    const parsed = parseMakerWorldSpecText(specText);
    updateManualDraft({
      profileTitle: parsed.profileTitle ?? manualDraft.profileTitle,
      printerTarget: parsed.printerTarget ?? manualDraft.printerTarget,
      hours: parsed.printMinutes !== null ? String(Math.round((parsed.printMinutes / 60) * 100) / 100) : manualDraft.hours,
      plates: parsed.platesCount !== null ? String(parsed.platesCount) : manualDraft.plates,
      grams: parsed.netWeightGrams !== null ? String(parsed.netWeightGrams) : manualDraft.grams,
      ams: parsed.amsRequired === null ? manualDraft.ams : parsed.amsRequired ? 'yes' : 'no',
    });
  }

  function commitManual() {
    if (!isMakerWorldModelUrl(url)) {
      setManualError('Vẫn cần dán link MakerWorld hợp lệ (https://makerworld.com/.../models/<id>) ở ô phía trên.');
      return;
    }
    const hours = Number(manualDraft.hours.replace(',', '.'));
    const plates = Number(manualDraft.plates);
    const grams = Number(manualDraft.grams.replace(',', '.'));
    const colors = Number(manualDraft.colors);
    if (!manualDraft.profileTitle.trim()) return setManualError('Nhập tên profile (vd "0.2mm layer, 2 walls, 15% infill").');
    if (!Number.isFinite(hours) || hours * 60 < 1 || hours > 333) return setManualError('Giờ in không hợp lệ (tối thiểu 1 phút).');
    if (!Number.isInteger(plates) || plates < 1 || plates > 200) return setManualError('Số plate không hợp lệ.');
    if (!Number.isFinite(grams) || grams < 1 || grams > 20_000) return setManualError('Gram nhựa không hợp lệ (tối thiểu 1g).');
    if (!Number.isInteger(colors) || colors < 1 || colors > 16) return setManualError('Số màu không hợp lệ.');
    let imageUrl: string | null = null;
    if (manualDraft.imageUrl.trim()) {
      imageUrl = sanitizeMakerWorldImageUrl(manualDraft.imageUrl);
      if (!imageUrl) return setManualError('Link ảnh chỉ chấp nhận https từ makerworld.com hoặc bambulab.com — để trống nếu không có.');
    }
    const parsedUrl = parseMakerWorldUrl(url);
    const printMinutes = Math.round(hours * 60);
    const profileTitle = manualDraft.profileTitle.trim().slice(0, 300);
    // Without a #profileId in the link, two DIFFERENT manually-typed profiles would otherwise share
    // one sourceUrl and auto-reject each other on accept — fingerprint what staff typed instead.
    const profileId = parsedUrl.profileId ?? `MANUAL-${fingerprint(`${profileTitle}|${printMinutes}|${grams}`)}`;
    manualRevision.current += 1;
    setManualSource({
      key: `manual:${manualRevision.current}`,
      dataSource: 'MANUAL',
      sourceUrl: sourceUrlForProfile(url, profileId),
      license: null,
      licenseCommercialUse: 'UNKNOWN',
      modelTitle: profileTitle,
      modelCoverImageUrl: null,
      colorsCount: colors,
      profile: {
        profileId,
        profileTitle,
        profileCoverImageUrl: imageUrl,
        printerTarget: manualDraft.printerTarget.trim().slice(0, 100) || null,
        platesCount: plates,
        printTimeMinutes: printMinutes,
        netWeightGrams: grams,
        amsRequired: manualDraft.ams === 'unknown' ? null : manualDraft.ams === 'yes',
        dataIncomplete: false,
        filaments: [{
          name: colors > 1 ? `Tổng nhựa (${colors} màu)` : 'Nhựa',
          colorHex: '',
          materialType: manualDraft.materialType.trim() || 'PLA',
          netWeightGrams: grams,
        }],
      },
    });
    setManualError(null);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/10 p-4">
      <p className="text-sm font-semibold">Tự động lấy báo giá từ link MakerWorld</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            // The resolved profiles belong to the OLD link — drop them (unmounting the pricing
            // subtree also clears any applied price) so the snapshot can never disagree with the URL.
            inflight.current?.abort();
            setState({ kind: 'idle' });
            setSelectedProfileId('');
            setManualSource(null);
          }}
          placeholder="https://makerworld.com/en/models/...#profileId-..."
          className="min-w-64 flex-1"
        />
        <Button type="button" size="sm" onClick={handleFetch} disabled={state.kind === 'loading' || !url.trim()}>
          {state.kind === 'loading' ? 'Đang lấy dữ liệu…' : 'Tự động lấy dữ liệu'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setManualOpen((open) => !open)}>
          {manualOpen ? 'Ẩn nhập tay' : 'Nhập tay thông số'}
        </Button>
      </div>

      {state.kind === 'error' ? (
        <p className="text-xs text-destructive">
          {state.message} — dùng ô &quot;Nhập tay thông số&quot; bên dưới để ra giá ngay, không cần chờ MakerWorld.
        </p>
      ) : null}

      {resolution && !manualSource ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="makerworld-profile-select">Profile in ({resolution.profiles.length})</Label>
          <select
            id="makerworld-profile-select"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">— Chọn đúng profile khách yêu cầu —</option>
            {resolution.profiles.map((p) => (
              <option key={p.profileId} value={p.profileId}>
                {p.profileTitle}{p.printerTarget ? ` · ${p.printerTarget}` : ''} · {Math.round((p.printTimeMinutes / 60) * 10) / 10}h · {p.platesCount} plates · {Math.round(p.netWeightGrams)}g
              </option>
            ))}
          </select>
          {resolution.requestedProfileMissing ? (
            <p className="text-xs text-destructive">Profile trong link không còn tồn tại trên MakerWorld — hãy chọn profile khác hoặc hỏi lại khách.</p>
          ) : null}
          {resolution.license ? (
            <p className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              License của mẫu: <strong>{resolution.license}</strong>
              {resolution.licenseCommercialUse === 'NOT_ALLOWED'
                ? ` — không cho phép thương mại. Báo giá theo chính sách "${PRINT_SERVICE_POLICY.label}" và được ghi vào báo giá làm căn cứ.`
                : ' — tự kiểm tra điều khoản trước khi báo giá.'}
            </p>
          ) : null}
          {!selectedProfileId && resolution.profiles.length > 1 ? (
            <p className="text-xs text-muted-foreground">Model này có nhiều profile in — bắt buộc chọn trước khi tính giá.</p>
          ) : null}
        </div>
      ) : null}

      {manualOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
          <p className="text-sm font-medium">Nhập tay thông số profile (khi MakerWorld chặn truy cập)</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="makerworld-spec-text">Dán đoạn thông số copy từ trang MakerWorld</Label>
            <Textarea
              id="makerworld-spec-text" rows={3} value={specText} onChange={(e) => setSpecText(e.target.value)}
              placeholder="vd: 0.2mm layer, 2 walls, 15% infill · P1S · 7.5 h · 6 plates · 170 g · No AMS"
            />
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={applySpecText} disabled={!specText.trim()}>
              Tách thông số
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="mw-manual-title">Tên profile</Label>
              <Input id="mw-manual-title" value={manualDraft.profileTitle} onChange={(e) => updateManualDraft({ profileTitle: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mw-manual-printer">Máy in</Label>
              <Input id="mw-manual-printer" value={manualDraft.printerTarget} placeholder="P1S/P2S" onChange={(e) => updateManualDraft({ printerTarget: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mw-manual-hours">Giờ in</Label>
              <Input id="mw-manual-hours" inputMode="decimal" value={manualDraft.hours} placeholder="7.5" onChange={(e) => updateManualDraft({ hours: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mw-manual-plates">Số plate</Label>
              <Input id="mw-manual-plates" inputMode="numeric" value={manualDraft.plates} onChange={(e) => updateManualDraft({ plates: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mw-manual-grams">Tổng gram (net)</Label>
              <Input id="mw-manual-grams" inputMode="decimal" value={manualDraft.grams} onChange={(e) => updateManualDraft({ grams: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mw-manual-colors">Số màu</Label>
              <Input id="mw-manual-colors" inputMode="numeric" value={manualDraft.colors} onChange={(e) => updateManualDraft({ colors: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mw-manual-material">Loại nhựa</Label>
              <Input id="mw-manual-material" value={manualDraft.materialType} onChange={(e) => updateManualDraft({ materialType: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mw-manual-ams">AMS</Label>
              <select
                id="mw-manual-ams" value={manualDraft.ams}
                onChange={(e) => updateManualDraft({ ams: e.target.value as ManualDraft['ams'] })}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="unknown">Chưa rõ</option>
                <option value="no">Không AMS</option>
                <option value="yes">Có AMS</option>
              </select>
            </div>
            <div className="col-span-2 flex flex-col gap-1 md:col-span-3">
              <Label htmlFor="mw-manual-image">Link ảnh profile (tuỳ chọn, chỉ makerworld.com/bambulab.com)</Label>
              <Input id="mw-manual-image" value={manualDraft.imageUrl} onChange={(e) => updateManualDraft({ imageUrl: e.target.value })} />
            </div>
          </div>
          {manualError ? <p className="text-xs text-destructive">{manualError}</p> : null}
          <Button type="button" size="sm" className="self-start" onClick={commitManual}>Dùng thông số này</Button>
        </div>
      ) : null}

      {activeSource ? (
        <ProfilePricing
          key={activeSource.key}
          source={activeSource}
          materials={materials}
          config={config}
          priceInputIds={priceInputIds}
          laborMinutesInputId={laborMinutesInputId}
        />
      ) : null}
    </div>
  );
}

type FilamentRow = {
  materialId: string;
  wastePreset: 'DEFAULT' | 'LOW' | 'STANDARD' | 'HIGH' | 'CUSTOM';
  customWasteGrams: string;
};

type AppliedQuote = { breakdown: PricingBreakdown; snapshot: QuoteModelSnapshot; configId: string };

/**
 * Per-profile pricing state. ALWAYS rendered with `key={source.key}` so switching profile (or
 * re-committing the manual form) remounts it with clean state (B3) — like toggling `*ngIf` in
 * Angular instead of hand-resetting every field in ngOnChanges.
 * Invariant: breakdown + snapshot are only ever produced together, from this one `source`, and any
 * edit after "Dùng giá này" (or unmount) clears the parent form's price inputs + hidden fields so a
 * stale price can never be submitted with a different profile's snapshot.
 */
function ProfilePricing({
  source, materials, config, priceInputIds, laborMinutesInputId,
}: {
  source: PricingSource;
  materials: MakerWorldQuoteMaterialOption[];
  config: MakerWorldPricingConfigOption | null;
  priceInputIds: string[];
  laborMinutesInputId?: string;
}) {
  const { profile, colorsCount } = source;
  const [rows, setRows] = useState<FilamentRow[]>(() => profile.filaments.map(() => ({ materialId: '', wastePreset: 'DEFAULT', customWasteGrams: '' })));
  const [amsRequired, setAmsRequired] = useState<boolean | null>(profile.amsRequired);
  const [tier, setTier] = useState<AssemblyTier | null>(null);
  const [laborMinutes, setLaborMinutes] = useState(String(defaultLaborMinutes(null, profile.platesCount)));
  const [consumableMaterialId, setConsumableMaterialId] = useState('');
  const [consumableGrams, setConsumableGrams] = useState('');
  const [verified, setVerified] = useState(false);
  // Owner policy (print-service-policy.ts): restricted licenses are quoted directly under the
  // shop-wide "personal, non-commercial print-on-request" basis — recorded on the snapshot, no gate.
  const licenseRestricted = source.licenseCommercialUse === 'NOT_ALLOWED';
  const [applied, setApplied] = useState<AppliedQuote | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const siblingIds = useMemo(() => [...priceInputIds, ...(laborMinutesInputId ? [laborMinutesInputId] : [])], [priceInputIds, laborMinutesInputId]);
  const appliedRef = useRef(false);
  const siblingIdsRef = useRef(siblingIds);
  useEffect(() => { siblingIdsRef.current = siblingIds; }, [siblingIds]);

  // Unmount (profile switch, tool switch, new fetch): never leave an applied price behind.
  useEffect(() => () => {
    if (appliedRef.current) setSiblingInputs(siblingIdsRef.current, '');
  }, []);

  /** Any edit after apply invalidates it — clears parent price inputs + hidden fields (B3). */
  function invalidate() {
    if (appliedRef.current) {
      setSiblingInputs(siblingIds, '');
      appliedRef.current = false;
    }
    setApplied(null);
    setApplyError(null);
  }
  function edit(fn: () => void) {
    fn();
    invalidate();
  }

  const matches = useMemo(
    () => matchAllFilaments(profile.filaments.map((f) => f.materialType), materials),
    [profile, materials],
  );
  const needsAmsChoice = profileNeedsAmsChoice(colorsCount, amsRequired);
  const defaultWastePct = defaultWasteRatioPctForProfile(colorsCount, amsRequired);

  // Shared with the storefront estimate + verified price presets (makerworld-pricing.ts) so staff and
  // customers always get numbers from the same rules. Unchosen spool = 0đ/g here (staff sees the
  // partial price while picking); "Dùng giá này" still requires every color to have a spool.
  const materialLines = useMemo<MakerWorldMaterialLine[]>(() => {
    const consumable = materials.find((m) => m.id === consumableMaterialId);
    const consumableGramsValue = Number(consumableGrams);
    return buildMakerWorldMaterialLines({
      filaments: profile.filaments,
      colorsCount,
      amsRequired,
      tier,
      choices: profile.filaments.map((_, index) => {
        const row = rows[index];
        const material = materials.find((m) => m.id === row.materialId);
        return {
          unitCostVndPerGram: material ? resolveMaterialUnitCostVndPerGram(material) : 0,
          materialId: material?.id ?? null,
          waste: row.wastePreset === 'DEFAULT' ? { mode: 'DEFAULT' as const }
            : row.wastePreset === 'CUSTOM' ? { mode: 'CUSTOM_GRAMS' as const, grams: Number(row.customWasteGrams) }
            : { mode: 'PRESET' as const, preset: row.wastePreset },
        };
      }),
      consumable: consumable ? { grams: consumableGramsValue, unitCostVndPerGram: resolveMaterialUnitCostVndPerGram(consumable), materialId: consumable.id } : null,
    }) ?? [];
  }, [profile, colorsCount, amsRequired, tier, rows, materials, consumableMaterialId, consumableGrams]);

  const breakdown = useMemo<PricingBreakdown | null>(() => {
    if (!config || needsAmsChoice || !materialLines.length) return null;
    return priceMakerWorldLines({ lines: materialLines, printMinutes: profile.printTimeMinutes, laborMinutes: Number(laborMinutes), config });
  }, [config, needsAmsChoice, materialLines, laborMinutes, profile.printTimeMinutes]);

  const allMaterialsChosen = rows.every((row) => row.materialId);
  const canApply = Boolean(breakdown && config && verified && allMaterialsChosen
    && !profile.dataIncomplete);

  function applyToForm() {
    if (!breakdown || !config || !canApply) return;
    const candidate = {
      schemaVersion: 2 as const,
      sourceUrl: source.sourceUrl,
      title: source.modelTitle,
      coverImageUrl: source.modelCoverImageUrl,
      platesCount: profile.platesCount,
      totalPrintMinutes: profile.printTimeMinutes,
      colorsCount,
      dataSource: source.dataSource,
      profileId: profile.profileId,
      profileTitle: profile.profileTitle,
      profileCoverImageUrl: profile.profileCoverImageUrl,
      printerTarget: profile.printerTarget,
      netWeightGrams: profile.netWeightGrams,
      amsRequired,
      tier,
      license: source.license,
      ...(licenseRestricted ? { licenseAcknowledged: true, licenseBasis: PRINT_SERVICE_POLICY.licenseBasis } : {}),
      profileVerified: verified,
    };
    // Same schema the server enforces — fail here with a readable message instead of a generic
    // "Dữ liệu không hợp lệ" after submit.
    const parsed = quoteModelSnapshotSchema.safeParse(candidate);
    if (!parsed.success) {
      setApplyError(parsed.error.issues[0]?.message ?? 'Thông tin profile không hợp lệ.');
      return;
    }
    setSiblingInputs(priceInputIds, String(breakdown.finalPriceVnd));
    if (laborMinutesInputId) setSiblingInputs([laborMinutesInputId], laborMinutes);
    appliedRef.current = true;
    setApplied({ breakdown, snapshot: parsed.data, configId: config.id });
    setApplyError(null);
  }

  function selectTier(next: AssemblyTier | null) {
    edit(() => {
      setTier(next);
      setLaborMinutes(String(defaultLaborMinutes(next, profile.platesCount)));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ProfileVerificationCard
        profileTitle={profile.profileTitle}
        modelTitle={source.dataSource === 'RESOLVER' ? source.modelTitle : null}
        imageUrl={profile.profileCoverImageUrl ?? source.modelCoverImageUrl}
        printerTarget={profile.printerTarget}
        printMinutes={profile.printTimeMinutes}
        platesCount={profile.platesCount}
        netWeightGrams={profile.netWeightGrams}
        amsRequired={amsRequired}
        dataSource={source.dataSource}
        tier={tier}
        verified={Boolean(applied)}
      />

      {profile.dataIncomplete ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
          Profile này trên MakerWorld thiếu số liệu (thời gian in, số plate hoặc gram từng màu = 0) — không thể tính giá từ dữ liệu tự động.
          Bấm &quot;Nhập tay thông số&quot; ở trên và nhập số liệu từ trang MakerWorld.
        </p>
      ) : null}

      {colorsCount > 1 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={needsAmsChoice ? 'font-medium text-destructive' : 'text-muted-foreground'}>
            {needsAmsChoice ? 'Chọn kiểu in trước khi tính giá:' : 'Kiểu in:'}
          </span>
          <Button type="button" size="sm" variant={amsRequired === true ? 'default' : 'outline'} onClick={() => edit(() => setAmsRequired(true))}>Có AMS</Button>
          <Button type="button" size="sm" variant={amsRequired === false ? 'default' : 'outline'} onClick={() => edit(() => setAmsRequired(false))}>Không AMS (in rời từng màu)</Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label>Vật liệu từng màu (đã bù hao phí) — chọn đúng cuộn nhựa trước khi tính giá</Label>
        {profile.filaments.map((filament, index) => {
          const row = rows[index];
          const match = matches[index];
          return (
            <div key={index} className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
              <div className="text-xs text-muted-foreground">
                {filament.name} · {filament.materialType}{filament.colorHex ? ` · ${filament.colorHex}` : ''} · {filament.netWeightGrams}g (net)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={row.materialId}
                  onChange={(e) => edit(() => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, materialId: e.target.value } : r))))}
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
                      key={preset} type="button" size="sm"
                      variant={row.wastePreset === preset ? 'default' : 'outline'}
                      onClick={() => edit(() => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, wastePreset: preset } : r))))}
                    >
                      {preset === 'DEFAULT' ? `Mặc định ${defaultWastePct}%`
                        : preset === 'CUSTOM' ? 'Gram tự nhập'
                        : `${WASTE_RATIO_OVERRIDE_PRESETS[preset]}%`}
                    </Button>
                  ))}
                </div>
                {row.wastePreset === 'CUSTOM' ? (
                  <Input
                    type="number" min={0} step="0.1" placeholder="Gram hao phí" value={row.customWasteGrams}
                    onChange={(e) => edit(() => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, customWasteGrams: e.target.value } : r))))}
                    className="w-32"
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Phương án hoàn thiện (mỗi báo giá chỉ 1 phương án)</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={tier === null ? 'default' : 'outline'} onClick={() => selectTier(null)}>Không áp dụng</Button>
          {ASSEMBLY_TIER_KEYS.map((key) => (
            <Button key={key} type="button" size="sm" variant={tier === key ? 'default' : 'outline'} onClick={() => selectTier(key)}>
              {ASSEMBLY_TIERS[key].label} · {ASSEMBLY_TIERS[key].laborMinutes} phút
            </Button>
          ))}
        </div>
        {tier && ASSEMBLY_TIERS[tier].consumableLine ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={consumableMaterialId}
              onChange={(e) => edit(() => setConsumableMaterialId(e.target.value))}
              className="h-8 min-w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">— Keo/vật tư hoàn thiện (tuỳ chọn) —</option>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name}{m.color ? ` (${m.color})` : ''}</option>)}
            </select>
            <Input
              type="number" min={0} step="0.1" placeholder="Gram" value={consumableGrams}
              onChange={(e) => edit(() => setConsumableGrams(e.target.value))} className="w-28"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`makerworld-labor-minutes-${source.key}`}>Thời gian thao tác (phút — theo phương án hoàn thiện hoặc số plate × 15, có thể sửa)</Label>
        <Input
          id={`makerworld-labor-minutes-${source.key}`} type="number" min={0} value={laborMinutes}
          onChange={(e) => edit(() => setLaborMinutes(e.target.value))} className="w-40"
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

          <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-emerald-600/40 bg-emerald-600/5 p-2 text-sm">
            <input
              type="checkbox" className="mt-0.5 size-4" checked={verified}
              onChange={(e) => {
                const next = e.target.checked;
                if (next) setVerified(true);
                else edit(() => setVerified(false));
              }}
            />
            <span>Đã xác nhận đúng profile khách yêu cầu (đối chiếu ảnh, tên profile, máy in và thông số với link khách gửi)</span>
          </label>
          {!allMaterialsChosen ? <p className="text-xs text-muted-foreground">Chọn cuộn nhựa cho tất cả các màu để dùng giá.</p> : null}
          <Button type="button" size="sm" className="mt-1" onClick={applyToForm} disabled={!canApply}>Dùng giá này &amp; điền form</Button>
          {applyError ? <p className="text-xs text-destructive">{applyError}</p> : null}
          {applied ? (
            <p className="text-xs text-muted-foreground">
              Đã điền {formatVnd(applied.breakdown.finalPriceVnd)} cho profile &quot;{profile.profileTitle}&quot; — đổi bất kỳ thông số nào sẽ xoá giá đã điền.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {!config ? 'Chưa có cấu hình giá hiện hành.'
            : profile.filaments.length === 0 ? 'Profile không có thông tin nhựa — dùng "Nhập tay thông số".'
            : needsAmsChoice ? 'Chọn có/không AMS để xem giá đề xuất.'
            : 'Nhập thời gian thao tác hợp lệ để xem giá đề xuất.'}
        </p>
      )}

      {applied ? (
        <>
          <input type="hidden" name="pricingBreakdown" value={JSON.stringify(applied.breakdown)} />
          <input type="hidden" name="pricingConfigId" value={applied.configId} />
          <input type="hidden" name="modelSnapshot" value={JSON.stringify(applied.snapshot)} />
        </>
      ) : null}
    </div>
  );
}
