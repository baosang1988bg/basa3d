'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
import type { MeshArrays } from '@/lib/3d-tools/organizer/organizer-geometry';
import { meshToGeometry } from '@/lib/3d-tools/organizer/organizer-export';

export type CanvasPart = { mesh: MeshArrays; color: string };

/**
 * Phase 45 — the reference viewer (react-three-fiber + drei) rebuilt with plain three.js, same numbers:
 * camera fov 45 from (160,150,200), `Bounds` fit with margin 1.25 (refit on resize), lights, flat-shaded
 * standard material, drei `ContactShadows` (scale 420, far 160, blur 2.8, opacity 0.35) and drei `Grid`
 * (cells 10 mm, sections 50 mm, infinite, fade 900). The model is Z-up and rotated −90° about X, as there.
 */
const BOUNDS_MARGIN = 1.25;
const SHADOW = { scale: 420, far: 160, blur: 2.8, opacity: 0.35, color: '#8b96a8', resolution: 512 };
const GRID = { cellSize: 10, cellThickness: 0.6, sectionSize: 50, sectionThickness: 1, fadeDistance: 900, cellColor: '#c4ccd8', sectionColor: '#aab4c4' };

type View = {
  scene: THREE.Scene; group: THREE.Group; camera: THREE.PerspectiveCamera; controls: OrbitControls;
  fit: () => void;
};

export default function OrganizerCanvas({ parts }: { parts: CanvasPart[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<View | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch { setError('Không thể mở xem trước 3D trên thiết bị này. Bạn vẫn có thể tải STL.'); return; }
    // react-three-fiber defaults the reference relies on.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.dataset.testid = 'organizer-preview-canvas';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e6ebf2');
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    camera.position.set(160, 150, 200);
    const dirMain = new THREE.DirectionalLight(0xffffff, 1.2); dirMain.position.set(130, 200, 90);
    const dirFill = new THREE.DirectionalLight(0xffffff, 0.25); dirFill.position.set(-110, 40, -70);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35), new THREE.HemisphereLight('#ffffff', '#c4ccd8', 0.55), dirMain, dirFill);

    const group = new THREE.Group();
    group.rotation.x = -Math.PI / 2;
    scene.add(group);
    const grid = createGrid();
    scene.add(grid.mesh);
    const shadows = createContactShadows(renderer);
    scene.add(shadows.group);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // The reference's OrbitControls (three-stdlib via drei) zooms a fixed 0.95^zoomSpeed per wheel/dolly
    // event; three's own scales by |deltaY|, so a mouse notch (deltaY 100–200) zoomed up to 2× faster.
    (controls as unknown as { _getZoomScale: () => number })._getZoomScale = () => Math.pow(0.95, controls.zoomSpeed);

    // drei <Bounds fit clip observe margin={1.25}>: frame the group's box from the current view direction.
    // An empty group (the reference mounts before its first mesh) is treated as a cube as large as the
    // camera's distance from the origin — so the initial view does not depend on the model's size.
    const fit = () => {
      const box = new THREE.Box3().setFromObject(group);
      if (box.isEmpty()) {
        const max = camera.position.length() || 10;
        box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(max, max, max));
      }
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);
      const fitHeight = maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
      const distance = BOUNDS_MARGIN * Math.max(fitHeight, fitHeight / camera.aspect);
      const direction = center.clone().sub(camera.position).normalize().multiplyScalar(distance);
      camera.position.copy(center).sub(direction);
      controls.target.copy(center);
      camera.near = distance / 100; camera.far = distance * 100; camera.updateProjectionMatrix();
      controls.maxDistance = distance * 10;
      controls.update();
    };
    const view: View = { scene, group, camera, controls, fit };
    viewRef.current = view;
    // Same debug hook as the reference (`?__probe` exposes the viewport) — used by the parity checks.
    if (window.location.search.includes('__probe')) (window as unknown as { __viewport?: unknown }).__viewport = { camera, controls, gl: renderer, scene };

    const setSize = () => {
      const width = Math.max(1, host.clientWidth); const height = Math.max(1, host.clientHeight);
      const changed = renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) || camera.aspect !== width / height;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
      return changed;
    };
    setSize();
    fit(); // initial fit happens before the first mesh, as in the reference
    // `observe`: later viewport resizes refit to the model that is shown then.
    const resize = new ResizeObserver(() => { if (setSize()) fit(); });
    resize.observe(host);

    let frame = 0;
    const render = () => {
      controls.update();
      grid.update(camera);
      grid.mesh.visible = false;
      shadows.render(scene);
      grid.mesh.visible = true;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); controls.dispose();
      disposeGroup(group); grid.dispose(); shadows.dispose(); renderer.dispose(); renderer.domElement.remove();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    disposeGroup(view.group);
    parts.forEach((part, index) => {
      // Reference: bin roughness 0.6, label parts 0.55; flat shading on both.
      const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: index === 0 ? 0.6 : 0.55, metalness: 0.05, flatShading: true });
      view.group.add(new THREE.Mesh(meshToGeometry(part.mesh), material));
    });
  }, [parts]);

  return <div className="relative h-full min-h-[320px]" ref={hostRef} aria-label="Bản xem trước khay 3D">{error ? <p role="alert" className="p-4">{error}</p> : null}</div>;
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

/** drei `Grid` (infiniteGrid, followCamera off, fadeFrom camera) as a plain ShaderMaterial. */
function createGrid() {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const camProjected = new THREE.Vector3();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true,
    uniforms: {
      cellSize: { value: GRID.cellSize }, sectionSize: { value: GRID.sectionSize },
      cellThickness: { value: GRID.cellThickness }, sectionThickness: { value: GRID.sectionThickness },
      cellColor: { value: new THREE.Color(GRID.cellColor) }, sectionColor: { value: new THREE.Color(GRID.sectionColor) },
      fadeDistance: { value: GRID.fadeDistance }, fadeStrength: { value: 1 }, fadeFrom: { value: 1 },
      worldCamProjPosition: { value: camProjected },
    },
    vertexShader: /* glsl */ `
      varying vec3 localPosition;
      varying vec4 worldPosition;
      uniform float fadeDistance;
      void main() {
        localPosition = position.xzy * (1.0 + fadeDistance);
        worldPosition = modelMatrix * vec4(localPosition, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 localPosition;
      varying vec4 worldPosition;
      uniform vec3 worldCamProjPosition;
      uniform float cellSize, sectionSize, cellThickness, sectionThickness, fadeDistance, fadeStrength, fadeFrom;
      uniform vec3 cellColor, sectionColor;
      float getGrid(float size, float thickness) {
        vec2 r = localPosition.xz / size;
        vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
        float line = min(grid.x, grid.y) + 1.0 - thickness;
        return 1.0 - min(line, 1.0);
      }
      void main() {
        float g1 = getGrid(cellSize, cellThickness);
        float g2 = getGrid(sectionSize, sectionThickness);
        vec3 from = worldCamProjPosition * vec3(fadeFrom);
        float dist = distance(from, worldPosition.xyz);
        float d = 1.0 - min(dist / fadeDistance, 1.0);
        vec3 color = mix(cellColor, sectionColor, min(1.0, sectionThickness * g2));
        gl_FragColor = vec4(color, (g1 + g2) * pow(d, fadeStrength));
        gl_FragColor.a = mix(0.75 * gl_FragColor.a, gl_FragColor.a, g2);
        if (gl_FragColor.a <= 0.0) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.PlaneGeometry(10, 10);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    update(camera: THREE.Camera) { plane.projectPoint(camera.position, camProjected); },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}

/** drei `ContactShadows`: depth of the scene seen from below, blurred twice, shown on a ground plane. */
function createContactShadows(renderer: THREE.WebGLRenderer) {
  const { scale, far, blur, opacity, color, resolution } = SHADOW;
  const group = new THREE.Group();
  group.rotation.x = Math.PI / 2;
  const target = new THREE.WebGLRenderTarget(resolution, resolution);
  const targetBlur = new THREE.WebGLRenderTarget(resolution, resolution);
  target.texture.generateMipmaps = targetBlur.texture.generateMipmaps = false;
  const planeGeometry = new THREE.PlaneGeometry(scale, scale).rotateX(Math.PI / 2);
  const blurPlane = new THREE.Mesh(planeGeometry);
  blurPlane.visible = false;
  const depthMaterial = new THREE.MeshDepthMaterial();
  depthMaterial.depthTest = depthMaterial.depthWrite = false;
  depthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.ucolor = { value: new THREE.Color(color) };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 ucolor;\nvoid main() {\n')
      .replace('vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );');
  };
  const horizontal = new THREE.ShaderMaterial(HorizontalBlurShader); horizontal.depthTest = false;
  const vertical = new THREE.ShaderMaterial(VerticalBlurShader); vertical.depthTest = false;
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: target.texture, transparent: true, opacity, depthWrite: false });
  const shadowMesh = new THREE.Mesh(planeGeometry, shadowMaterial);
  shadowMesh.scale.set(1, -1, 1);
  shadowMesh.rotation.x = -Math.PI / 2;
  const shadowCamera = new THREE.OrthographicCamera(-scale / 2, scale / 2, scale / 2, -scale / 2, 0, far);
  group.add(shadowMesh, blurPlane, shadowCamera);

  const blurPass = (amount: number) => {
    blurPlane.visible = true;
    blurPlane.material = horizontal;
    horizontal.uniforms.tDiffuse.value = target.texture;
    horizontal.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(targetBlur);
    renderer.render(blurPlane, shadowCamera);
    blurPlane.material = vertical;
    vertical.uniforms.tDiffuse.value = targetBlur.texture;
    vertical.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(target);
    renderer.render(blurPlane, shadowCamera);
    blurPlane.visible = false;
  };

  return {
    group,
    render(scene: THREE.Scene) {
      const background = scene.background;
      group.visible = false;
      scene.background = null;
      scene.overrideMaterial = depthMaterial;
      renderer.setRenderTarget(target);
      renderer.render(scene, shadowCamera);
      blurPass(blur);
      blurPass(blur * 0.4);
      renderer.setRenderTarget(null);
      group.visible = true;
      scene.overrideMaterial = null;
      scene.background = background;
    },
    dispose() {
      target.dispose(); targetBlur.dispose(); planeGeometry.dispose();
      depthMaterial.dispose(); horizontal.dispose(); vertical.dispose(); shadowMaterial.dispose();
    },
  };
}
