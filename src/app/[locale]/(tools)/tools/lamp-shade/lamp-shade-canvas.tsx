'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export default function LampShadeCanvas({ group }: { group: THREE.Group }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
    catch { setError('Không thể mở xem trước 3D trên thiết bị này. Bạn vẫn có thể tải STL.'); return; }
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#111827');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000); camera.up.set(0, 1, 0);
    const bounds = new THREE.Box3().setFromObject(group);
    const size = bounds.getSize(new THREE.Vector3()).length();
    const center = bounds.getCenter(new THREE.Vector3());
    camera.position.set(center.x + size * 0.9, center.y + size * 0.3, center.z + size * 0.9);
    scene.add(group, new THREE.HemisphereLight(0xffffff, 0x555555, 2));
    const light = new THREE.PointLight(0xfff2cc, 4, size * 3); light.position.set(center.x, center.y, center.z); scene.add(light);
    const rim = new THREE.DirectionalLight(0xffffff, 1.5); rim.position.set(-100, 200, -100); scene.add(rim);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.testid = 'lamp-shade-preview-canvas';
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true; controls.minDistance = size * 0.3; controls.maxDistance = size * 5;
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    }); resize.observe(host);
    let frame = 0;
    const render = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(render); }; render();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); scene.remove(group); renderer.dispose(); renderer.domElement.remove(); };
  }, [group]);
  return <div className="relative h-full min-h-[300px]" ref={hostRef} aria-label="Bản xem trước chụp đèn 3D">{error ? <p role="alert">{error}</p> : null}</div>;
}
