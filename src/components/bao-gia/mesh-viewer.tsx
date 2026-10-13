'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, RefreshCw, Ruler } from 'lucide-react';
import { BUILD_VOLUME_MM } from '@/lib/pricing/fdm-estimate-model';

const AXIS_COLORS = { x: '#dc2626', y: '#059669', z: '#2563eb' } as const;

/** A camera-facing text label (canvas texture) — always readable, drawn on top of the model. */
function makeLabel(text: string, color: string, worldHeight: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = 'bold 44px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 36;
  canvas.width = width;
  canvas.height = 68;
  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(2, 2, width - 4, 64, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 18, 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set((worldHeight * width) / 68, worldHeight, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/**
 * Real-size dimension lines around the (scaled) part: X along the front edge, Y along the right
 * edge, Z up the front-left corner, each with end ticks and an "N mm" label, plus a light
 * bounding box — what the customer will physically receive.
 */
function buildDimensions(size: THREE.Vector3): THREE.Group {
  const group = new THREE.Group();
  const span = Math.max(size.length(), 20);
  const gap = Math.max(span * 0.06, 2);
  const tick = gap * 0.5;
  const labelHeight = Math.max(span * 0.075, 3);
  const hx = size.x / 2;
  const hy = size.y / 2;
  const fmt = (value: number) => `${(Math.round(value * 10) / 10).toLocaleString('vi-VN')} mm`;

  const addLine = (points: THREE.Vector3[], color: string) => {
    const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, depthTest: false }));
    line.renderOrder = 9;
    group.add(line);
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // X — in front of the part, on the plate.
  const yx = -hy - gap;
  addLine([v(-hx, yx, 0), v(hx, yx, 0), v(-hx, yx - tick, 0), v(-hx, yx + tick, 0), v(hx, yx - tick, 0), v(hx, yx + tick, 0)], AXIS_COLORS.x);
  const lx = makeLabel(fmt(size.x), AXIS_COLORS.x, labelHeight);
  lx.position.set(0, yx - labelHeight * 0.9, 0);
  group.add(lx);

  // Y — right of the part, on the plate.
  const xy = hx + gap;
  addLine([v(xy, -hy, 0), v(xy, hy, 0), v(xy - tick, -hy, 0), v(xy + tick, -hy, 0), v(xy - tick, hy, 0), v(xy + tick, hy, 0)], AXIS_COLORS.y);
  const ly = makeLabel(fmt(size.y), AXIS_COLORS.y, labelHeight);
  ly.position.set(xy + labelHeight * 1.6, 0, 0);
  group.add(ly);

  // Z — up the front-left corner, just outside the silhouette seen from the default camera.
  const zx = -hx - gap;
  const zy = -hy;
  addLine([v(zx, zy, 0), v(zx, zy, size.z), v(zx - tick, zy, 0), v(zx + tick, zy, 0), v(zx - tick, zy, size.z), v(zx + tick, zy, size.z)], AXIS_COLORS.z);
  const lz = makeLabel(fmt(size.z), AXIS_COLORS.z, labelHeight);
  lz.position.set(zx - labelHeight * 1.8, zy, size.z / 2);
  group.add(lz);

  // Bounding box outline.
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
    new THREE.LineBasicMaterial({ color: '#64748b', transparent: true, opacity: 0.45 }),
  );
  box.position.set(0, 0, size.z / 2);
  group.add(box);
  return group;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((object) => {
    const item = object as THREE.Mesh | THREE.Sprite | THREE.LineSegments;
    if ('geometry' in item && item.geometry) item.geometry.dispose();
    const material = (item as { material?: THREE.Material | THREE.Material[] }).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      (m as THREE.SpriteMaterial).map?.dispose();
      m.dispose();
    }
  });
}

/**
 * Phase 33 S6 — "Xem trước mô hình". One viewer at a time (the selected item); the part sits on a
 * 256 × 256 mm build plate, follows the customer's scale, and shows its real X/Y/Z size. Everything
 * is disposed on unmount / file change; a lost WebGL context degrades to a message.
 */
export default function MeshViewer({ positions, label, scalePct = 100 }: { positions: Float32Array; label: string; scalePct?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ mesh: THREE.Mesh; reset: () => void; controls: OrbitControls; fit: (scale: number) => void; showDimensions: (visible: boolean) => void } | null>(null);
  const [showDimensions, setShowDimensions] = useState(true);
  const [error, setError] = useState('');
  const [autoRotate, setAutoRotate] = useState(false);
  const [size, setSize] = useState<{ x: number; y: number; z: number } | null>(null);

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
    // Centre on X/Y and stand the part on the plate (min Z = 0), like a slicer does.
    const raw = geometry.boundingBox!;
    const rawCenter = raw.getCenter(new THREE.Vector3());
    geometry.translate(-rawCenter.x, -rawCenter.y, -raw.min.z);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const rawSize = geometry.boundingBox!.getSize(new THREE.Vector3());

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef2f6');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 20_000);
    camera.up.set(0, 0, 1);

    const material = new THREE.MeshStandardMaterial({ color: '#e8ab58', roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh, new THREE.HemisphereLight(0xffffff, 0x667085, 2.2));
    const light = new THREE.DirectionalLight(0xffffff, 2.6);
    light.position.set(300, -300, 600);
    scene.add(light);

    // Build plate: 256 mm square with a 10 mm grid, lying on Z = 0.
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(BUILD_VOLUME_MM.x, BUILD_VOLUME_MM.y), new THREE.MeshBasicMaterial({ color: '#d7dde6', side: THREE.DoubleSide }));
    plate.position.z = -0.05;
    const grid = new THREE.GridHelper(BUILD_VOLUME_MM.x, BUILD_VOLUME_MM.x / 10, 0x98a2b3, 0xc3cad5);
    grid.rotation.x = Math.PI / 2;
    scene.add(plate, grid);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
      if (dimensions) { scene.remove(dimensions); disposeGroup(dimensions); }
      dimensions = buildDimensions(s);
      dimensions.visible = dimensionsVisible;
      scene.add(dimensions);
      setSize({ x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10, z: Math.round(s.z * 10) / 10 });
      const span = Math.max(s.length(), 40);
      controls.target.set(0, 0, s.z / 2);
      camera.position.set(span * 1.15, -span * 1.4, s.z / 2 + span * 0.85);
      controls.minDistance = span * 0.2;
      controls.maxDistance = span * 8;
      controls.update();
    };
    fit(scalePct / 100);
    sceneRef.current = {
      mesh, controls, fit, reset: () => fit(mesh.scale.x),
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
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render); };
    render();
    return () => {
      sceneRef.current = null;
      cancelAnimationFrame(frame);
      if (dimensions) disposeGroup(dimensions);
      resize.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      plate.geometry.dispose();
      (plate.material as THREE.Material).dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [positions]); // scale changes are applied by the effect below, without rebuilding the scene

  useEffect(() => { sceneRef.current?.fit(scalePct / 100); }, [scalePct]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.controls.autoRotate = autoRotate; }, [autoRotate]);
  useEffect(() => { sceneRef.current?.showDimensions(showDimensions); }, [showDimensions]);

  const exceeds = size ? [size.x, size.y, size.z].sort((a, b) => a - b).some((value, index) => value > [BUILD_VOLUME_MM.x, BUILD_VOLUME_MM.y, BUILD_VOLUME_MM.z][index]) : false;

  return (
    <div ref={hostRef} className="relative h-72 w-full overflow-hidden rounded-xl border border-border sm:h-96" aria-label={`Xem trước 3D: ${label}`}>
      {error ? <p role="alert" className="p-4 text-sm text-muted-foreground">{error}</p> : null}
      {size && !error ? (
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1 text-xs">
          <span className="rounded-md bg-background/90 px-2 py-1 font-medium text-foreground shadow-xs">
            <span className="text-red-600">X</span> {size.x} · <span className="text-emerald-600">Y</span> {size.y} · <span className="text-blue-600">Z</span> {size.z} mm
          </span>
          <span className={`rounded-md px-2 py-1 shadow-xs ${exceeds ? 'bg-amber-500/90 text-white' : 'bg-background/90 text-muted-foreground'}`}>
            {exceeds ? 'Vượt bàn in 256 × 256 × 256 mm' : 'Bàn in 256 × 256 mm'}
          </span>
        </div>
      ) : null}
      {!error ? (
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button type="button" onClick={() => setShowDimensions((value) => !value)} aria-pressed={showDimensions} className={`cursor-pointer rounded-lg border border-border px-2 py-1 text-xs shadow-xs ${showDimensions ? 'bg-primary text-primary-foreground' : 'bg-background/90 text-foreground'}`}>
            <Ruler className="mr-1 inline size-3" />Kích thước
          </button>
          <button type="button" onClick={() => setAutoRotate((value) => !value)} aria-pressed={autoRotate} className={`cursor-pointer rounded-lg border border-border px-2 py-1 text-xs shadow-xs ${autoRotate ? 'bg-primary text-primary-foreground' : 'bg-background/90 text-foreground'}`}>
            <RefreshCw className="mr-1 inline size-3" />Tự xoay
          </button>
          <button type="button" onClick={() => sceneRef.current?.reset()} className="cursor-pointer rounded-lg border border-border bg-background/90 px-2 py-1 text-xs text-foreground shadow-xs">
            <RotateCcw className="mr-1 inline size-3" />Góc nhìn ban đầu
          </button>
        </div>
      ) : null}
      <p className="pointer-events-none absolute bottom-2 left-2 hidden text-[11px] text-muted-foreground sm:block">Kéo để xoay · cuộn để phóng to</p>
    </div>
  );
}
