'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { SITE_CONFIG } from '@/config/site';
import { Link } from '@/i18n/navigation';
import { trackOrganizerExportDownload, trackOrganizerExportToRequest, trackOrganizerPreview } from '@/lib/analytics';
import { estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { uploadCustomRequestFile } from '@/lib/uploads/upload-custom-request-file';
import { binWithLabelTo3mf, downloadBlob, labelTo3mf, meshToStl, slug } from '@/lib/3d-tools/organizer/organizer-export';
import { clearStoredFont, loadStoredFont, saveStoredFont } from '@/lib/3d-tools/organizer/organizer-font-store';
import { organizerText, type OrganizerLang, type OrganizerTextKey } from '@/lib/3d-tools/organizer/organizer-i18n';
import {
  DEFAULT_LABEL_PARAMS, DEFAULT_ORGANIZER_PARAMS, DEFAULT_PRINTER_ID, fitsPrinter, LABEL_RANGES, LABEL_SLIDER_RANGES, ORGANIZER_PRESETS,
  PARAM_RANGES, PRINTERS, SECTION_WARNINGS, WALL_TEXTURES, type LabelParams, type NumericKey, type OrganizerParams, type PrinterId,
  type WarningKey,
} from '@/lib/3d-tools/organizer/organizer-params';
import { decodeOrganizerQuery, encodeOrganizerQuery, hasOrganizerQuery } from '@/lib/3d-tools/organizer/organizer-share-url';
import type { OrganizerBuildSuccess } from '@/lib/3d-tools/organizer/organizer-worker-protocol';
import { OrganizerWorkerClient } from '@/lib/3d-tools/organizer/organizer-worker-client';
import type { CanvasPart } from './organizer-canvas';
import styles from './organizer.module.css';

const OrganizerCanvas = dynamic(() => import('./organizer-canvas'), { ssr: false, loading: () => <p className={styles.canvasMessage}>{organizerText('vi', 'status.loading3d')}</p> });
/** Same rebuild debounce as the reference. */
const REBUILD_DEBOUNCE_MS = 150;
const FONT_MAGIC = [0x00010000, 0x4f54544f /* OTTO */, 0x74727565 /* true */];

const parseList = (value: string) => value.split(',').map((part) => Number(part.trim())).filter((part) => !Number.isNaN(part));

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
  const fontInputRef = useRef<HTMLInputElement>(null);

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
    let active = true;
    // A font uploaded on an earlier visit (IndexedDB, this browser only) applies again, like the reference.
    void loadStoredFont().then((stored) => {
      if (!active || !stored) return;
      client.setFont(stored.bytes);
      setFontName(stored.name);
      setLabel((current) => ({ ...current })); // rebuild with the stored font
    });
    return () => { active = false; client.dispose(); clientRef.current = null; };
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
  const fits = fitsPrinter(params, printerId); // live params, as the reference
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
    await saveStoredFont({ name: file.name, bytes });
  }
  function resetFont() {
    clientRef.current?.setFont(null);
    setFontName(null);
    setLabel((current) => ({ ...current }));
    void clearStoredFont();
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

  /** Warnings sit next to the controls they concern, as in the reference panel. */
  const sectionWarnings = (codes: readonly WarningKey[]) => {
    const shown = (result?.warnings ?? []).filter((key) => codes.includes(key));
    return shown.length ? <ul className={styles.warnings} aria-live="polite">{shown.map((key) => <li key={key}>{t(key)}</li>)}</ul> : null;
  };

  const numberField = (key: NumericKey, labelKey: OrganizerTextKey) => {
    const range = PARAM_RANGES[key];
    return <RangeField label={t(labelKey)} value={params[key]} min={range.min} max={range.max} step={range.step} unit={range.unit}
      onChange={(value) => set(key, value)} disabled={uploading || ((key === 'cols' || key === 'rows') && customOn)} />;
  };
  const toggle = (checked: boolean, text: string, onChange: (next: boolean) => void) =>
    <label className={styles.toggle}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{text}</span></label>;
  const colorField = (text: string, value: string, onChange: (next: string) => void) =>
    <div className={styles.field}><div className={styles.fieldHead}><label>{text}</label></div>
      <input className={styles.color} type="color" aria-label={text} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
  const info = result?.info ?? null;
  const dash = '—';

  return <>
    <div className={styles.app}>
      <div className={styles.viewport}>
        {parts.length ? <OrganizerCanvas parts={parts} /> : <p className={styles.canvasMessage}>{buildError ? t('status.error') : t('status.building')}</p>}
        {building && parts.length ? <p className={styles.statusBadge} aria-live="polite">{t('status.building')}</p> : null}
      </div>
      <aside className={styles.panel}>
        <header className={styles.panelHeader}>
          <h1>{t('app.title')}</h1>
          {/* Hidden together with the storefront EN locale (NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED). */}
          {SITE_CONFIG.languageSwitcherEnabled && <div className={styles.lang} role="group" aria-label="Ngôn ngữ">
            {(['vi', 'en'] as const).map((code) => <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={lang === code}
              className={lang === code ? styles.on : undefined}>{organizerText(code, `lang.${code}`)}</button>)}
          </div>}
        </header>

        <fieldset disabled={uploading} className={styles.fieldset}>
          <Section title={t('section.presets')}>
            <div className={styles.presets}>
              {ORGANIZER_PRESETS.map((preset) => <button key={preset.id} type="button" className={styles.presetBtn}
                onClick={() => { setParams({ ...preset.params }); setCustomOn(false); }}>{t(`preset.${preset.id}` as OrganizerTextKey)}</button>)}
            </div>
          </Section>

          <Section title={t('section.dimensions')}>
            {numberField('width', 'field.width')}
            {numberField('depth', 'field.depth')}
            {numberField('height', 'field.height')}
            {sectionWarnings(SECTION_WARNINGS.dimensions)}
            <div className={styles.field}>
              <div className={styles.fieldHead}><label htmlFor="organizer-printer">{t('printer.label')}</label></div>
              <select id="organizer-printer" className={styles.select} value={printerId} onChange={(event) => setPrinterId(event.target.value as PrinterId)}>
                {PRINTERS.map((printer) => <option key={printer.id} value={printer.id}>{printer.label}</option>)}
              </select>
              {fits ? null : <div className={`${styles.banner} ${styles.warn}`} role="status">{t('printer.fitWarn')}</div>}
            </div>
          </Section>

          <Section title={t('section.grid')}>
            {numberField('cols', 'field.cols')}
            {numberField('rows', 'field.rows')}
            {sectionWarnings(SECTION_WARNINGS.grid)}
            {/* BaSa3D extra (phase-45 D4): per-cell sizes with auto-fit of the last cell. */}
            {toggle(customOn, t('grid.customOn'), toggleCustom)}
            {customOn ? <div className={styles.custom}>
              <div className={styles.field}><div className={styles.fieldHead}><label htmlFor="organizer-cols">{t('grid.columnWidths')}</label></div>
                <input id="organizer-cols" className={styles.textfield} value={columnsText} onChange={(event) => setColumnsText(event.target.value)} /></div>
              <div className={styles.field}><div className={styles.fieldHead}><label htmlFor="organizer-rows">{t('grid.rowDepths')}</label></div>
                <input id="organizer-rows" className={styles.textfield} value={rowsText} onChange={(event) => setRowsText(event.target.value)} /></div>
              <p className={styles.customHint}>{t('grid.customHint')}</p>
            </div> : null}
          </Section>

          <Section title={t('section.walls')}>
            {numberField('wall', 'field.wall')}
            {numberField('floor', 'field.floor')}
            {numberField('divider', 'field.divider')}
            {sectionWarnings(SECTION_WARNINGS.walls)}
          </Section>

          <Section title={t('section.style')}>
            {numberField('radius', 'field.radius')}
            {sectionWarnings(SECTION_WARNINGS.radius)}
            <div className={styles.field}>
              <div className={styles.fieldHead}><label htmlFor="organizer-texture">{t('field.texture')}</label></div>
              <select id="organizer-texture" className={styles.select} value={params.wallTexture} onChange={(event) => set('wallTexture', event.target.value as OrganizerParams['wallTexture'])}>
                {WALL_TEXTURES.map((texture) => <option key={texture} value={texture}>{t(`texture.${texture}`)}</option>)}
              </select>
            </div>
            {params.wallTexture !== 'none' ? <>{numberField('textureDepth', 'field.textureDepth')}{numberField('textureCount', 'field.textureCount')}{sectionWarnings(SECTION_WARNINGS.texture)}</> : null}
            {colorField(t('field.color'), params.color, (value) => set('color', value))}
            <div className={styles.toggles}>
              {toggle(params.stackingLip, t('toggle.lip'), (value) => set('stackingLip', value))}
              {toggle(params.labelTab, t('toggle.tab'), (value) => set('labelTab', value))}
              {toggle(params.fingerScoops, t('toggle.scoops'), (value) => set('fingerScoops', value))}
              {toggle(params.floorHoles, t('toggle.holes'), (value) => set('floorHoles', value))}
            </div>
            {sectionWarnings(SECTION_WARNINGS.toggles)}
          </Section>

          <Section title={t('section.label')} defaultOpen={false}>
            {toggle(label.enabled, t('label.enable'), (value) => setLabelField('enabled', value))}
            {label.enabled ? <>
              <div className={styles.field}>
                <div className={styles.fieldHead}><label htmlFor="organizer-label-text">{t('label.text')}</label></div>
                <input id="organizer-label-text" className={styles.textfield} type="text" value={label.text} placeholder="LABEL" maxLength={LABEL_RANGES.maxTextLength}
                  onChange={(event) => setLabelField('text', event.target.value)} />
              </div>
              <div className={styles.field}>
                <div className={styles.fieldHead}><label>{t('label.font')}</label><span className={styles.fieldVal}>{fontName ?? t('label.fontDefault')}</span></div>
                <div className={styles.fieldControls}>
                  <button type="button" className={`${styles.actionBtn} ${styles.secondary}`} onClick={() => fontInputRef.current?.click()}>{t('label.fontUpload')}</button>
                  {fontName ? <button type="button" className={`${styles.actionBtn} ${styles.secondary}`} onClick={resetFont}>{t('label.fontReset')}</button> : null}
                </div>
                <input ref={fontInputRef} type="file" accept=".ttf,.otf,font/ttf,font/otf" hidden
                  onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void uploadFont(file); }} />
                {fontError ? <div className={`${styles.banner} ${styles.warn}`} role="alert">{fontError}</div> : null}
              </div>
              <RangeField label={t('label.fontSize')} value={label.fontSize} {...LABEL_SLIDER_RANGES.fontSize} unit="mm" onChange={(value) => setLabelField('fontSize', value)} />
              <RangeField label={t('label.emboss')} value={label.embossDepth} {...LABEL_SLIDER_RANGES.embossDepth} unit="mm" onChange={(value) => setLabelField('embossDepth', value)} />
              <RangeField label={t('label.plateHeight')} value={label.plateHeight} {...LABEL_SLIDER_RANGES.plateHeight} unit="mm" onChange={(value) => setLabelField('plateHeight', value)} />
              {colorField(t('label.plateColor'), label.plateColor, (value) => setLabelField('plateColor', value))}
              {colorField(t('label.textColor'), label.textColor, (value) => setLabelField('textColor', value))}
              {sectionWarnings(SECTION_WARNINGS.label)}
              {result?.label ? <div className={styles.infoRow}><span className={styles.infoLabel}>{t('label.size')}</span><span className={styles.infoValue}>{labelSize(result.label.size)}</span></div> : null}
            </> : null}
          </Section>
        </fieldset>

        <Section title={t('section.info')}>
          <div className={styles.info}>
            <InfoRow label={t('info.bbox')} value={info ? `${info.bbox.join('×')} mm` : dash} />
            <InfoRow label={t('info.compartments')} value={info ? String(info.compartments) : dash} />
            <InfoRow label={t('info.cellInner')} value={info ? (info.uniformCells ? `${info.cellInner[0].toFixed(1)}×${info.cellInner[1].toFixed(1)} mm` : t('info.cellVaries')) : dash} />
            <InfoRow label={t('info.volume')} value={info ? `${info.volumeCm3.toFixed(1)} cm³` : dash} />
            <InfoRow label={t('info.weight')} value={info ? `${info.weightPlaG.toFixed(1)} g` : dash} />
            <InfoRow label={t('info.tris')} value={info ? info.triangles.toLocaleString() : dash} />
            {building ? <div className={styles.infoStatus}>…</div> : null}
          </div>
          {buildError ? <div className={`${styles.banner} ${styles.warn}`} role="alert">{t('status.error')}</div> : null}
        </Section>

        {/* BaSa3D extra: advisory price, shareable link and the Custom Request hand-off. */}
        <Section title={t('section.quote')}>
          <div className={styles.quote} id="tool-quote">
            <p className={styles.quotePrice}>{price ? `${t('price.estimate')}: ${price.minPriceVnd.toLocaleString('vi-VN')}đ – ${price.maxPriceVnd.toLocaleString('vi-VN')}đ ${t('price.unit')}` : t('price.none')}</p>
            <p className={styles.quoteNote}>{t('price.note')}</p>
            {error ? <p role="alert" className={styles.quoteError}>{error}</p> : null}
            <button type="button" className={styles.actionBtn} onClick={() => void sendRequest()} disabled={!result || uploading}>{uploading ? t('action.preparing') : t('action.request')}</button>
            <button type="button" className={`${styles.actionBtn} ${styles.secondary}`} onClick={() => void share()} disabled={!result}>{shared ? t('action.shared') : t('action.share')}</button>
            <Link href="/" className={styles.storeLink}>← {t('nav.store')}</Link>
          </div>
        </Section>

        <div className={styles.panelFooter}>
          <button type="button" className={styles.actionBtn} onClick={download} disabled={!result || uploading || building}>{t('action.download')}</button>
          {label.enabled ? <button type="button" className={`${styles.actionBtn} ${styles.secondary}`} onClick={downloadLabel} disabled={!result?.label || building || uploading}>{t('action.downloadLabel')}</button> : null}
        </div>
      </aside>
    </div>
    {prefill ? <section id="organizer-request-form" className="mx-auto max-w-3xl p-6"><h2 className="mb-4 text-2xl font-bold">{t('request.title')}</h2><CustomRequestForm key={prefill.attachmentPath} prefill={prefill} /></section> : null}
  </>;
}

function fmtFile(value: number) { return String(Math.round(value * 100) / 100); }
/** Same rounding as the reference: width × height to whole mm, thickness to 0.1 mm. */
function labelSize(size: [number, number, number]) { return `${size[0].toFixed(0)}×${size[1].toFixed(0)}×${size[2].toFixed(1)} mm`; }

function cellSizes(result: OrganizerBuildSuccess) {
  const p = result.params;
  const usableW = p.width - 2 * p.wall - (p.cols - 1) * p.divider;
  const usableD = p.depth - 2 * p.wall - (p.rows - 1) * p.divider;
  return {
    cellWidths: p.columnWidths ?? Array<number>(p.cols).fill(usableW / p.cols),
    cellDepths: p.rowDepths ?? Array<number>(p.rows).fill(usableD / p.rows),
  };
}

/** Collapsible panel section — the reference's button head with ▾ / ▸. */
function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={styles.panelSection}>
    <button type="button" className={styles.sectionHead} aria-expanded={open} onClick={() => setOpen(!open)}><span>{title}</span><i aria-hidden>{open ? '▾' : '▸'}</i></button>
    {open ? <div className={styles.sectionBody}>{children}</div> : null}
  </section>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className={styles.infoRow}><span className={styles.infoLabel}>{label}</span><span className={styles.infoValue}>{value}</span></div>;
}

function RangeField({ label, value, min, max, step, unit, onChange, disabled }: {
  label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void; disabled?: boolean;
}) {
  const change = (raw: number) => { if (Number.isFinite(raw)) onChange(raw); };
  return <div className={styles.field}>
    <div className={styles.fieldHead}><label>{label}</label><span className={styles.fieldVal}>{value}{unit ? <i>{unit}</i> : null}</span></div>
    <div className={styles.fieldControls}>
      <input className={styles.slider} type="range" aria-hidden tabIndex={-1} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => change(event.target.valueAsNumber)} />
      <input className={styles.numfield} type="number" aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => change(event.target.valueAsNumber)} />
    </div>
  </div>;
}
