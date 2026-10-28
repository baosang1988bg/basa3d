import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { HANDBOOK_SECTIONS } from '../src/data/handbook/sections';
import { HANDBOOK_TOLERANCES } from '../src/data/handbook/tolerances';
import { HANDBOOK_DEFECTS } from '../src/data/handbook/troubleshooting';
import { HANDBOOK_PRESETS } from '../src/data/handbook/presets';
import type { HandbookBlock } from '../src/data/handbook/types';
import { computeFit, formatUm, parseDiameterMm, type FitOption } from '../src/lib/handbook/fit';
import { computePrintCost, formatVnd, parseGramsToMg, parseVnd, PRINT_COST_DEFAULTS, type PrintCostInput } from '../src/lib/handbook/print-cost';

// Phase 53 — Cẩm nang 2.0: interactive calculators. Pure tests: no DB, no server.

const read = (path: string) => readFileSync(path, 'utf8');
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const allBlocks = (): HandbookBlock[] => HANDBOOK_SECTIONS.flatMap((section) => section.blocks);
const sectionOf = (type: HandbookBlock['type']) => HANDBOOK_SECTIONS.find((s) => s.blocks.some((b) => b.type === type))?.id;
const option = (id: string): FitOption => {
  const row = HANDBOOK_TOLERANCES.find((t) => t.id === id);
  assert.ok(row, id);
  return { id: row.id, fit: row.fit, clearanceMm: row.clearanceMm };
};

// ── Bundle boundary ────────────────────────────────────────────────────────────────────────────

const HANDBOOK_DIR = 'src/components/storefront/handbook';
const EXPECTED_CLIENT_ISLANDS = ['fit-calculator.tsx', 'handbook-toc.tsx', 'interactive-checklist.tsx', 'material-table.tsx', 'print-cost-calculator.tsx'];

test('client islands are exactly the planned set and none imports values from src/data/handbook', () => {
  const clientFiles = readdirSync(HANDBOOK_DIR).filter((name) => /^'use client'/.test(read(`${HANDBOOK_DIR}/${name}`)));
  assert.deepEqual(clientFiles.sort(), EXPECTED_CLIENT_ISLANDS);
  for (const name of clientFiles) {
    const source = read(`${HANDBOOK_DIR}/${name}`);
    assert.deepEqual(source.match(/^import (?!type ).*from '@\/data\/handbook[^']*';$/gm) ?? [], [], name);
    // Rule #8 + bundle budget: islands use native controls, not the Base UI wrappers.
    assert.doesNotMatch(source, /from '@\/components\/ui\//, name);
  }
});

test('src/lib/handbook stays React-free (pure, importable from tests and islands)', () => {
  for (const name of readdirSync('src/lib/handbook')) {
    assert.doesNotMatch(read(`src/lib/handbook/${name}`), /from 'react'|^'use client'/m, name);
  }
});

// ── Placement ──────────────────────────────────────────────────────────────────────────────────

test('fit calculator appears once, in the tolerances chapter, right after the table', () => {
  assert.equal(allBlocks().filter((b) => b.type === 'fit-calculator').length, 1);
  assert.equal(sectionOf('fit-calculator'), 'dung-sai');
  const blocks = HANDBOOK_SECTIONS.find((s) => s.id === 'dung-sai')!.blocks.map((b) => b.type);
  assert.equal(blocks.indexOf('fit-calculator'), blocks.indexOf('tolerances') + 1);
});

test('the fit calculator only receives id/fit/clearanceMm (no note/example text in the RSC payload)', () => {
  assert.match(read(`${HANDBOOK_DIR}/handbook-blocks.tsx`), /HANDBOOK_TOLERANCES\.map\(\(\{ id, fit, clearanceMm \}\) => \(\{ id, fit, clearanceMm \}\)\)/);
});

// ── Fit math ───────────────────────────────────────────────────────────────────────────────────

test('parseDiameterMm accepts dot or Vietnamese comma and rejects everything else', () => {
  assert.equal(parseDiameterMm('8'), 8);
  assert.equal(parseDiameterMm(' 3,5 '), 3.5);
  assert.equal(parseDiameterMm('3.125'), 3.125);
  for (const bad of ['', ' ', 'abc', '-3', '3.5.1', '1e3', '3.1234', '1,000.5', 'Infinity', '0x10', '1234']) {
    assert.equal(parseDiameterMm(bad), null, bad);
  }
});

test('shaft-known: hole = d + 2 × clearance; matches the table example (M3 bolt → Ø3.40–3.60)', () => {
  const result = computeFit('shaft-known', '3', option('bolt-hole'));
  assert.ok(result.ok);
  assert.deepEqual(result.targetUm, [3400, 3600]);
  assert.deepEqual(result.clearanceUm, [200, 300]);
  assert.equal(`${formatUm(result.targetUm[0])}–${formatUm(result.targetUm[1])}`, '3.40–3.60');
});

test('hole-known: shaft = d − 2 × clearance, with min/max swapped so the range stays ordered', () => {
  const result = computeFit('hole-known', '8', option('sliding'));
  assert.ok(result.ok);
  assert.deepEqual(result.targetUm, [7400, 7600]);
});

test('integer µm arithmetic: no floating-point artefacts in output', () => {
  const result = computeFit('shaft-known', '0,7', option('press-fit'));
  assert.ok(result.ok);
  assert.deepEqual(result.targetUm, [800, 1000]);
  assert.equal(formatUm(result.targetUm[0]), '0.80');
});

test('every published tolerance row gives an ordered, positive result for a typical 8 mm part', () => {
  for (const row of HANDBOOK_TOLERANCES) {
    for (const mode of ['shaft-known', 'hole-known'] as const) {
      const result = computeFit(mode, '8', option(row.id));
      assert.ok(result.ok, `${row.id} ${mode}`);
      assert.ok(result.targetUm[0] > 0 && result.targetUm[0] <= result.targetUm[1], `${row.id} ${mode}`);
    }
  }
});

test('invalid, empty, out-of-range and impossible inputs return a reason instead of throwing', () => {
  assert.deepEqual(computeFit('shaft-known', '', option('sliding')), { ok: false, reason: 'empty' });
  assert.deepEqual(computeFit('shaft-known', 'abc', option('sliding')), { ok: false, reason: 'invalid' });
  assert.deepEqual(computeFit('shaft-known', '0.2', option('sliding')), { ok: false, reason: 'out-of-range' });
  assert.deepEqual(computeFit('shaft-known', '600', option('sliding')), { ok: false, reason: 'out-of-range' });
  assert.deepEqual(computeFit('hole-known', '0.8', option('print-in-place')), { ok: false, reason: 'no-room' });
});

test('fit calculator warns against double compensation (CAD clearance + slicer hole compensation)', () => {
  assert.match(read(`${HANDBOOK_DIR}/fit-calculator.tsx`), /Chỉ chọn một trong hai/);
});

// ── Home-printing cost (B1: never a BaSa3D price; rule #2: integer VND) ────────────────────────

const costWith = (patch: Partial<PrintCostInput>) => computePrintCost({ ...PRINT_COST_DEFAULTS, ...patch });

test('cost calculator sits in the slicer chapter, once, and gets its CTA from the server-side resolver', () => {
  assert.equal(allBlocks().filter((b) => b.type === 'cost-calculator').length, 1);
  assert.equal(sectionOf('cost-calculator'), 'slicer');
  assert.match(read(`${HANDBOOK_DIR}/handbook-blocks.tsx`), /resolveHandbookToolLink\('bao-gia', \{ baoGiaEnabled \}\)/);
});

test('B1: the cost calculator never touches BaSa3D pricing (DB is the only source of truth)', () => {
  for (const path of ['src/lib/handbook/print-cost.ts', `${HANDBOOK_DIR}/print-cost-calculator.tsx`]) {
    const source = code(path);
    assert.doesNotMatch(source, /from '@\/(services|config\/bao-gia|lib\/(pricing|quote))/, path);
    assert.doesNotMatch(source, /pricing_config|pricingConfig/i, path);
  }
  assert.match(read(`${HANDBOOK_DIR}/print-cost-calculator.tsx`), /không phải giá in của BaSa3D/i);
});

test('cost calculator CTA is server-rendered children: the island imports no Link, icon or button code', () => {
  const island = code(`${HANDBOOK_DIR}/print-cost-calculator.tsx`);
  assert.doesNotMatch(island, /from '(lucide-react|@\/i18n\/navigation|@\/components\/storefront\/button)'/);
  assert.match(island, /\{children\}/);
});

test('default example: 50 g × 300.000 ₫/kg + 150 W × 2h30 × 3.000 ₫/kWh + 10 %', () => {
  const result = computePrintCost(PRINT_COST_DEFAULTS);
  assert.ok(result.ok);
  assert.equal(result.filamentVnd, 15_000);
  assert.equal(result.electricityVnd, 1_125); // 0.375 kWh × 3000
  assert.equal(result.bufferVnd, 1_613); // round(16 125 × 10 %) = round(1612.5)
  assert.equal(result.totalVnd, 17_738);
  assert.equal(result.energyWh, 375);
});

test('every money output is an integer and the total is the exact sum of its lines', () => {
  for (const patch of [{ grams: '48,62', pricePerKg: '289.999' }, { grams: '0.01' }, { hours: '0', minutes: '7', kwhPrice: '2.871' }, { grams: '9999.99', pricePerKg: '20.000.000', hours: '999', minutes: '59', powerW: '5000', kwhPrice: '20.000', bufferPercent: '100' }]) {
    const result = costWith(patch);
    assert.ok(result.ok, JSON.stringify(patch));
    for (const value of [result.filamentVnd, result.electricityVnd, result.bufferVnd, result.totalVnd]) assert.ok(Number.isSafeInteger(value), JSON.stringify(patch));
    assert.equal(result.totalVnd, result.filamentVnd + result.electricityVnd + result.bufferVnd);
  }
});

test('parsers: VND accepts grouped thousands, grams accept a decimal comma, nothing is guessed', () => {
  for (const [raw, expected] of [['300000', 300000], ['300.000', 300000], ['300,000', 300000], ['300 000', 300000], ['1.250.000', 1250000], ['0', 0]] as const) {
    assert.equal(parseVnd(raw), expected, raw);
  }
  for (const bad of ['', '3,5', '300.00', '-5', '1e6', '12.3456.789', 'abc', '1234567890']) assert.equal(parseVnd(bad), null, bad);
  assert.equal(parseGramsToMg('48,62'), 48_620);
  assert.equal(parseGramsToMg('48.6'), 48_600);
  for (const bad of ['1.250', '1,250,0', '-1', 'abc', '']) assert.equal(parseGramsToMg(bad), null, bad);
});

test('invalid and out-of-range fields are reported per field, never thrown', () => {
  const result = costWith({ grams: 'abc', minutes: '75', bufferPercent: '101', powerW: '' });
  assert.deepEqual(result, { ok: false, errors: { grams: 'invalid', minutes: 'out-of-range', bufferPercent: 'out-of-range', powerW: 'invalid' } });
  assert.equal(costWith({ grams: '10001' }).ok, false);
});

test('formatVnd uses Vietnamese grouping and the ₫ sign', () => {
  assert.equal(formatVnd(17_738), '17.738 ₫');
  assert.equal(formatVnd(0), '0 ₫');
});

// ── Defect photos (B2: own workshop photos only; CLS-safe; zero client JS) ─────────────────────

test('defect photo toggle is a server component driven by native radios + CSS :has()', () => {
  const source = read(`${HANDBOOK_DIR}/defect-photo-toggle.tsx`);
  assert.doesNotMatch(source, /^'use client'/m);
  assert.doesNotMatch(source, /useState|useEffect|onClick|onChange|onInput/);
  assert.match(source, /type="radio"/);
  assert.match(source, /group-has-\[\.cmp-fixed:checked\]\/cmp:opacity-0/);
  assert.match(code(`${HANDBOOK_DIR}/troubleshooting-table.tsx`), /\{defect\.photos && <DefectPhotoToggle /);
});

test('every declared defect photo exists in public/, is WebP/AVIF, has real alt text and a matching pair ratio', () => {
  for (const defect of HANDBOOK_DEFECTS) {
    if (!defect.photos) continue;
    const { failed, fixed, credit } = defect.photos;
    assert.ok(credit.trim(), `${defect.id} credit`);
    for (const photo of [failed, fixed]) {
      assert.match(photo.src, /^\/images\/handbook\/defects\/[a-z0-9-]+\.(webp|avif)$/, photo.src);
      assert.ok(existsSync(`public${photo.src}`), `missing public${photo.src}`);
      assert.ok(Number.isInteger(photo.width) && Number.isInteger(photo.height) && photo.width > 0 && photo.height > 0, photo.src);
      assert.ok(photo.alt.trim().length >= 15, `${photo.src} alt too short`);
      assert.doesNotMatch(photo.alt, /^(ảnh|hình|image|photo)\b/i, `${photo.src} alt should describe the print, not say "ảnh"`);
    }
    assert.notEqual(failed.src, fixed.src, defect.id);
    assert.equal(failed.width * fixed.height, fixed.width * failed.height, `${defect.id} pair aspect ratio`);
  }
});

// ── Slicer presets (B3: Filament & Process only; no machine G-code; versioned files) ───────────

test('presets block appears in chapter 04 (slicer) and is rendered by a server component', () => {
  assert.equal(allBlocks().filter((b) => b.type === 'presets').length, 1);
  assert.equal(sectionOf('presets'), 'slicer');
  const source = read(`${HANDBOOK_DIR}/slicer-presets.tsx`);
  assert.doesNotMatch(source, /^'use client'/m);
  assert.doesNotMatch(source, /useState|useEffect/);
});

test('every preset in HANDBOOK_PRESETS exists, parses, follows naming, and contains no machine G-code', () => {
  const PRESET_FILENAME_RE = /^basa3d_[a-z0-9-]+_(bambu-studio|orcaslicer|prusaslicer)_[a-z0-9-]+_\d+(?:\.\d+)?mm_v\d{4}-\d{2}\.json$/;

  function assertCleanJson(value: unknown, path = 'root'): void {
    if (value == null) return;
    if (typeof value === 'string') {
      assert.doesNotMatch(value, /gcode/i, `Forbidden G-code reference in value at ${path}`);
      assert.doesNotMatch(value, /\/Users\/|[a-zA-Z]:\\\\/, `Forbidden absolute path in value at ${path}`);
      assert.doesNotMatch(value, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, `Forbidden email in value at ${path}`);
      return;
    }
    if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        assert.doesNotMatch(key, /gcode/i, `Forbidden G-code reference in key "${key}" at ${path}`);
        assert.doesNotMatch(key, /\/Users\/|[a-zA-Z]:\\\\/, `Forbidden absolute path in key "${key}" at ${path}`);
        assert.doesNotMatch(key, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, `Forbidden email in key "${key}" at ${path}`);
        assertCleanJson(val, `${path}.${key}`);
      }
    }
  }

  for (const preset of HANDBOOK_PRESETS) {
    assert.match(preset.file, PRESET_FILENAME_RE, `${preset.id} filename format`);
    assert.notEqual(preset.kind, 'machine', `${preset.id} must not be a machine preset (B3)`);
    assert.ok(preset.kind === 'filament' || preset.kind === 'process', `${preset.id} kind`);
    const diskPath = `public/downloads/presets/${preset.file}`;
    assert.ok(existsSync(diskPath), `Preset file missing at ${diskPath}`);
    const raw = readFileSync(diskPath, 'utf8');
    const parsed = JSON.parse(raw);
    assertCleanJson(parsed, preset.file);
  }
});
