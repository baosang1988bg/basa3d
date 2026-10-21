/**
 * Phase 45 — bin geometry with manifold-3d, ported from the reference worker (phase-45 plan §1.4).
 * The manifold module is injected so the same code runs in the Web Worker and in Node tests.
 * Every intermediate WASM object is tracked and deleted — manifold objects are not garbage collected.
 */
import type { ManifoldToplevel } from 'manifold-3d';
import {
  cellLayout, MAX_TEXTURE_POINTS, MIN_TEXTURE_POINTS, textureDef,
  type LabelParams, type OrganizerParams,
} from './organizer-params';

export type ManifoldApi = Pick<ManifoldToplevel, 'Manifold' | 'CrossSection'>;
type Solid = ReturnType<ManifoldApi['Manifold']['cube']>;
type Section = ReturnType<ManifoldApi['CrossSection']['square']>;
type Vec2 = [number, number];
type Deletable = { delete(): void };

export type MeshArrays = { positions: Float32Array; indices: Uint32Array };
export type BinInfo = {
  bbox: [number, number, number]; compartments: number; cellInner: [number, number]; uniformCells: boolean;
  volumeCm3: number; weightPlaG: number; triangles: number;
};
export type LabelLayout = { Wp: number; Hp: number; Wf: number; Hf: number; zc: number; scale: number; fits: boolean };
export type LabelBuild = { plate: MeshArrays; text: MeshArrays | null; size: [number, number, number]; triangles: number; volumeCm3: number; fits: boolean };

const SEGMENTS = 64;
const PLA_DENSITY = 1.24;
const TAB = { tabD: 12, tabH: 8, minTip: 1.6, bevelR: 0.4 };
const SNAP = { bossD: 3, bw: 2.5, pocketD: 2.2, lipLayer: 0.5, lipOver: 0.7, clr: 0.25, textMargin: 2.5, plateGap: 0.1 };

class Scope {
  private items: Deletable[] = [];
  keep<T extends Deletable>(item: T): T { this.items.push(item); return item; }
  dispose(except?: Deletable) {
    for (const item of this.items) if (item !== except) item.delete();
    this.items = [];
  }
}

function roundedRect(api: ManifoldApi, s: Scope, width: number, depth: number, radius: number): Section {
  if (radius > 0.01) {
    const core = s.keep(api.CrossSection.square([width - 2 * radius, depth - 2 * radius], true));
    return s.keep(core.offset(radius, 'Round', undefined, SEGMENTS));
  }
  return s.keep(api.CrossSection.square([width, depth], true));
}

type PerimeterPoint = { x: number; y: number; nx: number; ny: number; s: number };
/** Evenly samples the rounded-rectangle outline counter-clockwise, starting on the +X edge. */
export function sampleRoundedRect(width: number, depth: number, radius: number, count: number): { points: PerimeterPoint[]; perimeter: number } {
  const hw = width / 2, hd = depth / 2;
  const r = Math.min(Math.max(radius, 0), Math.min(hw, hd) - 0.01);
  const straightX = width - 2 * r, straightY = depth - 2 * r;
  const arc = (Math.PI * r) / 2;
  const perimeter = 2 * straightX + 2 * straightY + 2 * Math.PI * r;
  const corner = (cx: number, cy: number, start: number) => (t: number) => {
    const angle = start + (r > 0 ? t / r : 0);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), nx: Math.cos(angle), ny: Math.sin(angle) };
  };
  const segments: { len: number; at: (t: number) => Omit<PerimeterPoint, 's'> }[] = [
    { len: straightY, at: (t) => ({ x: hw, y: -(hd - r) + t, nx: 1, ny: 0 }) },
    { len: arc, at: corner(hw - r, hd - r, 0) },
    { len: straightX, at: (t) => ({ x: hw - r - t, y: hd, nx: 0, ny: 1 }) },
    { len: arc, at: corner(-(hw - r), hd - r, Math.PI / 2) },
    { len: straightY, at: (t) => ({ x: -hw, y: hd - r - t, nx: -1, ny: 0 }) },
    { len: arc, at: corner(-(hw - r), -(hd - r), Math.PI) },
    { len: straightX, at: (t) => ({ x: -(hw - r) + t, y: -hd, nx: 0, ny: -1 }) },
    { len: arc, at: corner(hw - r, -(hd - r), (3 * Math.PI) / 2) },
  ];
  const step = perimeter / count;
  const points: PerimeterPoint[] = [];
  let index = 0, start = 0;
  for (let i = 0; i < count; i++) {
    const at = i * step;
    while (index < segments.length - 1 && at >= start + segments[index].len) { start += segments[index].len; index++; }
    const local = Math.min(at - start, segments[index].len);
    points.push({ ...segments[index].at(local), s: at });
  }
  return { points, perimeter };
}

/** Outer outline with the wall texture applied, or null when no texture is active. */
export function texturedOutline(p: OrganizerParams): Vec2[] | null {
  const texture = textureDef(p.wallTexture);
  const depth = Math.max(0, p.textureDepth);
  if (!texture || depth < 0.001) return null;
  const periods = Math.max(1, Math.round(p.textureCount));
  const count = Math.round(Math.min(MAX_TEXTURE_POINTS, Math.max(MIN_TEXTURE_POINTS, periods * texture.ppg)));
  const { points, perimeter } = sampleRoundedRect(p.width, p.depth, p.radius, count);
  return points.map(({ x, y, nx, ny, s }) => {
    const phase = ((periods * s) / perimeter) % 1;
    const offset = texture.offset((phase + 1) % 1, depth);
    return [x + nx * offset, y + ny * offset];
  });
}

function labelTab(api: ManifoldApi, s: Scope, p: OrganizerParams): Solid | null {
  if (!p.labelTab) return null;
  const { tabD, tabH, minTip, bevelR } = TAB;
  const back = Math.max(2, tabD - tabH);
  const length = Math.max(4, p.width - 2 * Math.max(p.radius, 2));
  const profile: Vec2[] = [[-back, 0], [0, 0], [tabH, tabD], [tabH - minTip, tabD]];
  const raw = s.keep(new api.CrossSection([profile]));
  const grown = s.keep(raw.offset(bevelR, 'Round', undefined, SEGMENTS));
  const beveled = s.keep(grown.offset(-bevelR, 'Round', undefined, SEGMENTS));
  const extruded = s.keep(api.Manifold.extrude(beveled, length));
  const rotated = s.keep(extruded.rotate([0, -90, 0]));
  return s.keep(rotated.translate([length / 2, -p.depth / 2, p.height]));
}

/** Snap-on label boss + pocket on the bin's −Y face (reference `hd` layout). */
export function labelLayout(p: OrganizerParams, label: LabelParams, textBox: { w: number; h: number } | null): LabelLayout {
  const { bw, textMargin } = SNAP;
  const usableW = Math.max(16, p.width - 2 * Math.max(p.radius, 2));
  const usableH = Math.max(12, p.height - 4);
  const Hp = Math.min(label.plateHeight, usableH - 2 * bw);
  const textH = Math.max(1, Hp - 2 * textMargin);
  const textW = usableW - 2 * bw - 2 * textMargin;
  let scale = 1, drawnW = 0;
  if (textBox && textBox.w > 0 && textBox.h > 0) {
    if (textBox.w > textW) scale = textW / textBox.w;
    if (textBox.h * scale > textH) scale = Math.min(scale, textH / textBox.h);
    scale = Math.max(0.05, scale);
    drawnW = textBox.w * scale;
  }
  const Wp = Math.min(usableW - 2 * bw, Math.max(10, drawnW + 2 * textMargin));
  const Wf = Wp + 2 * bw;
  const Hf = Hp + 2 * bw;
  const zc = Math.min(Math.max(Hf / 2 + 1, p.height * 0.5), p.height - Hf / 2 - 1);
  return { Wp, Hp, Wf, Hf, zc, scale, fits: Wf <= usableW + 1e-6 && Hf <= usableH + 1e-6 };
}

function labelBossAndCut(api: ManifoldApi, s: Scope, p: OrganizerParams, l: LabelLayout) {
  const front = -p.depth / 2;
  const { bossD, pocketD, lipLayer, lipOver } = SNAP;
  const boss = s.keep(s.keep(api.Manifold.cube([l.Wf, bossD, l.Hf], true)).translate([0, front - bossD / 2, l.zc]));
  const pocket = s.keep(s.keep(api.Manifold.cube([l.Wp, pocketD - lipLayer, l.Hp], true))
    .translate([0, front - bossD + lipLayer + (pocketD - lipLayer) / 2, l.zc]));
  const slot = s.keep(s.keep(api.Manifold.cube([l.Wp, lipLayer + 0.1, l.Hp - 2 * lipOver], true))
    .translate([0, front - bossD + lipLayer / 2, l.zc]));
  return { boss, cut: s.keep(api.Manifold.union([pocket, slot])) };
}

function buildBinSolid(api: ManifoldApi, s: Scope, p: OrganizerParams): Solid {
  const rect = (w: number, d: number, r: number) => roundedRect(api, s, w, d, r);
  const textured = texturedOutline(p);
  const outline = textured ? s.keep(new api.CrossSection([textured])) : rect(p.width, p.depth, p.radius);
  let bin = s.keep(api.Manifold.extrude(outline, p.height));
  const layout = cellLayout(p);
  const cuts: Solid[] = [];
  const adds: Solid[] = [];
  layout.xs.forEach((x, col) => {
    layout.ys.forEach((y, row) => {
      const cw = layout.cellWidths[col], cd = layout.cellDepths[row];
      const innerR = Math.min(p.radius, cw / 2 - 0.01, cd / 2 - 0.01, 2);
      const cavity = s.keep(api.Manifold.extrude(rect(cw, cd, Math.max(innerR, 0)), layout.cavityHeight));
      cuts.push(s.keep(cavity.translate([x, y, p.floor])));
      if (p.floorHoles) {
        const radius = Math.min(cw, cd) * 0.22;
        cuts.push(s.keep(s.keep(api.Manifold.cylinder(p.floor + 2, radius, radius, 48, true)).translate([x, y, p.floor / 2])));
      }
      if (p.fingerScoops) {
        const v = Math.min(cd, layout.cavityHeight) * 0.45;
        const edge = y - cd / 2;
        const roller = s.keep(s.keep(s.keep(api.Manifold.cylinder(cw, v, v, 48, true)).rotate([0, 90, 0])).translate([x, edge + v, p.floor + v]));
        const block = s.keep(s.keep(api.Manifold.cube([cw, v, v], true)).translate([x, edge + v / 2, p.floor + v / 2]));
        adds.push(s.keep(block.subtract(roller)));
      }
    });
  });
  bin = s.keep(bin.subtract(s.keep(api.Manifold.union(cuts))));
  if (adds.length) bin = s.keep(bin.add(s.keep(api.Manifold.union(adds))));
  if (p.stackingLip) {
    const lip = Math.min(1.2, p.wall - 0.6);
    if (lip >= 0.4) {
      const lipHeight = Math.min(4, Math.max(1, p.height - 1));
      const base = rect(p.width, p.depth, p.radius);
      const offset = (delta: number) => s.keep(base.offset(delta, 'Round', undefined, SEGMENTS));
      const ring = s.keep(offset(-0.25).subtract(offset(-0.25 - lip)));
      const recess = s.keep(base.subtract(offset(-lip - 2 * 0.25)));
      bin = s.keep(bin.add(s.keep(s.keep(api.Manifold.extrude(ring, lipHeight)).translate([0, 0, p.height]))));
      bin = s.keep(bin.subtract(s.keep(api.Manifold.extrude(recess, lipHeight))));
    }
  }
  const tab = labelTab(api, s, p);
  if (tab) bin = s.keep(bin.add(tab));
  return bin;
}

export function toMeshArrays(solid: Solid): MeshArrays {
  const mesh = solid.getMesh();
  const stride = mesh.numProp || 3;
  const props = mesh.vertProperties;
  let positions: Float32Array;
  if (stride === 3) positions = new Float32Array(props);
  else {
    const count = props.length / stride;
    positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = props[i * stride];
      positions[i * 3 + 1] = props[i * stride + 1];
      positions[i * 3 + 2] = props[i * stride + 2];
    }
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) };
}

export type BuildResult = { bin: MeshArrays; info: BinInfo; status: string; label: LabelBuild | null; labelFits: boolean };

/**
 * Builds the bin (and, when the label is enabled, the snap-on plate + embossed text).
 * `textPolygons` are glyph outlines in mm at `label.fontSize`, y-up (see organizer-label-text.ts).
 */
export function buildOrganizer(api: ManifoldApi, p: OrganizerParams, label: LabelParams | null, textPolygons: Vec2[][] | null): BuildResult {
  const s = new Scope();
  try {
    let bin = buildBinSolid(api, s, p);
    let labelBuild: LabelBuild | null = null;
    let labelFits = true;
    if (label && label.enabled) {
      const box = textPolygons && textPolygons.length ? polygonBounds(textPolygons) : null;
      const layout = labelLayout(p, label, box ? { w: box.w, h: box.h } : null);
      labelFits = layout.fits;
      const { boss, cut } = labelBossAndCut(api, s, p, layout);
      bin = s.keep(s.keep(bin.add(boss)).subtract(cut));
      labelBuild = buildLabelParts(api, s, p, label, layout, textPolygons, box);
    }
    const volumeCm3 = bin.volume() / 1000;
    const triangles = bin.numTri();
    const layout = cellLayout(p);
    const uniformCells = !p.columnWidths && !p.rowDepths;
    const info: BinInfo = {
      bbox: [p.width, p.depth, p.height], compartments: p.cols * p.rows,
      cellInner: [layout.cellWidths[0], layout.cellDepths[0]], uniformCells,
      volumeCm3, weightPlaG: volumeCm3 * PLA_DENSITY, triangles,
    };
    return { bin: toMeshArrays(bin), info, status: String(bin.status()), label: labelBuild, labelFits };
  } finally {
    s.dispose();
  }
}

function buildLabelParts(
  api: ManifoldApi, s: Scope, p: OrganizerParams, label: LabelParams, l: LabelLayout,
  textPolygons: Vec2[][] | null, box: ReturnType<typeof polygonBounds>,
): LabelBuild {
  const front = -p.depth / 2;
  const { bossD, lipLayer, pocketD, clr, plateGap } = SNAP;
  const thickness = pocketD - lipLayer - plateGap;
  const plateFront = front - bossD + lipLayer;
  const plate = s.keep(s.keep(api.Manifold.cube([l.Wp - 2 * clr, thickness, l.Hp - 2 * clr], true))
    .translate([0, plateFront + thickness / 2, l.zc]));
  let text: Solid | null = null;
  if (textPolygons && textPolygons.length && box && l.scale > 0) {
    const scaled = textPolygons.map((ring) => ring.map(([x, y]) => [(x - box.cx) * l.scale, (y - box.cy) * l.scale] as Vec2));
    const section = s.keep(new api.CrossSection(scaled, 'EvenOdd'));
    text = s.keep(s.keep(s.keep(api.Manifold.extrude(section, label.embossDepth)).rotate([90, 0, 0])).translate([0, plateFront, l.zc]));
  }
  const whole = text ? s.keep(plate.add(text)) : plate;
  const bounds = whole.boundingBox();
  return {
    plate: toMeshArrays(plate),
    text: text ? toMeshArrays(text) : null,
    size: [bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2], bounds.max[1] - bounds.min[1]],
    triangles: whole.numTri(),
    volumeCm3: whole.volume() / 1000,
    fits: l.fits,
  };
}

export function polygonBounds(polygons: Vec2[][]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of polygons) for (const [x, y] of ring) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
