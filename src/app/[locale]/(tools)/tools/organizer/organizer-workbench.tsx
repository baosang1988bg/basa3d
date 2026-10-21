'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import { trackOrganizerExportDownload, trackOrganizerExportToRequest, trackOrganizerPreview } from '@/lib/analytics';
import { estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { uploadCustomRequestFile } from '@/lib/uploads/upload-custom-request-file';
import { binWithLabelTo3mf, downloadBlob, labelTo3mf, meshToStl, slug } from '@/lib/3d-tools/organizer/organizer-export';
import { organizerText, type OrganizerLang, type OrganizerTextKey } from '@/lib/3d-tools/organizer/organizer-i18n';
import {
  DEFAULT_LABEL_PARAMS, DEFAULT_ORGANIZER_PARAMS, DEFAULT_PRINTER_ID, fitsPrinter, LABEL_RANGES, ORGANIZER_PRESETS,
  PARAM_RANGES, PRINTERS, WALL_TEXTURES, type LabelParams, type NumericKey, type OrganizerParams, type PrinterId,
} from '@/lib/3d-tools/organizer/organizer-params';
import { decodeOrganizerQuery, encodeOrganizerQuery, hasOrganizerQuery } from '@/lib/3d-tools/organizer/organizer-share-url';
import type { OrganizerBuildSuccess } from '@/lib/3d-tools/organizer/organizer-worker-protocol';
import { OrganizerWorkerClient } from '@/lib/3d-tools/organizer/organizer-worker-client';
import type { CanvasPart } from './organizer-canvas';

const OrganizerCanvas = dynamic(() => import('./organizer-canvas'), { ssr: false, loading: () => <p className="p-6">{organizerText('vi', 'status.loading3d')}</p> });
/** Same rebuild debounce as the reference. */
const REBUILD_DEBOUNCE_MS = 150;
const FONT_MAGIC = [0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */];

const parseList = (value: string) => value.split(',').map((part) => Number(part.trim())).filter((part) => !Number.isNaN(part));
const fmt = (value: number, digits = 1) => (Math.round(value * 10 ** digits) / 10 ** digits).toLocaleString('vi-VN');

export default function OrganizerWorkbench() {
  const [lang, setLang] = useState<OrganizerLang>('vi');
  const t = (key: OrganizerTextKey) => organizerText(lang, key);
  const [params, setParams] = useState<OrganizerParams>(DEFAULT_ORGANIZER_PARAMS);
  const [label, setLabel] = useState<LabelParams>(DEFAULT_LABEL_PARAMS);
  const [printerId, setPrinterId] = useState<PrinterId>(DEFAULT_PRINTER_ID);
  const [customOn, setCustomOn] = useState(false);
  const [columnsText, setColumnsText] = useState('');
  const [rowsText, setRowsText] = useState('');
  const [result, setResult] = useState<OrganizerBuildSuccess | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState('');
  const [fontName, setFontName] = useState<string | null>(null);
  const [fontError, setFontError] = useState('');
  const [shared, setShared] = useState(false);
  const [error, setError] = useState('');
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);
  const [uploading, setUploading] = useState(false);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);
  const clientRef = useRef<OrganizerWorkerClient | null>(null);

  // Shared link → load its configuration once (same query keys as the reference).
  useEffect(() => {
    const search = window.location.search;
    if (!hasOrganizerQuery(search)) return;
    const decoded = decodeOrganizerQuery(search);
    setParams((current) => ({ ...current, ...decoded }));
    if (decoded.columnWidths?.length || decoded.rowDepths?.length) {
      setCustomOn(true);
      setColumnsText((decoded.columnWidths ?? []).join(', '));
      setRowsText((decoded.rowDepths ?? []).join(', '));
    }
  }, []);

  useEffect(() => {
    const client = new OrganizerWorkerClient();
    clientRef.current = client;
    return () => { client.dispose(); clientRef.current = null; };
  }, []);

  const request = useMemo<Partial<OrganizerParams>>(() => customOn
    ? { ...params, columnWidths: parseList(columnsText), rowDepths: parseList(rowsText) }
    : { ...params, columnWidths: null, rowDepths: null }, [params, customOn, columnsText, rowsText]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client) return;
    setBuilding(true);
    const timer = window.setTimeout(() => {
      client.build(request, label.enabled ? label : null).then((reply) => {
        if (!reply) return; // superseded by a newer request
        setResult(reply); setBuildError(''); setBuilding(false);
      }).catch((reason: unknown) => {
        setBuildError(reason instanceof Error ? reason.message : String(reason)); setBuilding(false);
      });
    }, REBUILD_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [request, label]);

  // Advisory price (PLA), debounced like Phase 20.
  useEffect(() => {
    setPrice(null);
    if (!result) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      trackOrganizerPreview({ rows: result.params.rows, cols: result.params.cols });
      const volume = result.info.volumeCm3 + (result.label?.volumeCm3 ?? 0);
      const weightGrams = estimateMeshWeightGrams(volume);
      try {
        const response = await fetch('/api/public/tool-price-estimate', {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }),
        });
        const value = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setPrice(value);
      } catch { /* Advisory pricing must not prevent export. */ }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [result]);

  useEffect(() => { if (prefill) document.getElementById('organizer-request-form')?.scrollIntoView({ behavior: 'smooth' }); }, [prefill]);

  const parts = useMemo<CanvasPart[]>(() => {
    if (!result) return [];
    const list: CanvasPart[] = [{ mesh: result.bin, color: result.params.color }];
    if (result.label) {
      list.push({ mesh: result.label.plate, color: label.plateColor });
      if (result.label.text) list.push({ mesh: result.label.text, color: label.textColor });
    }
    return list;
  }, [result, label.plateColor, label.textColor]);

  const set = <K extends keyof OrganizerParams>(key: K, value: OrganizerParams[K]) => setParams((current) => ({ ...current, [key]: value }));
  const setLabelField = <K extends keyof LabelParams>(key: K, value: LabelParams[K]) => setLabel((current) => ({ ...current, [key]: value }));
  const fits = fitsPrinter(result?.params ?? params, printerId);
  const binFileName = result ? `bin_${fmtFile(result.params.width)}x${fmtFile(result.params.depth)}x${fmtFile(result.params.height)}.stl` : 'bin.stl';

  function toggleCustom(next: boolean) {
    if (next && result) {
      const { cellWidths, cellDepths } = cellSizes(result);
      setColumnsText(cellWidths.map((value) => fmtFile(value)).join(', '));
      setRowsText(cellDepths.map((value) => fmtFile(value)).join(', '));
    }
    setCustomOn(next);
  }

  function download() {
    if (!result) return;
    downloadBlob(meshToStl(result.bin), binFileName);
    trackOrganizerExportDownload({ rows: result.params.rows, cols: result.params.cols });
  }
  function downloadLabel() {
    if (!result?.label) return;
    downloadBlob(labelTo3mf(result.label, label.plateColor, label.textColor), `label_${slug(label.text)}_2color.3mf`);
  }
  async function share() {
    if (!result) return;
    const url = `${window.location.origin}${window.location.pathname}?${encodeOrganizerQuery(result.params)}`;
    try { await navigator.clipboard.writeText(url); setShared(true); window.setTimeout(() => setShared(false), 2000); }
    catch { window.prompt(t('action.share'), url); }
  }
  async function uploadFont(file: File | undefined) {
    setFontError('');
    if (!file) return;
    const bytes = await file.arrayBuffer();
    const magic = bytes.byteLength >= 4 ? new DataView(bytes).getUint32(0) : 0;
    if (!/\.(ttf|otf)$/i.test(file.name) || !FONT_MAGIC.includes(magic)) { setFontError(t('label.fontError')); return; }
    clientRef.current?.setFont(bytes);
    setFontName(file.name);
    setLabel((current) => ({ ...current })); // rebuild with the new font
  }
  function resetFont() {
    clientRef.current?.setFont(null);
    setFontName(null);
    setLabel((current) => ({ ...current }));
  }
  async function sendRequest() {
    if (!result) return;
    setUploading(true); setError('');
    try {
      const withLabel = Boolean(result.label);
      const fileName = withLabel ? binFileName.replace(/\.stl$/, '_label.3mf') : binFileName;
      const blob = withLabel && result.label
        ? binWithLabelTo3mf(result.bin, result.params.color, result.label, label.plateColor, label.textColor)
        : meshToStl(result.bin);
      const { path, uploadClaim } = await uploadCustomRequestFile(blob, fileName);
      const p = result.params;
      const extras = [
        p.stackingLip && 'vành xếp chồng', p.labelTab && 'nhãn dán', p.fingerScoops && 'rãnh lấy đồ', p.floorHoles && 'lỗ thoát đáy',
        p.wallTexture !== 'none' && `vân ${organizerText('vi', `texture.${p.wallTexture}` as OrganizerTextKey).toLowerCase()}`,
        withLabel && `nhãn snap "${label.text}"`,
      ].filter(Boolean).join(', ');
      setPrefill({
        attachmentPath: path, uploadClaim, attachmentFileName: fileName, requestedMaterial: 'PLA', requestedColor: p.color,
        description: `Khay chia ngăn: ${p.rows}x${p.cols}, ${fmtFile(p.width)}x${fmtFile(p.depth)}x${fmtFile(p.height)}mm${extras ? ` (${extras})` : ''}`,
      });
      trackOrganizerExportToRequest({ rows: p.rows, cols: p.cols });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể chuẩn bị yêu cầu.'); }
    finally { setUploading(false); }
  }

  const numberField = (key: NumericKey, labelKey: OrganizerTextKey) => {
    const range = PARAM_RANGES[key];
    return <RangeField label={t(labelKey)} value={params[key]} min={range.min} max={range.max} step={range.step} unit={range.unit}
      onChange={(value) => set(key, value)} disabled={uploading || ((key === 'cols' || key === 'rows') && customOn)} />;
  };

  return <>
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="relative min-h-[50dvh] bg-slate-100">
        {parts.length ? <OrganizerCanvas parts={parts} /> : <p className="p-6">{buildError ? t('status.error') : t('status.building')}</p>}
        {building && parts.length ? <p className="absolute left-3 top-3 rounded bg-background/80 px-2 py-1 text-xs" aria-live="polite">{t('status.building')}</p> : null}
      </div>
      <aside className="max-h-[calc(100dvh-3.5rem)] space-y-3 overflow-y-auto border-l p-4">
        <div className="flex items-start justify-between gap-2">
          <div><h1 className="text-xl font-bold">{t('app.title')}</h1><p className="text-sm text-muted-foreground">{t('app.subtitle')}</p></div>
          <div className="flex shrink-0 overflow-hidden rounded border text-xs" role="group" aria-label="Ngôn ngữ">
            {(['vi', 'en'] as const).map((code) => <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={lang === code}
              className={`px-2 py-1 ${lang === code ? 'bg-primary text-primary-foreground' : ''}`}>{organizerText(code, `lang.${code}`)}</button>)}
          </div>
        </div>

        <fieldset disabled={uploading} className="space-y-3">
          <Section title={t('section.presets')}>
            <div className="grid grid-cols-2 gap-2">
              {ORGANIZER_PRESETS.map((preset) => <button key={preset.id} type="button" className="rounded border px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => { setParams({ ...preset.params, color: params.color }); setCustomOn(false); }}>{t(`preset.${preset.id}` as OrganizerTextKey)}</button>)}
            </div>
          </Section>

          <Section title={t('section.dimensions')}>
            {numberField('width', 'field.width')}
            {numberField('depth', 'field.depth')}
            {numberField('height', 'field.height')}
            <label className="block text-sm">{t('printer.label')}
              <select value={printerId} onChange={(event) => setPrinterId(event.target.value as PrinterId)} className="mt-1 h-9 w-full rounded border bg-background px-2">
                {PRINTERS.map((printer) => <option key={printer.id} value={printer.id}>{printer.label}</option>)}
              </select>
            </label>
            <p className={`text-xs ${fits ? 'text-emerald-700' : 'text-destructive'}`} role="status">{fits ? t('printer.fitOk') : t('printer.fitWarn')}</p>
          </Section>

          <Section title={t('section.grid')}>
            {numberField('cols', 'field.cols')}
            {numberField('rows', 'field.rows')}
            <details className="rounded border p-2 text-sm" open={customOn}>
              <summary className="cursor-pointer">{t('grid.advanced')}</summary>
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={customOn} onChange={(event) => toggleCustom(event.target.checked)} />{t('grid.customOn')}</label>
              {customOn ? <div className="mt-2 space-y-2">
                <label className="block">{t('grid.columnWidths')}<input value={columnsText} onChange={(event) => setColumnsText(event.target.value)} className="mt-1 h-9 w-full rounded border bg-background px-2" /></label>
                <label className="block">{t('grid.rowDepths')}<input value={rowsText} onChange={(event) => setRowsText(event.target.value)} className="mt-1 h-9 w-full rounded border bg-background px-2" /></label>
                <p className="text-xs text-muted-foreground">{t('grid.customHint')}</p>
              </div> : null}
            </details>
          </Section>

          <Section title={t('section.walls')}>
            {numberField('wall', 'field.wall')}
            {numberField('floor', 'field.floor')}
            {numberField('divider', 'field.divider')}
          </Section>

          <Section title={t('section.style')}>
            {numberField('radius', 'field.radius')}
            <label className="block text-sm">{t('field.texture')}
              <select value={params.wallTexture} onChange={(event) => set('wallTexture', event.target.value as OrganizerParams['wallTexture'])} className="mt-1 h-9 w-full rounded border bg-background px-2">
                {WALL_TEXTURES.map((texture) => <option key={texture} value={texture}>{t(`texture.${texture}`)}</option>)}
              </select>
            </label>
            {params.wallTexture !== 'none' ? <>{numberField('textureDepth', 'field.textureDepth')}{numberField('textureCount', 'field.textureCount')}</> : null}
            <label className="flex items-center justify-between text-sm">{t('field.color')}
              <input type="color" value={params.color} onChange={(event) => set('color', event.target.value)} className="h-8 w-14 rounded border" /></label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([['stackingLip', 'toggle.lip'], ['labelTab', 'toggle.tab'], ['fingerScoops', 'toggle.scoops'], ['floorHoles', 'toggle.holes']] as const).map(([key, labelKey]) =>
                <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={params[key]} onChange={(event) => set(key, event.target.checked)} />{t(labelKey)}</label>)}
            </div>
          </Section>

          <Section title={t('section.label')} defaultOpen={false}>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={label.enabled} onChange={(event) => setLabelField('enabled', event.target.checked)} />{t('label.enable')}</label>
            {label.enabled ? <>
              <label className="block text-sm">{t('label.text')}
                <input value={label.text} maxLength={LABEL_RANGES.maxTextLength} onChange={(event) => setLabelField('text', event.target.value)} className="mt-1 h-9 w-full rounded border bg-background px-2" /></label>
              <RangeField label={t('label.fontSize')} value={label.fontSize} {...LABEL_RANGES.fontSize} unit="mm" onChange={(value) => setLabelField('fontSize', value)} />
              <RangeField label={t('label.emboss')} value={label.embossDepth} {...LABEL_RANGES.embossDepth} unit="mm" onChange={(value) => setLabelField('embossDepth', value)} />
              <RangeField label={t('label.plateHeight')} value={label.plateHeight} {...LABEL_RANGES.plateHeight} unit="mm" onChange={(value) => setLabelField('plateHeight', value)} />
              <div className="text-sm">{t('label.font')}: <span className="font-medium">{fontName ?? t('label.fontDefault')}</span>
                <div className="mt-1 flex gap-2">
                  <label className="cursor-pointer rounded border px-2 py-1">{t('label.fontUpload')}<input type="file" accept=".ttf,.otf" className="sr-only" onChange={(event) => void uploadFont(event.target.files?.[0])} /></label>
                  {fontName ? <button type="button" className="rounded border px-2 py-1" onClick={resetFont}>{t('label.fontReset')}</button> : null}
                </div>
                {fontError ? <p role="alert" className="text-xs text-destructive">{fontError}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex items-center justify-between gap-2">{t('label.plateColor')}<input type="color" value={label.plateColor} onChange={(event) => setLabelField('plateColor', event.target.value)} className="h-8 w-12 rounded border" /></label>
                <label className="flex items-center justify-between gap-2">{t('label.textColor')}<input type="color" value={label.textColor} onChange={(event) => setLabelField('textColor', event.target.value)} className="h-8 w-12 rounded border" /></label>
              </div>
              {result?.label ? <p className="text-xs text-muted-foreground">{t('label.size')}: {result.label.size.map((value) => fmt(value)).join(' × ')} mm</p> : null}
              <StorefrontButton variant="secondary" onClick={downloadLabel} disabled={!result?.label}>{t('action.downloadLabel')}</StorefrontButton>
            </> : null}
          </Section>
        </fieldset>

        {result?.warnings.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700" aria-live="polite">
          {result.warnings.map((key) => <li key={key}>{t(key)}</li>)}
        </ul> : null}
        {buildError ? <p role="alert" className="text-sm text-destructive">{t('status.error')}</p> : null}

        {result ? <Section title={t('section.info')}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt>{t('info.bbox')}</dt><dd className="text-right">{result.info.bbox.map((value) => fmt(value)).join('×')} mm</dd>
            <dt>{t('info.compartments')}</dt><dd className="text-right">{result.info.compartments}</dd>
            <dt>{t('info.cellInner')}</dt><dd className="text-right">{result.info.uniformCells ? `${fmt(result.info.cellInner[0])}×${fmt(result.info.cellInner[1])} mm` : t('info.cellVaries')}</dd>
            <dt>{t('info.volume')}</dt><dd className="text-right">{fmt(result.info.volumeCm3)} cm³</dd>
            <dt>{t('info.weight')}</dt><dd className="text-right">{fmt(result.info.weightPlaG)} g</dd>
            <dt>{t('info.tris')}</dt><dd className="text-right">{result.info.triangles.toLocaleString('vi-VN')}</dd>
          </dl>
        </Section> : null}

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {price ? <p>{t('price.estimate')}: {price.minPriceVnd.toLocaleString('vi-VN')}đ – {price.maxPriceVnd.toLocaleString('vi-VN')}đ {t('price.unit')}</p> : <p className="text-sm">{t('price.none')}</p>}
        <p className="text-xs text-muted-foreground">{t('price.note')}</p>
        <div className="grid gap-2" id="tool-quote">
          <StorefrontButton onClick={download} disabled={!result || uploading}>{t('action.download')}</StorefrontButton>
          <StorefrontButton variant="secondary" onClick={() => void share()} disabled={!result}>{shared ? t('action.shared') : t('action.share')}</StorefrontButton>
          <StorefrontButton onClick={() => void sendRequest()} disabled={!result || uploading}>{uploading ? t('action.preparing') : t('action.request')}</StorefrontButton>
        </div>
      </aside>
    </div>
    {prefill ? <section id="organizer-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">{t('request.title')}</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill} /></section> : null}
  </>;
}

function fmtFile(value: number) { return String(Math.round(value * 100) / 100); }

function cellSizes(result: OrganizerBuildSuccess) {
  const p = result.params;
  const usableW = p.width - 2 * p.wall - (p.cols - 1) * p.divider;
  const usableD = p.depth - 2 * p.wall - (p.rows - 1) * p.divider;
  return {
    cellWidths: p.columnWidths ?? Array<number>(p.cols).fill(usableW / p.cols),
    cellDepths: p.rowDepths ?? Array<number>(p.rows).fill(usableD / p.rows),
  };
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details open={defaultOpen} className="group rounded-lg border">
    <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-sm font-semibold">{title}<span aria-hidden className="transition-transform group-open:rotate-180">▾</span></summary>
    <div className="space-y-3 px-3 pb-3">{children}</div>
  </details>;
}

function RangeField({ label, value, min, max, step, unit, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void; disabled?: boolean;
}) {
  const change = (raw: number) => { if (Number.isFinite(raw)) onChange(raw); };
  return <div className="text-sm">
    <div className="flex items-center justify-between"><span>{label}</span><span className="text-xs text-muted-foreground">{value}{unit}</span></div>
    <div className="mt-1 flex items-center gap-2">
      <input type="range" aria-hidden tabIndex={-1} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => change(event.target.valueAsNumber)} className="w-full" />
      <input type="number" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => change(event.target.valueAsNumber)} className="h-8 w-20 rounded border bg-background px-2" />
    </div>
  </div>;
}
