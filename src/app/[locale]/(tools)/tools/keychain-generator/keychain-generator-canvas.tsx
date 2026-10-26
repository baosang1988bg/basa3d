'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { KeychainModel } from '@/lib/keychain/keychain-engine';

interface KeychainGeneratorCanvasProps {
  model: KeychainModel | null;
  baseColor: string;
  textColor: string;
}

export default function KeychainGeneratorCanvas({ model, baseColor, textColor }: KeychainGeneratorCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !model) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError('Không thể mở xem trước 3D trên thiết bị này. Bạn vẫn có thể tải STL.');
      return;
    }

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0b1220');

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000);
    camera.up.set(0, 1, 0);

    const group = new THREE.Group();
    const baseMesh = new THREE.Mesh(
      model.baseGeometry,
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.65, metalness: 0.05 })
    );
    const textMesh = new THREE.Mesh(
      model.textGeometry,
      new THREE.MeshStandardMaterial({ color: textColor, roughness: 0.45, metalness: 0.1 })
    );
    group.add(baseMesh, textMesh);

    // Center model at origin
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const boxSize = box.getSize(new THREE.Vector3());
    const size = Math.max(20, boxSize.length());
    group.position.sub(center);

    // Background grid behind the tag
    const grid = new THREE.GridHelper(Math.max(120, size * 2.5), 24, 0x334155, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    grid.position.set(0, 0, -boxSize.z / 2 - 0.5);

    scene.add(group, grid);

    // Lighting
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(40, 50, 80);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
    fillLight.position.set(-50, -40, 30);
    scene.add(fillLight);

    // Camera positioned in front with a slight angle to highlight 3D relief
    camera.position.set(0, -size * 0.25, size * 1.55);
    camera.lookAt(0, 0, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.dataset.testid = 'keychain-preview-canvas';
    host.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = Math.max(15, size * 0.4);
    controls.maxDistance = size * 6;

    const resizeObserver = new ResizeObserver(() => {
      const nextW = Math.max(1, host.clientWidth);
      const nextH = Math.max(1, host.clientHeight);
      renderer.setSize(nextW, nextH);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(host);

    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      baseMesh.material.dispose();
      textMesh.material.dispose();
      renderer.domElement.remove();
    };
  }, [model, baseColor, textColor]);

  return (
    <div
      ref={hostRef}
      className="relative size-full min-h-[360px]"
      aria-label="Bản xem trước móc khoá 3D"
    >
      {error ? <p role="alert" className="p-6 text-sm text-destructive">{error}</p> : null}
      {!model && !error ? (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <p className="animate-pulse text-sm">Đang dựng mô hình 3D...</p>
        </div>
      ) : null}
    </div>
  );
}
