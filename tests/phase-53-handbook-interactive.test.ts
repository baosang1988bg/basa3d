import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { HANDBOOK_SECTIONS } from '../src/data/handbook/sections';
import { HANDBOOK_TOLERANCES } from '../src/data/handbook/tolerances';
import type { HandbookBlock } from '../src/data/handbook/types';
import { computeFit, formatUm, parseDiameterMm, type FitOption } from '../src/lib/handbook/fit';

// Phase 53 — Cẩm nang 2.0: interactive calculators. Pure tests: no DB, no server.

const read = (path: string) => readFileSync(path, 'utf8');
const allBlocks = (): HandbookBlock[] => HANDBOOK_SECTIONS.flatMap((section) => section.blocks);
const sectionOf = (type: HandbookBlock['type']) => HANDBOOK_SECTIONS.find((s) => s.blocks.some((b) => b.type === type))?.id;
const option = (id: string): FitOption => {
  const row = HANDBOOK_TOLERANCES.find((t) => t.id === id);
  assert.ok(row, id);
  return { id: row.id, fit: row.fit, clearanceMm: row.clearanceMm };
};

// ── Bundle boundary ────────────────────────────────────────────────────────────────────────────

const HANDBOOK_DIR = 'src/components/storefront/handbook';
const EXPECTED_CLIENT_ISLANDS = ['fit-calculator.tsx', 'handbook-toc.tsx', 'interactive-checklist.tsx', 'material-table.tsx'];

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
