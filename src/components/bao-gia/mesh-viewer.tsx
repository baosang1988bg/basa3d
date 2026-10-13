'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw, RefreshCw } from 'lucide-react';
import { BUILD_VOLUME_MM } from '@/lib/pricing/fdm-estimate-model';

/**
 * Phase 33 S6 — "Xem trước mô hình". One viewer at a time (the selected item); the part sits on a
 * 256 × 256 mm build plate, follows the customer's scale, and shows its real X/Y/Z size. Everything
 * is disposed on unmount / file change; a lost WebGL context degrades to a message.
 */
export default function MeshViewer({ positions, label, scalePct = 100 }: { positions: Float32Array; label: string; scalePct?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ mesh: THREE.Mesh; reset: () => void; controls: OrbitControls; fit: (scale: number) => void } | null>(null);
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

    const fit = (scale: number) => {
      mesh.scale.setScalar(scale);
      const s = rawSize.clone().multiplyScalar(scale);
      setSize({ x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10, z: Math.round(s.z * 10) / 10 });
      const span = Math.max(s.length(), 40);
      controls.target.set(0, 0, s.z / 2);
      camera.position.set(span * 0.9, -span * 1.1, s.z / 2 + span * 0.7);
      controls.minDistance = span * 0.2;
      controls.maxDistance = span * 8;
      controls.update();
    };
    fit(scalePct / 100);
    sceneRef.current = { mesh, controls, fit, reset: () => fit(mesh.scale.x) };

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
