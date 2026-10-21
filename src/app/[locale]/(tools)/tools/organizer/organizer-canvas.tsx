'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { MeshArrays } from '@/lib/3d-tools/organizer/organizer-geometry';
import { meshToGeometry } from '@/lib/3d-tools/organizer/organizer-export';

export type CanvasPart = { mesh: MeshArrays; color: string };

/**
 * One renderer for the page lifetime; parts are swapped in place on every rebuild so the camera keeps
 * the user's angle. The camera is framed once, on the first model.
 */
export default function OrganizerCanvas({ parts }: { parts: CanvasPart[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; group: THREE.Group; camera: THREE.PerspectiveCamera; controls: OrbitControls; framed: boolean } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setError('Không thể mở xem trước 3D trên thiết bị này. Bạn vẫn có thể tải STL.'); return; }
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#eef2f6');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000); camera.up.set(0, 0, 1);
    const grid = new THREE.GridHelper(600, 60, 0xc7d0db, 0xdde3ea); grid.rotateX(Math.PI / 2);
    const group = new THREE.Group();
    scene.add(grid, group, new THREE.HemisphereLight(0xffffff, 0x667085, 2.2));
    const light = new THREE.DirectionalLight(0xffffff, 2.6); light.position.set(150, -200, 300); scene.add(light);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.testid = 'organizer-preview-canvas';
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    sceneRef.current = { scene, group, camera, controls, framed: false };
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    }); resize.observe(host);
    let frame = 0;
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render); }; render();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); controls.dispose();
      disposeGroup(group); grid.dispose(); renderer.dispose(); renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = sceneRef.current;
    if (!view) return;
    disposeGroup(view.group);
    for (const part of parts) {
      const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.6 });
      view.group.add(new THREE.Mesh(meshToGeometry(part.mesh), material));
    }
    if (!view.framed && parts.length) {
      const box = new THREE.Box3().setFromObject(view.group);
      const size = box.getSize(new THREE.Vector3()).length();
      const centre = box.getCenter(new THREE.Vector3());
      view.camera.position.set(centre.x + size * 0.9, centre.y - size * 1.1, centre.z + size * 0.9);
      view.controls.target.copy(centre);
      view.controls.minDistance = size * 0.2; view.controls.maxDistance = size * 6;
      view.framed = true;
    }
  }, [parts]);

  return <div className="relative h-full min-h-[360px]" ref={hostRef} aria-label="Bản xem trước khay 3D">{error ? <p role="alert" className="p-4">{error}</p> : null}</div>;
}

function disposeGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (Array.isArray(child.material) ? child.material : [child.material]).forEach((material) => material.dispose());
    }
  }
}
