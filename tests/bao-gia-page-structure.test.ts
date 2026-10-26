import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import React, { type ReactElement, type ReactNode } from 'react';
import { QuoteWorkspace } from '../src/components/bao-gia/quote-workspace';

Object.assign(globalThis, { React });

const dispatcher = {
  useState: (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, () => {}],
  useEffect: () => {},
  useRef: (init: unknown) => ({ current: init }),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useContext: () => ({}),
};
const internals = (React as unknown as { H?: unknown }).H
  ? (React as unknown as { H: unknown })
  : (React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: { H: unknown } })
      .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
if (internals) internals.H = dispatcher;

const mockCtx = {
  config: { electricityVndPerKwh: 3500, machinePriceVnd: 15_000_000, machineLifetimeHours: 10_000, printerPowerKw: 0.2, laborVndPerHour: 35_000, failureBufferPct: 10, marginPct: 40, packagingFeeVnd: 5000 },
  medians: new Map([['PLA', 300], ['PETG', 350]]),
  pricingConfigId: '00000000-0000-4000-8000-0000000000c1',
};

mock.module('../src/i18n/navigation.ts', {
  namedExports: {
    useRouter: () => ({ push: () => {} }),
    Link: ({ children, href, ...props }: { children?: ReactNode; href: string }) =>
      React.createElement('a', { href, ...props }, children),
  },
});

mock.module('../src/config/bao-gia.ts', {
  namedExports: {
    isBaoGiaEnabled: () => true,
    BAO_GIA_RESPONSE_TIME_TEXT: 'trong 15–30 phút',
    BAO_GIA_MAX_ITEMS: 10,
  },
});

mock.module('../src/services/instant-estimate.service.ts', {
  namedExports: {
    loadPricingContext: async () => mockCtx,
    estimateFromMeshMetrics: () => ({ status: 'OK', lineSubtotalVnd: 50000 }),
  },
});

const { default: BaoGiaPage } = await import('../src/app/[locale]/(storefront)/bao-gia/page');

test('BaoGiaPage renders with default link tab', async () => {
  const tree = (await BaoGiaPage({})) as ReactElement<{ children: ReactNode[] }>;
  assert.ok(tree);
  const children = React.Children.toArray(tree.props.children) as ReactElement<{
    initialTab: string;
    samples: unknown[];
    materials: unknown[];
  }>[];
  const workspace = children.find(
    (c) => c && c.type && typeof c.type === 'function' && c.type.name === 'QuoteWorkspace'
  );
  assert.ok(workspace, 'QuoteWorkspace element should be rendered');
  assert.equal(workspace.props.initialTab, 'link');
  assert.ok(Array.isArray(workspace.props.samples));
  assert.ok(Array.isArray(workspace.props.materials));
});

test('BaoGiaPage renders with file tab when requested in searchParams', async () => {
  const tree = (await BaoGiaPage({
    searchParams: Promise.resolve({ tab: 'file' }),
  })) as ReactElement<{ children: ReactNode[] }>;
  const children = React.Children.toArray(tree.props.children) as ReactElement<{
    initialTab: string;
  }>[];
  const workspace = children.find(
    (c) => c && c.type && typeof c.type === 'function' && c.type.name === 'QuoteWorkspace'
  );
  assert.ok(workspace, 'QuoteWorkspace element should be rendered');
  assert.equal(workspace.props.initialTab, 'file');
});

test('QuoteWorkspace structure separates file upload and link quotation into 2 tabs', () => {
  const element = QuoteWorkspace({
    materials: ['PLA', 'PETG'],
    samples: [
      { key: 's1', title: 'Sample 1', description: 'Desc 1', priceVnd: 50000 },
    ],
    initialTab: 'link',
  }) as ReactElement<{ children: ReactNode[] }>;

  assert.ok(element);
  const children = React.Children.toArray(element.props.children) as ReactElement[];
  // Tablist switcher
  const tablist = children[0] as ReactElement<{ role: string; children: ReactNode[] }>;
  assert.equal(tablist.props.role, 'tablist');
  const tabs = React.Children.toArray(tablist.props.children) as ReactElement<{
    id: string;
    'aria-selected': boolean;
  }>[];
  assert.equal(tabs.length, 2, 'Should have exactly 2 main option tabs: link and file');

  const linkTab = tabs[0];
  const fileTab = tabs[1];
  assert.equal(linkTab.props.id, 'tab-bao-gia-link');
  assert.equal(linkTab.props['aria-selected'], true);
  assert.equal(fileTab.props.id, 'tab-bao-gia-file');
  assert.equal(fileTab.props['aria-selected'], false);

  // Helper to find span containing text
  function findSpanWithText(node: unknown, text: string): ReactElement<{ className?: string }> | null {
    if (!node || typeof node !== 'object') return null;
    const elem = node as ReactElement<{ children?: ReactNode; className?: string }>;
    if (elem.type === 'span') {
      const childrenArr = React.Children.toArray(elem.props?.children);
      if (childrenArr.some((c) => typeof c === 'string' && c.includes(text))) {
        return elem;
      }
    }
    if (elem.props?.children) {
      for (const child of React.Children.toArray(elem.props.children)) {
        const found = findSpanWithText(child, text);
        if (found) return found;
      }
    }
    return null;
  }

  // Active tab "link": badge "Dán link / Tìm mẫu" illuminates with primary colors
  const linkBadgeActive = findSpanWithText(linkTab, 'Dán link / Tìm mẫu');
  assert.ok(linkBadgeActive, 'Badge "Dán link / Tìm mẫu" should be rendered');
  assert.ok(
    linkBadgeActive.props.className?.includes('bg-primary text-primary-foreground'),
    'Badge should be highlighted with bg-primary text-primary-foreground when selected'
  );

  // Inactive tab "file": badge "File có sẵn (.STL / .OBJ)" is subdued
  const fileBadgeInactive = findSpanWithText(fileTab, 'File có sẵn');
  assert.ok(fileBadgeInactive, 'Badge "File có sẵn" should be rendered');
  assert.ok(
    fileBadgeInactive.props.className?.includes('bg-secondary text-secondary-foreground'),
    'Badge should be subdued with bg-secondary when not selected'
  );

  // Panels
  const linkPanel = children[1] as ReactElement<{ id: string }>;
  const filePanel = children[2] as ReactElement<{ id: string }>;
  assert.equal(linkPanel.props.id, 'panel-bao-gia-link');
  assert.equal(filePanel.props.id, 'panel-bao-gia-file');
});

test('QuoteWorkspace highlights file badge when file tab is active', () => {
  const element = QuoteWorkspace({
    materials: ['PLA'],
    samples: [],
    initialTab: 'file',
  }) as ReactElement<{ children: ReactNode[] }>;

  function findSpanWithText(node: unknown, text: string): ReactElement<{ className?: string }> | null {
    if (!node || typeof node !== 'object') return null;
    const elem = node as ReactElement<{ children?: ReactNode; className?: string }>;
    if (elem.type === 'span') {
      const childrenArr = React.Children.toArray(elem.props?.children);
      if (childrenArr.some((c) => typeof c === 'string' && c.includes(text))) {
        return elem;
      }
    }
    if (elem.props?.children) {
      for (const child of React.Children.toArray(elem.props.children)) {
        const found = findSpanWithText(child, text);
        if (found) return found;
      }
    }
    return null;
  }

  const children = React.Children.toArray(element.props.children) as ReactElement[];
  const tablist = children[0] as ReactElement<{ role: string; children: ReactNode[] }>;
  const tabs = React.Children.toArray(tablist.props.children) as ReactElement[];

  const linkBadge = findSpanWithText(tabs[0], 'Dán link / Tìm mẫu');
  const fileBadge = findSpanWithText(tabs[1], 'File có sẵn');

  assert.ok(
    linkBadge?.props.className?.includes('bg-secondary text-secondary-foreground'),
    'Link badge should be subdued when file tab is selected'
  );
  assert.ok(
    fileBadge?.props.className?.includes('bg-primary text-primary-foreground'),
    'File badge should be highlighted when file tab is selected'
  );
});
