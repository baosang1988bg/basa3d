import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { HANDBOOK_SECTIONS, HANDBOOK_TOC, HANDBOOK_UPDATED_AT } from '../src/data/handbook/sections';
import { HANDBOOK_MATERIALS } from '../src/data/handbook/materials';
import { HANDBOOK_TOLERANCES } from '../src/data/handbook/tolerances';
import { HANDBOOK_DEFECTS } from '../src/data/handbook/troubleshooting';
import { HANDBOOK_CHECKLIST } from '../src/data/handbook/checklist';
import { HANDBOOK_TOOL_ROUTES, resolveHandbookToolLink } from '../src/data/handbook/tool-links';
import type { HandbookBlock, HandbookToolId } from '../src/data/handbook/types';
import { CHECKLIST_STORAGE_KEY, parseChecklistState, serializeChecklistState } from '../src/lib/handbook/checklist-storage';
import { handbookRedirects } from '../src/config/handbook-redirects.mjs';
import { isKnowledgeSectionActive, KNOWLEDGE_NAV_ITEMS, visibleKnowledgeNavItems } from '../src/config/knowledge-nav';

// Phase 50 — Cẩm nang in 3D (`/cam-nang`). Pure tests: no DB, no server.

const read = (path: string) => readFileSync(path, 'utf8');
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const allBlocks = (): HandbookBlock[] => HANDBOOK_SECTIONS.flatMap((section) => section.blocks);
const PAGE = 'src/app/[locale]/(storefront)/cam-nang/page.tsx';

// ── Content ────────────────────────────────────────────────────────────────────────────────────

test('handbook has nine chapters numbered 01–09 with unique, URL-safe anchor ids', () => {
  assert.equal(HANDBOOK_SECTIONS.length, 9);
  assert.deepEqual(HANDBOOK_SECTIONS.map((s) => s.number), ['01', '02', '03', '04', '05', '06', '07', '08', '09']);
  const ids = HANDBOOK_SECTIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, id);
  for (const section of HANDBOOK_SECTIONS) {
    assert.ok(section.title.trim() && section.summary.trim() && section.blocks.length > 0, section.id);
  }
});

test('the TOC passed to the client carries only id/number/title, in chapter order', () => {
  assert.deepEqual(HANDBOOK_TOC, HANDBOOK_SECTIONS.map(({ id, number, title }) => ({ id, number, title })));
  for (const item of HANDBOOK_TOC) assert.deepEqual(Object.keys(item).sort(), ['id', 'number', 'title']);
});

test('each reference block appears exactly once', () => {
  for (const type of ['materials', 'tolerances', 'troubleshooting', 'checklist'] as const) {
    assert.equal(allBlocks().filter((b) => b.type === type).length, 1, type);
  }
});

test('reference tables have the planned sizes, unique ids and sane ranges', () => {
  assert.equal(HANDBOOK_MATERIALS.length, 7);
  assert.equal(HANDBOOK_DEFECTS.length, 8);
  assert.equal(HANDBOOK_CHECKLIST.length, 7);
  assert.ok(HANDBOOK_TOLERANCES.length >= 4);
  for (const list of [HANDBOOK_MATERIALS, HANDBOOK_TOLERANCES, HANDBOOK_DEFECTS, HANDBOOK_CHECKLIST]) {
    const ids = list.map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  for (const m of HANDBOOK_MATERIALS) {
    for (const [min, max] of [m.nozzleC, m.bedC, m.dryingC, m.dryingHours, m.fanPercent]) assert.ok(min <= max, `${m.id} range`);
    assert.ok(m.nozzleC[0] >= 180 && m.nozzleC[1] <= 320, `${m.id} nozzle`);
    assert.ok(m.bedC[1] <= 130, `${m.id} bed`);
    assert.ok(m.dryingC[1] < m.nozzleC[0], `${m.id} drying below melt`);
    assert.ok(m.fanPercent[0] >= 0 && m.fanPercent[1] <= 100, `${m.id} fan`);
  }
  for (const t of HANDBOOK_TOLERANCES) {
    assert.ok(t.clearanceMm[0] >= 0 && t.clearanceMm[0] <= t.clearanceMm[1] && t.clearanceMm[1] <= 1, t.id);
  }
  for (const d of HANDBOOK_DEFECTS) assert.ok(d.fixes.length >= 3, d.id);
});

test('HANDBOOK_UPDATED_AT is a fixed ISO date (not the build time)', () => {
  assert.match(HANDBOOK_UPDATED_AT, /^\d{4}-\d{2}-\d{2}$/);
});

// ── B1: ecosystem links ────────────────────────────────────────────────────────────────────────

const pageExistsFor = (href: string) => {
  const appDir = 'src/app/[locale]';
  return readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\(.+\)$/.test(entry.name))
    .some((group) => existsSync(`${appDir}/${group.name}${href}/page.tsx`));
};

test('every tool route resolves to a real page.tsx (no /tools/keychain-style 404s)', () => {
  for (const [toolId, route] of Object.entries(HANDBOOK_TOOL_ROUTES)) {
    assert.ok(pageExistsFor(route.href), `${toolId} → ${route.href} has no page`);
  }
});

test('chapters link to the planned tools', () => {
  const toolsBySection = Object.fromEntries(
    HANDBOOK_SECTIONS.map((s) => [s.number, s.blocks.flatMap((b) => (b.type === 'tool' ? [b.toolId] : []))]),
  );
  const expected: Record<string, HandbookToolId[]> = {
    '03': ['bao-gia'], '04': ['organizer'], '06': ['keychain-blocks'], '07': ['hinge-box'], '08': ['bao-gia'], '09': ['custom-print'],
  };
  for (const [number, tools] of Object.entries(expected)) assert.deepEqual(toolsBySection[number], tools, `chapter ${number}`);
});

test('/bao-gia callouts fall back to /custom-print (with their own copy) when the flag is off', () => {
  assert.deepEqual(resolveHandbookToolLink('bao-gia', { baoGiaEnabled: true }), { toolId: 'bao-gia', ...HANDBOOK_TOOL_ROUTES['bao-gia'], isFallback: false });
  const off = resolveHandbookToolLink('bao-gia', { baoGiaEnabled: false });
  assert.equal(off.href, '/custom-print');
  assert.equal(off.isFallback, true);
  assert.equal(resolveHandbookToolLink('hinge-box', { baoGiaEnabled: false }).href, '/tools/hinge-box');
  for (const block of allBlocks()) {
    if (block.type === 'tool' && block.toolId === 'bao-gia') {
      assert.ok(block.fallback, `"${block.title}" needs fallback copy`);
      assert.doesNotMatch(block.fallback.text, /tức thì|ngay khi tải/i);
    }
  }
});

// ── Checklist persistence (rule #6: localStorage is external input) ────────────────────────────

const IDS = HANDBOOK_CHECKLIST.map((item) => item.id);

test('checklist storage key is versioned', () => {
  assert.equal(CHECKLIST_STORAGE_KEY, 'basa3d_preflight_checklist:v1');
});

test('parseChecklistState never throws and drops anything it does not recognise', () => {
  for (const raw of [null, undefined, '', 'not json', '42', 'null', '[]', '{}', '{"checked":"clean-bed"}', '{"checked":[1,null,{}]}']) {
    assert.deepEqual(parseChecklistState(raw, IDS), [], String(raw));
  }
  assert.deepEqual(parseChecklistState('{"checked":["preview","removed-step","clean-bed","clean-bed"]}', IDS), ['clean-bed', 'preview']);
});

test('serialize → parse round-trips in checklist order and ignores unknown ids', () => {
  const raw = serializeChecklistState(['watch-first-layer', 'ghost', 'clean-bed'], IDS);
  assert.equal(raw, '{"checked":["clean-bed","watch-first-layer"]}');
  assert.deepEqual(parseChecklistState(raw, IDS), ['clean-bed', 'watch-first-layer']);
});

// ── B2: redirects ──────────────────────────────────────────────────────────────────────────────

test('/handbook aliases redirect permanently to the final URL in one hop', () => {
  const asMap = (enabled: boolean) => Object.fromEntries(handbookRedirects(enabled).map((r) => [r.source, r]));
  const off = asMap(false);
  const on = asMap(true);
  assert.equal(off['/handbook'].destination, '/cam-nang');
  assert.equal(off['/vi/handbook'].destination, '/cam-nang');
  assert.equal(off['/en/handbook'].destination, '/cam-nang');
  assert.equal(on['/en/handbook'].destination, '/en/cam-nang');
  for (const rule of [...handbookRedirects(false), ...handbookRedirects(true)]) {
    assert.equal(rule.permanent, true);
    // Literal sources only — a `/:locale/handbook` param would also catch `/products/handbook`.
    assert.doesNotMatch(rule.source, /[:(*]/);
  }
});

test('next.config wires the redirects with the same EN flag as src/i18n/routing.ts', () => {
  const config = code('next.config.mjs');
  assert.match(config, /redirects\(\)\s*\{\s*return handbookRedirects\(process\.env\.NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED === 'true'\)/);
  assert.match(code('src/i18n/routing.ts'), /process\.env\.NEXT_PUBLIC_LANGUAGE_SWITCHER_ENABLED === 'true'/);
});

// ── B3: static rendering + bundle boundary ─────────────────────────────────────────────────────

test('/cam-nang stays static: locale set in page and metadata, nothing that reads the request', () => {
  const page = code(PAGE);
  assert.equal(page.match(/await applyRequestLocale\(params\)/g)?.length, 2);
  assert.doesNotMatch(page, /export const (dynamic|revalidate)|cookies\(|headers\(|connection\(|from '@\/services\//);
  assert.doesNotMatch(page, /^'use client'/m);
});

test('JSON-LD is TechArticle + BreadcrumbList, serialized safely, without HowTo/FAQPage', () => {
  const page = code(PAGE);
  assert.match(page, /'@type': 'TechArticle'/);
  assert.match(page, /'@type': 'BreadcrumbList'/);
  assert.match(page, /serializeJsonLd\(jsonLd\)/);
  assert.doesNotMatch(page, /HowTo|FAQPage/);
});

test('client islands never import values from src/data/handbook (would ship all chapters to the browser)', () => {
  const dir = 'src/components/storefront/handbook';
  const clientFiles = readdirSync(dir).filter((name) => /^'use client'/.test(read(`${dir}/${name}`)));
  // Phase 53 adds islands; tests/phase-53-handbook-interactive.test.ts owns the up-to-date list.
  for (const name of ['handbook-toc.tsx', 'interactive-checklist.tsx', 'material-table.tsx']) assert.ok(clientFiles.includes(name), name);
  for (const name of clientFiles) {
    const source = read(`${dir}/${name}`);
    const valueImports = source.match(/^import (?!type ).*from '@\/data\/handbook[^']*';$/gm) ?? [];
    assert.deepEqual(valueImports, [], name);
  }
});

test('scroll-spy uses a single-threshold observer below the sticky chrome, no scroll listener', () => {
  const toc = code('src/components/storefront/handbook/handbook-toc.tsx');
  assert.match(toc, /rootMargin: '-112px 0px -55% 0px', threshold: 0/);
  assert.doesNotMatch(toc, /addEventListener\('scroll'/);
  assert.doesNotMatch(toc, /\.scrollIntoView\(\{[^}]*inline/);
});

test('checklist reads storage only through useSyncExternalStore with an empty server snapshot', () => {
  const checklist = code('src/components/storefront/handbook/interactive-checklist.tsx');
  assert.match(checklist, /useSyncExternalStore\(subscribe, readSnapshot, getServerSnapshot\)/);
  assert.match(checklist, /const getServerSnapshot = \(\) => null;/);
  assert.doesNotMatch(checklist, /useState\(\(\) =>[^)]*localStorage/);
});

// ── Navigation & SEO wiring ────────────────────────────────────────────────────────────────────

test('"Kiến thức in 3D" dropdown: handbook first, anchors point at real chapters, blog follows its flag', () => {
  assert.equal(KNOWLEDGE_NAV_ITEMS[0].href, '/cam-nang');
  const sectionIds = new Set(HANDBOOK_SECTIONS.map((s) => s.id));
  for (const item of KNOWLEDGE_NAV_ITEMS) {
    const [path, anchor] = item.href.split('#');
    assert.ok(pageExistsFor(path), `${item.key} → ${path} has no page`);
    if (anchor) assert.ok(sectionIds.has(anchor), `${item.key} → #${anchor} is not a handbook chapter`);
  }
  assert.ok(!visibleKnowledgeNavItems({ blogEnabled: false }).some((i) => i.key === 'blog'));
  assert.ok(visibleKnowledgeNavItems({ blogEnabled: true }).some((i) => i.key === 'blog'));
  assert.equal(isKnowledgeSectionActive('/cam-nang'), true);
  assert.equal(isKnowledgeSectionActive('/blog/abc'), true);
  assert.equal(isKnowledgeSectionActive('/blogger'), false);
  assert.equal(isKnowledgeSectionActive('/tools'), false);
  for (const locale of ['vi', 'en']) {
    const nav = (JSON.parse(read(`messages/${locale}.json`)) as { nav: { knowledge: string; knowledgeItems: Record<string, { title: string; description: string }> } }).nav;
    assert.ok(nav.knowledge, `${locale} nav.knowledge`);
    for (const item of KNOWLEDGE_NAV_ITEMS) {
      assert.ok(nav.knowledgeItems[item.key]?.title && nav.knowledgeItems[item.key]?.description, `${locale} nav.knowledgeItems.${item.key}`);
    }
  }
});

test('the dropdown is a keyboard/touch-safe disclosure, and the Header never imports handbook content', () => {
  const menu = code('src/components/storefront/knowledge-menu.tsx');
  assert.match(menu, /aria-expanded=\{isOpen\}/);
  assert.match(menu, /event\.pointerType !== 'mouse'/);
  assert.match(menu, /event\.key !== 'Escape'/);
  assert.match(menu, /motion-safe:animate-dropdown-in/);
  for (const path of ['src/components/storefront/header.tsx', 'src/components/storefront/knowledge-menu.tsx', 'src/config/knowledge-nav.ts']) {
    assert.doesNotMatch(read(path), /from '@\/data\/handbook\/(?!types)/, path);
  }
});

test('/cam-nang is linked from header (dropdown), footer and listed in the sitemap', () => {
  assert.match(code('src/components/storefront/header.tsx'), /<KnowledgeMenu key="knowledge" items=\{knowledgeItems\}/);
  assert.match(code('src/components/storefront/footer.tsx'), /href="\/cam-nang"/);
  assert.match(code('src/app/sitemap.ts'), /path: '\/cam-nang'/);
  for (const locale of ['vi', 'en']) {
    const messages = JSON.parse(read(`messages/${locale}.json`)) as { nav: Record<string, string> };
    assert.ok(messages.nav.handbook, `messages/${locale}.json nav.handbook`);
  }
});
