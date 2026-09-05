'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CustomRequestForm, type CustomRequestPrefill } from '@/app/[locale]/(storefront)/custom-print/custom-request-form';
import { StorefrontButton } from '@/components/storefront/button';
import { calculateMeshVolumeCm3, estimateMeshWeightGrams, estimatePrintMinutes } from '@/lib/pricing/mesh-estimator';
import { createKeychainModel, exportKeychainStl, type KeychainModel } from '@/lib/keychain/keychain-engine';
import { trackKeychainExportDownload, trackKeychainExportToRequest, trackKeychainPreview } from '@/lib/analytics';

const COLOR_NAMES: Record<string, string> = {
  '#000000': 'đen', '#ffffff': 'trắng', '#ffd700': 'vàng', '#ef4444': 'đỏ', '#2563eb': 'xanh dương', '#16a34a': 'xanh lá',
};

function colorDescription(baseColor: string, textColor: string): string {
  return `Đế ${COLOR_NAMES[baseColor] ?? baseColor} (${baseColor.toUpperCase()}) - Chữ ${COLOR_NAMES[textColor] ?? textColor} (${textColor.toUpperCase()})`;
}

function safeFileName(text: string): string {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  return `${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'moc-khoa'}.stl`;
}

export function KeychainGenerator() {
  const canvasHost = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('BaSa3D');
  const [baseThicknessMm, setBaseThicknessMm] = useState(3);
  const [fontSizeMm, setFontSizeMm] = useState(11);
  const [letterSpacing, setLetterSpacing] = useState(1);
  const [horizontalPaddingMm, setHorizontalPaddingMm] = useState(7);
  const [verticalPaddingMm, setVerticalPaddingMm] = useState(5);
  const [cornerRadiusMm, setCornerRadiusMm] = useState(4);
  const [textThicknessMm, setTextThicknessMm] = useState(1.2);
  const [keyringHoleDiameterMm, setKeyringHoleDiameterMm] = useState(4.8);
  const [includeKeyringHole, setIncludeKeyringHole] = useState(true);
  const [baseColor, setBaseColor] = useState('#000000');
  const [textColor, setTextColor] = useState('#ffd700');
  const [model, setModel] = useState<KeychainModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<{ minPriceVnd: number; maxPriceVnd: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [prefill, setPrefill] = useState<CustomRequestPrefill | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      createKeychainModel({ text, baseThicknessMm, includeKeyringHole, fontSizeMm, letterSpacing, horizontalPaddingMm, verticalPaddingMm, cornerRadiusMm, textThicknessMm, keyringHoleDiameterMm })
        .then(async (nextModel) => {
          if (cancelled) {
            nextModel.baseGeometry.dispose(); nextModel.textGeometry.dispose(); nextModel.mergedGeometry.dispose();
            return;
          }
          setModel((previous) => {
            previous?.baseGeometry.dispose(); previous?.textGeometry.dispose(); previous?.mergedGeometry.dispose();
            return nextModel;
          });
          setError(null);
          trackKeychainPreview({ characterCount: text.trim().length, hasKeyringHole: includeKeyringHole });
          const weightGrams = estimateMeshWeightGrams(calculateMeshVolumeCm3(nextModel.mergedGeometry));
          const response = await fetch('/api/public/tool-price-estimate', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ weightGrams, printMinutes: estimatePrintMinutes(weightGrams) }),
          });
          if (!cancelled && response.ok) setPrice(await response.json());
          else if (!cancelled) setPrice(null);
        })
        .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể dựng mẫu.'); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [text, baseThicknessMm, includeKeyringHole, fontSizeMm, letterSpacing, horizontalPaddingMm, verticalPaddingMm, cornerRadiusMm, textThicknessMm, keyringHoleDiameterMm]);

  useEffect(() => {
    if (!model || !canvasHost.current) return;
    const host = canvasHost.current;
    const width = host.clientWidth; const height = Math.max(360, host.clientHeight);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf3f4f6);
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1_000);
    camera.position.set(45, -55, 48);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(width, height);
    renderer.domElement.dataset.testid = 'keychain-preview-canvas';
    host.replaceChildren(renderer.domElement);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(model.baseGeometry, new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.65 })));
    group.add(new THREE.Mesh(model.textGeometry, new THREE.MeshStandardMaterial({ color: textColor, roughness: 0.55 })));
    const box = new THREE.Box3().setFromObject(group); const center = box.getCenter(new THREE.Vector3()); group.position.sub(center);
    scene.add(group, new THREE.HemisphereLight(0xffffff, 0x555555, 2.2));
    const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(30, -20, 50); scene.add(light);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.minDistance = 30; controls.maxDistance = 150;
    let frame = 0;
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render); };
    render();
    return () => { cancelAnimationFrame(frame); controls.dispose(); renderer.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh) (object.material as THREE.Material).dispose(); }); };
  }, [model, baseColor, textColor]);

  const makeStl = useCallback(() => {
    if (!model) throw new Error('Mẫu chưa sẵn sàng.');
    return exportKeychainStl(model.mergedGeometry);
  }, [model]);

  function downloadStl() {
    const blob = makeStl(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = safeFileName(text); anchor.click(); URL.revokeObjectURL(url);
    trackKeychainExportDownload({ characterCount: text.trim().length });
  }

  async function exportToRequest() {
    setIsUploading(true); setError(null);
    try {
      const fileName = safeFileName(text); const body = new FormData(); body.set('file', makeStl(), fileName);
      const response = await fetch('/api/public/custom-requests/attachments', { method: 'POST', body });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? 'Không thể tải STL lên.');
      const { path } = await response.json() as { path: string };
      setPrefill({ attachmentPath: path, attachmentFileName: fileName, requestedMaterial: 'PLA', requestedColor: colorDescription(baseColor, textColor), description: `Móc khoá khắc tên: ${text.trim()} (${model?.widthMm.toFixed(1)} × ${model?.heightMm.toFixed(1)} × ${(baseThicknessMm + textThicknessMm).toFixed(1)} mm)` });
      trackKeychainExportToRequest({ characterCount: text.trim().length, hasKeyringHole: includeKeyringHole });
      window.setTimeout(() => document.querySelector('#keychain-request-form')?.scrollIntoView({ behavior: 'smooth' }), 0);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể chuẩn bị yêu cầu.'); }
    finally { setIsUploading(false); }
  }

  function resetDesign() {
    setText('BaSa3D'); setFontSizeMm(11); setLetterSpacing(1); setHorizontalPaddingMm(7); setVerticalPaddingMm(5);
    setCornerRadiusMm(4); setBaseThicknessMm(3); setTextThicknessMm(1.2); setIncludeKeyringHole(true);
    setKeyringHoleDiameterMm(4.8); setBaseColor('#000000'); setTextColor('#ffd700'); setPrefill(null); setError(null);
  }

  const range = (id: string, label: string, value: number, unit: string, min: number, max: number, step: number, onChange: (value: number) => void) => (
    <div><label htmlFor={id} className="flex justify-between text-sm font-semibold"><span>{label}</span><span className="font-normal text-muted-foreground">{value}{unit}</span></label><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full" /></div>
  );

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div ref={canvasHost} className="min-h-[360px] overflow-hidden rounded-xl border border-border bg-muted" aria-label="Bản xem trước móc khoá 3D" />
        <div className="space-y-5 rounded-xl border border-border bg-card p-5">
          <div><label htmlFor="keychain-text" className="text-sm font-semibold">Tên hoặc nội dung</label><input id="keychain-text" value={text} onChange={(event) => setText(event.target.value.slice(0, 24))} maxLength={24} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3" /></div>
          <fieldset className="space-y-4 rounded-lg border border-border p-4"><legend className="px-2 text-sm font-bold">Chữ</legend>{range('font-size', 'Cỡ chữ', fontSizeMm, ' mm', 6, 20, 0.5, setFontSizeMm)}{range('letter-spacing', 'Giãn chữ', letterSpacing, '×', 0.75, 2, 0.05, setLetterSpacing)}{range('text-thickness', 'Độ dày chữ nổi', textThicknessMm, ' mm', 0.6, 3, 0.2, setTextThicknessMm)}</fieldset>
          <fieldset className="space-y-4 rounded-lg border border-border p-4"><legend className="px-2 text-sm font-bold">Đế thẻ</legend>{range('horizontal-padding', 'Viền ngang', horizontalPaddingMm, ' mm', 4, 16, 1, setHorizontalPaddingMm)}{range('vertical-padding', 'Viền dọc', verticalPaddingMm, ' mm', 3, 12, 1, setVerticalPaddingMm)}{range('corner-radius', 'Bo góc', cornerRadiusMm, ' mm', 1, 10, 0.5, setCornerRadiusMm)}{range('base-thickness', 'Độ dày đế', baseThicknessMm, ' mm', 2, 5, 0.5, setBaseThicknessMm)}</fieldset>
          <fieldset className="space-y-4 rounded-lg border border-border p-4"><legend className="px-2 text-sm font-bold">Móc khoá</legend><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeKeyringHole} onChange={(event) => setIncludeKeyringHole(event.target.checked)} /> Có lỗ gắn khoen móc khoá</label>{includeKeyringHole ? range('hole-diameter', 'Đường kính lỗ', keyringHoleDiameterMm, ' mm', 3, 8, 0.2, setKeyringHoleDiameterMm) : null}</fieldset>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm">Màu đế<input aria-label="Màu đế" type="color" value={baseColor} onChange={(event) => setBaseColor(event.target.value)} className="mt-1 h-10 w-full" /></label><label className="text-sm">Màu chữ<input aria-label="Màu chữ" type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} className="mt-1 h-10 w-full" /></label></div>
          {model ? <p className="text-sm text-muted-foreground">Kích thước mẫu: <strong className="text-foreground">{model.widthMm.toFixed(1)} × {model.heightMm.toFixed(1)} × {(baseThicknessMm + textThicknessMm).toFixed(1)} mm</strong></p> : null}
          {price ? <div className="rounded-lg bg-primary/10 p-4"><p className="text-xs font-semibold uppercase text-primary">Ước tính tham khảo</p><p className="mt-1 text-xl font-bold">{price.minPriceVnd.toLocaleString('vi-VN')}đ – {price.maxPriceVnd.toLocaleString('vi-VN')}đ / chiếc</p></div> : null}
          <p className="text-xs text-muted-foreground">Giá thực tế phụ thuộc vào màu sắc, phụ kiện khoen móc và số lượng. Xưởng BaSa3D sẽ gửi báo giá chính xác qua SĐT/Zalo.</p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-2"><StorefrontButton type="button" onClick={downloadStl} disabled={!model}>Tải STL về máy</StorefrontButton><StorefrontButton type="button" variant="accent" onClick={() => void exportToRequest()} disabled={!model || isUploading}>{isUploading ? 'Đang chuẩn bị file...' : 'Gửi yêu cầu báo giá'}</StorefrontButton><button type="button" onClick={resetDesign} className="h-10 rounded-lg border border-border text-sm font-semibold hover:bg-muted">Đặt lại thiết kế</button></div>
        </div>
      </div>
      {prefill ? <section id="keychain-request-form"><h2 className="font-heading text-2xl font-bold">Hoàn tất yêu cầu báo giá</h2><p className="mb-4 mt-1 text-sm text-muted-foreground">STL đã được đính kèm. Bạn chỉ cần điền thông tin liên hệ và số lượng.</p><CustomRequestForm prefill={prefill} /></section> : null}
    </div>
  );
}
