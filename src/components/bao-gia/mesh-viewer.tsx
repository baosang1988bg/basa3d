'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Eye, EyeOff, Maximize2, RotateCcw, Ruler } from 'lucide-react';
import { BUILD_VOLUME_MM } from '@/lib/pricing/fdm-estimate-model';

type Axis = 'x' | 'y' | 'z';
const AXES: Axis[] = ['x', 'y', 'z'];
const AXIS_COLORS: Record<Axis, string> = { x: '#d43f3a', y: '#3f9a5a', z: '#3b63d6' };
const BACKGROUND = '#f3f1ef';
const MODEL_COLOR = '#d6a93c';
const SCALE_PRESETS = [50, 100, 150, 200] as const;

/** Double-headed arrow between two points (line + a cone at each end), always drawn on top. */
function addArrow(group: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, color: string, headLength: number) {
  const direction = to.clone().sub(from);
  if (direction.length() <= headLength * 2) return;
  direction.normalize();
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([from.clone().addScaledVector(direction, headLength * 0.9), to.clone().addScaledVector(direction, -headLength * 0.9)]),
    new THREE.LineBasicMaterial({ color, depthTest: false }),
  );
  line.renderOrder = 19;
  group.add(line);
  const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
  for (const [tip, dir] of [[to, direction], [from, direction.clone().negate()]] as const) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(headLength * 0.3, headLength, 16), material);
    cone.position.copy(tip).addScaledVector(dir, -headLength / 2);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cone.renderOrder = 19;
    group.add(cone);
  }
}

/**
 * Dimension arrows measured on the (scaled) part — X across the top front edge, Y along the top
 * right edge, Z up the left side. Everything is proportional to the part, so a 5 mm part and a
 * 200 mm part look the same; the text labels are HTML (fixed pixel size), anchored at `anchors`.
 */
function buildDimensions(size: THREE.Vector3): { group: THREE.Group; anchors: Record<Axis, THREE.Vector3> } {
  const group = new THREE.Group();
  const span = Math.max(size.length(), 0.1);
  const gap = span * 0.1;
  const head = span * 0.045;
  const hx = size.x / 2;
  const hy = size.y / 2;
  const top = size.z + gap;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  addArrow(group, v(-hx, -hy, top), v(hx, -hy, top), AXIS_COLORS.x, head);
  const leader = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([v(0, -hy, top), v(0, -hy, size.z + gap * 0.2)]),
    new THREE.LineDashedMaterial({ color: AXIS_COLORS.x, dashSize: head * 0.45, gapSize: head * 0.35, depthTest: false }),
  );
  leader.computeLineDistances();
  leader.renderOrder = 19;
  group.add(leader);
  addArrow(group, v(hx, -hy, top), v(hx, hy, top), AXIS_COLORS.y, head);
  addArrow(group, v(-hx - gap, -hy, 0), v(-hx - gap, -hy, size.z), AXIS_COLORS.z, head);
  return {
    group,
    anchors: { x: v(0, -hy, top), y: v(hx, 0, top), z: v(-hx - gap, -hy, size.z / 2) },
  };
}

/** Soft elliptical contact shadow under the part (radial gradient texture). */
function makeShadow(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(60, 64, 60, 0.30)');
  gradient.addColorStop(0.7, 'rgba(60, 64, 60, 0.15)');
  gradient.addColorStop(1, 'rgba(60, 64, 60, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  mesh.position.z = -0.001;
  return mesh;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const item = object as THREE.Mesh;
    if (item.geometry) item.geometry.dispose();
    const material = (item as { material?: THREE.Material | THREE.Material[] }).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
}

const fmt2 = (value: number) => value.toFixed(2);
const toolButton = 'inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium shadow-xs transition-colors';
const toolIdle = `${toolButton} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const toolActive = `${toolButton} border-amber-300 bg-amber-50 text-amber-800`;

/**
 * Phase 33 S6 — "Xem trước mô hình". One viewer at a time (the selected item). The part stands on
 * the ground (min Z = 0), follows the customer's scale and is measured directly on the model:
 * 3D arrows + HTML labels with the real printed size. A toolbar below hides/shows the
 * dimensions, returns to the file's real size (100%), opens a resize panel (mm per axis, %,
 * presets — uniform, so the part is never distorted) and resets the view.
 * Everything is disposed on unmount / file change; a lost WebGL context degrades to a message.
 */
export default function MeshViewer({ positions, label, scalePct = 100, onScaleChange }: {
  positions: Float32Array;
  label: string;
  scalePct?: number;
  onScaleChange?: (scalePct: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ resetView: () => void; fit: (scale: number) => void; showDimensions: (visible: boolean) => void } | null>(null);
  const labelRefs = useRef<Record<Axis, HTMLDivElement | null>>({ x: null, y: null, z: null });
  const gizmoRefs = useRef<Record<Axis, { line: SVGLineElement | null; head: SVGCircleElement | null; text: SVGTextElement | null }>>({
    x: { line: null, head: null, text: null }, y: { line: null, head: null, text: null }, z: { line: null, head: null, text: null },
  });
  const [error, setError] = useState('');
  const [showDimensions, setShowDimensions] = useState(true);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [size, setSize] = useState<{ x: number; y: number; z: number } | null>(null);
  const [baseSize, setBaseSize] = useState<{ x: number; y: number; z: number } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError('Thiết bị này không mở được xem trước 3D — kích thước và giá vẫn tính bình thường.');
      return;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    // Centre on X/Y and stand the part on the ground (min Z = 0), like a slicer does.
    const raw = geometry.boundingBox!;
    const rawCenter = raw.getCenter(new THREE.Vector3());
    geometry.translate(-rawCenter.x, -rawCenter.y, -raw.min.z);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const rawSize = geometry.boundingBox!.getSize(new THREE.Vector3());
    setBaseSize({ x: rawSize.x, y: rawSize.y, z: rawSize.z });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100_000);
    camera.up.set(0, 0, 1);
    const material = new THREE.MeshStandardMaterial({ color: MODEL_COLOR, roughness: 0.55, metalness: 0.08, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    const shadow = makeShadow();
    scene.add(mesh, shadow, new THREE.HemisphereLight(0xffffff, 0x8a7f70, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    scene.add(key, fill);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(BACKGROUND, 1);
    renderer.domElement.dataset.testid = 'bao-gia-preview-canvas';
    host.prepend(renderer.domElement);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setError('Xem trước 3D đã tắt để tiết kiệm bộ nhớ — kích thước và giá vẫn đúng.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let dimensions: THREE.Group | null = null;
    let anchors: Record<Axis, THREE.Vector3> | null = null;
    let dimensionsVisible = true;
    let current = new THREE.Vector3();
    const placeCamera = () => {
      const span = Math.max(current.length(), 0.1);
      controls.target.set(0, 0, current.z * 0.55);
      // Mostly frontal, slightly from above — reads like a technical drawing.
      camera.position.set(span * 0.35, -span * 1.8, current.z * 0.55 + span * 0.6);
      controls.minDistance = span * 0.3;
      controls.maxDistance = span * 10;
      controls.update();
    };
    const fit = (scale: number) => {
      mesh.scale.setScalar(scale);
      current = rawSize.clone().multiplyScalar(scale);
      if (dimensions) { scene.remove(dimensions); disposeObject(dimensions); }
      const built = buildDimensions(current);
      dimensions = built.group;
      anchors = built.anchors;
      dimensions.visible = dimensionsVisible;
      scene.add(dimensions);
      shadow.scale.set(Math.max(current.x, 0.1) * 1.6, Math.max(current.y, 0.1) * 1.6, 1);
      const span = Math.max(current.length(), 0.1);
      key.position.set(span, -span * 1.5, span * 2);
      fill.position.set(-span * 1.5, span, span);
      setSize({ x: current.x, y: current.y, z: current.z });
      placeCamera();
    };
    fit(scalePct / 100);
    sceneRef.current = {
      fit,
      resetView: placeCamera,
      showDimensions: (visible) => { dimensionsVisible = visible; if (dimensions) dimensions.visible = visible; },
    };

    const resize = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);

    const projected = new THREE.Vector3();
    const inverse = new THREE.Quaternion();
    const axisVector = new THREE.Vector3();
    const UNIT: Record<Axis, [number, number, number]> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const updateOverlays = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      // HTML labels at their 3D anchors; nudge apart when two would overlap.
      // Start with the gizmo card (top-right, 80 px + margin) so labels never slide under it.
      const placed: Array<{ left: number; top: number; w: number; h: number }> = [{ left: width - 96, top: 0, w: 96, h: 96 }];
      for (const axis of AXES) {
        const el = labelRefs.current[axis];
        if (!el) continue;
        if (!anchors || !dimensionsVisible) { el.style.visibility = 'hidden'; continue; }
        projected.copy(anchors[axis]).project(camera);
        if (projected.z > 1) { el.style.visibility = 'hidden'; continue; }
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        let left = ((projected.x + 1) / 2) * width - w / 2;
        let top = ((1 - projected.y) / 2) * height - h / 2;
        if (axis === 'x') top -= h * 0.75; // sit above the X arrow
        if (axis === 'y') { left += w * 0.35; top -= h * 0.4; }
        if (axis === 'z') left -= w * 0.15;
        for (const other of placed) {
          const overlapX = left < other.left + other.w + 6 && left + w + 6 > other.left;
          const overlapY = top < other.top + other.h + 4 && top + h + 4 > other.top;
          if (overlapX && overlapY) top = other.top + other.h + 6;
        }
        if (left + w > width - 96 && top < 96) left = width - 96 - w - 6; // still under the gizmo → move left
        left = Math.min(Math.max(left, 8), width - w - 8);
        top = Math.min(Math.max(top, 8), height - h - 8);
        placed.push({ left, top, w, h });
        el.style.visibility = 'visible';
        el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
      }
      // Orientation gizmo: world axes expressed in camera space.
      inverse.copy(camera.quaternion).invert();
      for (const axis of AXES) {
        axisVector.set(...UNIT[axis]).applyQuaternion(inverse);
        const refs = gizmoRefs.current[axis];
        const ex = 32 + axisVector.x * 19;
        const ey = 32 - axisVector.y * 19;
        refs.line?.setAttribute('x2', ex.toFixed(2));
        refs.line?.setAttribute('y2', ey.toFixed(2));
        refs.head?.setAttribute('cx', ex.toFixed(2));
        refs.head?.setAttribute('cy', ey.toFixed(2));
        refs.text?.setAttribute('x', (32 + axisVector.x * 27).toFixed(2));
        refs.text?.setAttribute('y', (32 - axisVector.y * 27 + 3.5).toFixed(2));
        const opacity = axisVector.z < -0.2 ? '0.4' : '1';
        refs.line?.setAttribute('opacity', opacity);
        refs.text?.setAttribute('opacity', opacity);
      }
    };

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      updateOverlays();
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      sceneRef.current = null;
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      if (dimensions) disposeObject(dimensions);
      disposeObject(shadow);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [positions]); // scale changes are applied by the effect below, without rebuilding the scene

  useEffect(() => { sceneRef.current?.fit(scalePct / 100); }, [scalePct]);
  useEffect(() => { sceneRef.current?.showDimensions(showDimensions); }, [showDimensions]);

  const exceeds = size ? [size.x, size.y, size.z].sort((a, b) => a - b).some((value, index) => value > [BUILD_VOLUME_MM.x, BUILD_VOLUME_MM.y, BUILD_VOLUME_MM.z][index]) : false;
  const setScale = (pct: number) => onScaleChange?.(Math.min(1000, Math.max(10, Math.round(pct * 10) / 10)));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label={`Xem trước 3D: ${label}`}>
      <div ref={hostRef} className="relative h-80 w-full sm:h-[26rem]" style={{ background: BACKGROUND }}>
        {error ? <p role="alert" className="p-4 text-sm text-slate-600">{error}</p> : null}
        {!error ? (
          <>
            <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
              <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm sm:px-4">Kéo để xoay<span className="hidden sm:inline"> · Cuộn để phóng to</span></span>
              {exceeds ? <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">Vượt khổ máy in 256 × 256 × 256 mm</span> : null}
            </div>
            {AXES.map((axis) => (
              <div
                key={axis}
                ref={(el) => { labelRefs.current[axis] = el; }}
                className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full border bg-white/95 px-3 py-1 font-mono text-sm font-semibold shadow-sm"
                style={{ color: AXIS_COLORS[axis], borderColor: `${AXIS_COLORS[axis]}55`, visibility: 'hidden' }}
                data-testid={`bao-gia-dim-${axis}`}
              >
                {axis.toUpperCase()} {size ? fmt2(size[axis]) : '–'} mm
              </div>
            ))}
            <svg viewBox="0 0 64 64" className="pointer-events-none absolute right-3 top-3 size-20 rounded-2xl bg-white/95 shadow-sm" aria-hidden="true">
              {AXES.map((axis) => (
                <g key={axis} stroke={AXIS_COLORS[axis]} fill={AXIS_COLORS[axis]}>
                  <line ref={(el) => { gizmoRefs.current[axis].line = el; }} x1="32" y1="32" x2="32" y2="32" strokeWidth="2.4" strokeLinecap="round" />
                  <circle ref={(el) => { gizmoRefs.current[axis].head = el; }} cx="32" cy="32" r="2.2" stroke="none" />
                  <text ref={(el) => { gizmoRefs.current[axis].text = el; }} x="32" y="32" fontSize="10" fontWeight="700" textAnchor="middle" stroke="none">{axis.toUpperCase()}</text>
                </g>
              ))}
              <circle cx="32" cy="32" r="2" fill="#1f2937" />
            </svg>
          </>
        ) : null}
      </div>

      {!error ? (
        <div className="border-t border-slate-200 bg-slate-50/80">
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 border-b border-slate-200 px-2 py-2 text-xs text-slate-600 sm:text-sm">
            {AXES.map((axis) => (
              <span key={axis} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="size-2.5 rounded-full" style={{ background: AXIS_COLORS[axis] }} />
                {axis.toUpperCase()}{size ? ` ${fmt2(size[axis])} mm` : ''}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => setShowDimensions((value) => !value)} aria-pressed={!showDimensions} className={showDimensions ? toolActive : toolIdle}>
              {showDimensions ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{showDimensions ? 'Ẩn kích thước' : 'Hiện kích thước'}
            </button>
            {onScaleChange ? (
              <>
                <button type="button" onClick={() => setScale(100)} disabled={scalePct === 100} className={`${toolIdle} disabled:cursor-default disabled:opacity-60`} title="Về đúng kích thước gốc trong file (tỉ lệ 100%)">
                  <Ruler className="size-4" />Kích thước thực tế
                </button>
                <button type="button" onClick={() => setResizeOpen((value) => !value)} aria-expanded={resizeOpen} className={resizeOpen ? toolActive : toolIdle}>
                  <Maximize2 className="size-4" />Chỉnh kích thước
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => sceneRef.current?.resetView()} className={toolIdle}>
              <RotateCcw className="size-4" />Đặt lại
            </button>
          </div>
          {resizeOpen && onScaleChange && baseSize ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 p-3" data-testid="bao-gia-resize-panel">
              <p className="text-xs text-slate-500">Sửa 1 chiều, các chiều còn lại đổi theo đúng tỉ lệ (mẫu không bị méo). Nhấn Enter hoặc bấm ra ngoài để áp dụng.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AXES.map((axis) => (
                  <SizeField
                    key={`${axis}-${scalePct}`}
                    label={axis.toUpperCase()}
                    color={AXIS_COLORS[axis]}
                    unit="mm"
                    ariaLabel={`Kích thước ${axis.toUpperCase()} (mm)`}
                    value={Math.round(baseSize[axis] * scalePct) / 100}
                    onCommit={(mm) => { if (baseSize[axis] > 0) setScale((mm / baseSize[axis]) * 100); }}
                  />
                ))}
                <SizeField key={`pct-${scalePct}`} label="Tỉ lệ" color="#475569" unit="%" ariaLabel="Tỉ lệ (%)" value={scalePct} onCommit={setScale} />
              </div>
              <div className="flex flex-wrap gap-2">
                {SCALE_PRESETS.map((pct) => (
                  <button key={pct} type="button" onClick={() => setScale(pct)} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${scalePct === pct ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Number field committed on blur / Enter so typing is not fought by re-renders. */
function SizeField({ label, color, unit, ariaLabel, value, onCommit }: { label: string; color: string; unit: string; ariaLabel: string; value: number; onCommit: (value: number) => void }) {
  const commit = (raw: string) => {
    const next = Number(raw.replace(',', '.'));
    if (Number.isFinite(next) && next > 0 && Math.abs(next - value) > 0.005) onCommit(next);
  };
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-200">
      <span className="whitespace-nowrap text-xs font-bold" style={{ color }}>{label}</span>
      <input
        aria-label={ariaLabel}
        type="number" min={0.01} step={0.01} inputMode="decimal" defaultValue={value}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(event.currentTarget.value); } }}
        className="h-10 w-full min-w-0 bg-transparent font-mono outline-none"
      />
      <span className="text-xs text-slate-500">{unit}</span>
    </label>
  );
}
