'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { AssembledBookPart } from '@/lib/3d-tools/book-maker/book-maker-geometry';
import { AXIS_X, PITCH } from '@/lib/3d-tools/book-maker/book-maker-constants';

interface BookMakerCanvasProps {
  parts: AssembledBookPart[];
  foldProgress: number; // 0 (flat open) to 1 (closed)
  pages: number;
}

export default function BookMakerCanvas({ parts, foldProgress, pages }: BookMakerCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError('Không thể mở xem trước 3D trên thiết bị này. Bạn vẫn có thể tải file 3MF.');
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141418');

    // Camera setup
    const camera = new THREE.PerspectiveCamera(40, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 4000);
    camera.up.set(0, 1, 0);

    // Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Grid Floor (256x256 mm Bambu print bed indicator)
    const gridHelper = new THREE.GridHelper(256, 16, 0x444455, 0x282833);
    gridHelper.position.y = -2.1;
    scene.add(gridHelper);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x333344, 2.2);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight1.position.set(150, 300, 200);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90b0d0, 1.2);
    dirLight2.position.set(-150, 100, -100);
    scene.add(dirLight2);

    // Build Meshes & Kinematic Pivots
    const materials: THREE.Material[] = [];

    // Kinematic parameters
    const D = PITCH * pages + 0.102;
    const ax = AXIS_X;
    const f = Math.max(0, Math.min(1, foldProgress));
    const angle1 = (-Math.PI / 2) * f;
    const angle2 = (-Math.PI / 2) * f;

    // Node groups for hierarchical folding
    // 1. Back Cover (fixed base)
    // 2. Spine Pivot (rotates angle1 around axis A)
    // 3. Front Pivot (rotates angle2 around axis B relative to Spine)
    const spinePivot = new THREE.Group();
    spinePivot.position.set(ax, 0, 0);

    const frontPivot = new THREE.Group();
    frontPivot.position.set(-D / 2, 0, 0);

    for (const part of parts) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(part.colorHex),
        roughness: part.isCover ? 0.45 : 0.6,
        metalness: 0.05,
      });
      materials.push(mat);

      const mesh = new THREE.Mesh(part.geometry, mat);

      if (part.id === 'cover-back') {
        rootGroup.add(mesh);
      } else if (part.id === 'spine') {
        mesh.position.set(-ax, 0, 0);
        spinePivot.add(mesh);
      } else if (part.id === 'cover-front') {
        mesh.position.set(0, 0, 0);
        frontPivot.add(mesh);
      } else {
        // Pages
        rootGroup.add(mesh);
      }
    }

    // Apply folding rotation
    spinePivot.rotation.z = angle1;
    frontPivot.rotation.z = angle2;

    spinePivot.add(frontPivot);
    rootGroup.add(spinePivot);

    // Adjust camera to fit
    const bounds = new THREE.Box3().setFromObject(rootGroup);
    const size = bounds.getSize(new THREE.Vector3()).length();
    const center = bounds.getCenter(new THREE.Vector3());

    camera.position.set(center.x, center.y + Math.max(160, size * 0.9), center.z + Math.max(180, size * 1.1));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.testid = 'book-maker-preview-canvas';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = Math.max(40, size * 0.2);
    controls.maxDistance = size * 5;

    const resize = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      materials.forEach((m) => m.dispose());
      scene.remove(rootGroup);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [parts, foldProgress, pages]);

  return (
    <div
      className="relative h-full min-h-[380px] w-full select-none"
      ref={hostRef}
      aria-label="Bản xem trước 3D Sách ảnh tùy biến (Book Maker)"
    >
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive">
          <p role="alert">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
