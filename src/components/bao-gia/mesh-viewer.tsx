'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Phase 33 S6: one lazily-mounted viewer at a time; everything is disposed on unmount / file
 * change, and a lost WebGL context degrades to a message instead of a blank crash. */
export default function MeshViewer({ positions, label }: { positions: Float32Array; label: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

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
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = box.getCenter(new THREE.Vector3());
    const size = Math.max(box.getSize(new THREE.Vector3()).length(), 1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef2f6');
    const camera = new THREE.PerspectiveCamera(40, 1, size / 100, size * 20);
    camera.up.set(0, 0, 1);
    camera.position.set(center.x + size, center.y - size, center.z + size * 0.8);
    const material = new THREE.MeshStandardMaterial({ color: '#e8ab58', roughness: 0.65, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(geometry, material), new THREE.HemisphereLight(0xffffff, 0x555555, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(center.x + size, center.y - size, center.z + size * 2);
    scene.add(light);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.testid = 'bao-gia-preview-canvas';
    host.appendChild(renderer.domElement);
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setError('Xem trước 3D đã tắt để tiết kiệm bộ nhớ — kích thước và giá vẫn đúng.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableDamping = true;
    controls.minDistance = size * 0.2;
    controls.maxDistance = size * 6;
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
      cancelAnimationFrame(frame);
      resize.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [positions]);

  return (
    <div ref={hostRef} className="relative h-64 w-full overflow-hidden rounded-lg border border-border sm:h-80" aria-label={`Xem trước 3D: ${label}`}>
      {error ? <p role="alert" className="p-4 text-sm text-muted-foreground">{error}</p> : null}
    </div>
  );
}
