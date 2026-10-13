'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, RefreshCw, Ruler } from 'lucide-react';
import { BUILD_VOLUME_MM } from '@/lib/pricing/fdm-estimate-model';

const AXIS_COLORS = { x: '#d43f3a', y: '#3f9a5a', z: '#3b63d6' } as const;
const BACKGROUND = '#f3f1ef';
const MODEL_COLOR = '#d6a93c';

/** Pill-shaped, camera-facing label ("X 105.56 mm"), drawn on top of the model. */
function makeLabel(axis: 'x' | 'y' | 'z', valueMm: number, worldHeight: number): THREE.Sprite {
  const color = AXIS_COLORS[axis];
  const text = `${axis.toUpperCase()} ${valueMm.toFixed(2)} mm`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 46px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.font = font;
  const height = 84;
  const width = Math.ceil(ctx.measureText(text).width) + 64;
  canvas.width = width + 12;
  canvas.height = height + 12;
  ctx.font = font;
  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(6, 4, width, height, height / 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, 6 + width / 2, 4 + height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set((worldHeight * canvas.width) / canvas.height, worldHeight, 1);
  sprite.renderOrder = 20;
  return sprite;
}

/** Double-headed arrow between two points (line + a cone at each end). */
function addArrow(group: THREE.Group, from: THREE.Vector3, to: THREE.Vector3, color: string, headLength: number) {
  const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
  const lineMaterial = new THREE.LineBasicMaterial({ color, depthTest: false });
  const direction = to.clone().sub(from);
  if (direction.length() <= 0) return;
  direction.normalize();
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    from.clone().addScaledVector(direction, headLength * 0.9),
    to.clone().addScaledVector(direction, -headLength * 0.9),
  ]), lineMaterial);
  line.renderOrder = 19;
  group.add(line);
  for (const [tip, dir] of [[to, direction], [from, direction.clone().negate()]] as const) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(headLength * 0.32, headLength, 16), material);
    cone.position.copy(tip).addScaledVector(dir, -headLength / 2);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    cone.renderOrder = 19;
    group.add(cone);
  }
}

/**
 * Real printed size measured directly on the model: X across the top front edge, Y along the top
 * right edge (depth), Z up the left side — each a double arrow with an "X 105.56 mm" pill label.
 * Sizes follow the customer's scale. Z is the print height (slicer convention, Z up).
 */
function buildDimensions(size: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  const span = Math.max(size.length(), 20);
  const gap = Math.max(span * 0.08, 2.5);
  const head = Math.max(span * 0.035, 1.2);
  const labelHeight = Math.max(span * 0.085, 3.4);
  const hx = size.x / 2;
  const hy = size.y / 2;
  const top = size.z + gap;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  addArrow(group, v(-hx, -hy, top), v(hx, -hy, top), AXIS_COLORS.x, head);
  const lx = makeLabel('x', size.x, labelHeight);
  lx.position.set(0, -hy, top + labelHeight * 0.9);
  group.add(lx);
  // Dashed leader from the X arrow down to the part, like a drawing callout.
  const leader = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([v(0, -hy, top), v(0, -hy, size.z + gap * 0.25)]),
    new THREE.LineDashedMaterial({ color: AXIS_COLORS.x, dashSize: head * 0.5, gapSize: head * 0.4, depthTest: false }),
  );
  leader.computeLineDistances();
  leader.renderOrder = 19;
  group.add(leader);

  addArrow(group, v(hx, -hy, top), v(hx, hy, top), AXIS_COLORS.y, head);
  const ly = makeLabel('y', size.y, labelHeight);
  ly.position.set(hx + labelHeight * 0.6, 0, top + labelHeight * 0.55);
  group.add(ly);

  addArrow(group, v(-hx - gap, -hy, 0), v(-hx - gap, -hy, size.z), AXIS_COLORS.z, head);
  const lz = makeLabel('z', size.z, labelHeight);
  lz.position.set(-hx - gap, -hy, size.z / 2);
  group.add(lz);
  return group;
}

/** Soft elliptical contact shadow under the part (radial gradient texture). */
function makeShadow(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(60, 64, 60, 0.32)');
  gradient.addColorStop(0.7, 'rgba(60, 64, 60, 0.18)');
  gradient.addColorStop(1, 'rgba(60, 64, 60, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  mesh.position.z = -0.02;
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

/**
 * Phase 33 S6 — "Xem trước mô hình". One viewer at a time (the selected item); the part stands on
 * the ground (min Z = 0), follows the customer's scale and is measured directly on the model.
 * Everything is disposed on unmount / file change; a lost WebGL context degrades to a message.
 */
export default function MeshViewer({ positions, label, scalePct = 100 }: { positions: Float32Array; label: string; scalePct?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ reset: () => void; controls: OrbitControls; fit: (scale: number) => void; showDimensions: (visible: boolean) => void } | null>(null);
  const [error, setError] = useState('');
  const [autoRotate, setAutoRotate] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [size, setSize] = useState<{ x: number; y: number; z: number } | null>(null);
  // Orientation gizmo (SVG): line + label refs per axis, updated from the camera every frame.
  const gizmoRefs = useRef<Record<'x' | 'y' | 'z', { line: SVGLineElement | null; head: SVGCircleElement | null; text: SVGTextElement | null }>>({
    x: { line: null, head: null, text: null }, y: { line: null, head: null, text: null }, z: { line: null, head: null, text: null },
  });

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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 50_000);
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
    controls.autoRotateSpeed = 1.5;

    let dimensions: THREE.Group | null = null;
    let dimensionsVisible = true;
    const fit = (scale: number) => {
      mesh.scale.setScalar(scale);
      const s = rawSize.clone().multiplyScalar(scale);
      if (dimensions) { scene.remove(dimensions); disposeObject(dimensions); }
      dimensions = buildDimensions(s);
      dimensions.visible = dimensionsVisible;
      scene.add(dimensions);
      shadow.scale.set(Math.max(s.x, 1) * 1.6, Math.max(s.y, 1) * 1.6, 1);
      setSize({ x: s.x, y: s.y, z: s.z });
      const span = Math.max(s.length(), 30);
      controls.target.set(0, 0, s.z * 0.55);
      // Mostly frontal, slightly from above — the dimensions read like a technical drawing.
      camera.position.set(span * 0.35, -span * 1.75, s.z * 0.55 + span * 0.55);
      key.position.set(span, -span * 1.5, span * 2);
      fill.position.set(-span * 1.5, span, span);
      controls.minDistance = span * 0.3;
      controls.maxDistance = span * 8;
      controls.update();
    };
    fit(scalePct / 100);
    sceneRef.current = {
      controls, fit, reset: () => fit(mesh.scale.x),
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
    let frame = 0;
    const inverse = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    const AXES: Array<['x' | 'y' | 'z', [number, number, number]]> = [['x', [1, 0, 0]], ['y', [0, 1, 0]], ['z', [0, 0, 1]]];
    const updateGizmo = () => {
      inverse.copy(camera.quaternion).invert();
      for (const [name, [ax, ay, az]] of AXES) {
        axis.set(ax, ay, az).applyQuaternion(inverse); // world axis in camera space
        const end = { x: 32 + axis.x * 20, y: 32 - axis.y * 20 };
        const refs = gizmoRefs.current[name];
        refs.line?.setAttribute('x2', end.x.toFixed(2));
        refs.line?.setAttribute('y2', end.y.toFixed(2));
        refs.head?.setAttribute('cx', end.x.toFixed(2));
        refs.head?.setAttribute('cy', end.y.toFixed(2));
        refs.text?.setAttribute('x', (32 + axis.x * 28).toFixed(2));
        refs.text?.setAttribute('y', (32 - axis.y * 28 + 4).toFixed(2));
        // Axes pointing away from the viewer are drawn fainter.
        const opacity = axis.z < -0.2 ? '0.45' : '1';
        refs.line?.setAttribute('opacity', opacity);
        refs.text?.setAttribute('opacity', opacity);
      }
    };
    const render = () => {
      controls.update();
      renderer.clear();
      renderer.render(scene, camera);
      updateGizmo();
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
  useEffect(() => { if (sceneRef.current) sceneRef.current.controls.autoRotate = autoRotate; }, [autoRotate]);
  useEffect(() => { sceneRef.current?.showDimensions(showDimensions); }, [showDimensions]);

  const exceeds = size ? [size.x, size.y, size.z].sort((a, b) => a - b).some((value, index) => value > [BUILD_VOLUME_MM.x, BUILD_VOLUME_MM.y, BUILD_VOLUME_MM.z][index]) : false;

  return (
    <div ref={hostRef} className="relative h-80 w-full overflow-hidden rounded-2xl border border-border sm:h-[26rem]" aria-label={`Xem trước 3D: ${label}`}>
      {error ? <p role="alert" className="p-4 text-sm text-muted-foreground">{error}</p> : null}
      {!error ? (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          <span className="rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-slate-500 shadow-sm">Kéo để xoay · Cuộn để phóng to</span>
          {exceeds ? <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow-sm">Vượt khổ máy in 256 × 256 × 256 mm</span> : null}
        </div>
      ) : null}
      {!error ? (
        <div className="absolute bottom-3 right-3 flex gap-1">
          <button type="button" onClick={() => setShowDimensions((value) => !value)} aria-pressed={showDimensions} className={`cursor-pointer rounded-full border border-border px-3 py-1 text-xs shadow-sm ${showDimensions ? 'bg-primary text-primary-foreground' : 'bg-white/95 text-foreground'}`}>
            <Ruler className="mr-1 inline size-3" />Kích thước
          </button>
          <button type="button" onClick={() => setAutoRotate((value) => !value)} aria-pressed={autoRotate} className={`cursor-pointer rounded-full border border-border px-3 py-1 text-xs shadow-sm ${autoRotate ? 'bg-primary text-primary-foreground' : 'bg-white/95 text-foreground'}`}>
            <RefreshCw className="mr-1 inline size-3" />Tự xoay
          </button>
          <button type="button" onClick={() => sceneRef.current?.reset()} className="cursor-pointer rounded-full border border-border bg-white/95 px-3 py-1 text-xs text-foreground shadow-sm">
            <RotateCcw className="mr-1 inline size-3" />Góc nhìn ban đầu
          </button>
        </div>
      ) : null}
      {!error ? (
        <svg viewBox="0 0 64 64" className="pointer-events-none absolute right-3 top-3 size-20 rounded-2xl bg-white/95 shadow-sm" aria-hidden="true">
          {(['x', 'y', 'z'] as const).map((name) => (
            <g key={name} stroke={AXIS_COLORS[name]} fill={AXIS_COLORS[name]}>
              <line ref={(el) => { gizmoRefs.current[name].line = el; }} x1="32" y1="32" x2="32" y2="32" strokeWidth="2.4" strokeLinecap="round" />
              <circle ref={(el) => { gizmoRefs.current[name].head = el; }} cx="32" cy="32" r="2.2" stroke="none" />
              <text ref={(el) => { gizmoRefs.current[name].text = el; }} x="32" y="32" fontSize="10" fontWeight="700" textAnchor="middle" stroke="none">{name.toUpperCase()}</text>
            </g>
          ))}
          <circle cx="32" cy="32" r="2" fill="#1f2937" />
        </svg>
      ) : null}
      {size && !error ? (
        <span className="sr-only">Kích thước in: X {size.x.toFixed(2)} mm, Y {size.y.toFixed(2)} mm, Z {size.z.toFixed(2)} mm</span>
      ) : null}
    </div>
  );
}
