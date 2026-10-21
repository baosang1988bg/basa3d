import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Phase 43 (docs/exec-plans/active/phase-43-storefront-motion.md) — storefront motion guards.

const read = (path: string) => readFileSync(path, 'utf8');
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('scroll reveal is pure CSS, gated by reduced-motion and feature support, and animates `translate` not `transform`', () => {
  const css = read('src/app/globals.css');
  const reveal = css.slice(css.indexOf('@keyframes reveal-up'));
  assert.match(reveal, /translate: 0 16px/);
  assert.doesNotMatch(reveal.slice(0, reveal.indexOf('}', reveal.indexOf('to {')) + 1), /transform/,
    'a `transform` keyframe with fill-mode both would cancel every hover:-translate-y-* on revealed cards');
  assert.match(reveal, /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*@supports \(animation-timeline: view\(\)\)/);
  assert.match(reveal, /animation-timeline: view\(\)/);
});

test('every new keyframe animation used in components is motion-safe', () => {
  for (const path of [
    'src/components/storefront/header.tsx',
    'src/components/storefront/zalo-floating-button.tsx',
    'src/app/[locale]/(storefront)/page.tsx',
    'src/app/[locale]/(storefront)/template.tsx',
  ]) {
    const source = code(path);
    for (const match of source.matchAll(/(\S*)animate-(badge-pop|soft-ping|draw-line|page-enter)\b/g)) {
      assert.match(match[1], /motion-safe:$/, `${path}: animate-${match[2]} must be prefixed with motion-safe:`);
    }
  }
  assert.doesNotMatch(code('src/components/storefront/zalo-floating-button.tsx'), /animate-ping/);
});

test('page transition never runs on the first load (LCP, hydration) — only after a client navigation', () => {
  const template = code('src/app/[locale]/(storefront)/template.tsx');
  assert.match(template, /let hasMountedOnce = false;/);
  assert.match(template, /useState\(\(\) => hasMountedOnce\)/);
  assert.match(template, /hasMountedOnce = true;/);
});

test('mobile drawer sits outside the backdrop-blurred header, stays mounted, and is inert while closed', () => {
  const header = code('src/components/storefront/header.tsx');
  const headerClose = header.indexOf('</header>');
  const drawer = header.indexOf('id="storefront-mobile-menu"');
  assert.ok(headerClose > 0 && drawer > headerClose, 'the drawer must be rendered after </header>, not inside it');
  assert.match(header, /inert=\{!isMenuOpen\}/);
  assert.doesNotMatch(header, /\{isMenuOpen && \(/, 'conditional rendering cannot animate out');
  assert.match(header, /event\.key === 'Escape'/);
});

test('cart badge only pops after the stored cart has loaded', () => {
  assert.match(code('src/lib/cart/cart-context.tsx'), /isReady: isInitialized/);
  assert.match(code('src/components/storefront/header.tsx'), /if \(!isReady\) return;/);
});

test('home FAQ is an animated accordion, not <details> (ui-ux rule I30)', () => {
  assert.doesNotMatch(code('src/app/[locale]/(storefront)/page.tsx'), /<details|<summary/);
  const accordion = code('src/components/storefront/faq-accordion.tsx');
  assert.match(accordion, /aria-expanded=\{isOpen\}/);
  assert.match(accordion, /inert=\{!isOpen\}/);
  assert.match(accordion, /grid-rows-\[1fr\]/);
});

test('above-the-fold content is never scroll-revealed (no load animation on hero/banner)', () => {
  const home = code('src/app/[locale]/(storefront)/page.tsx');
  const hero = home.slice(home.indexOf('home-banner-2058'), home.indexOf("t('categoriesEyebrow')"));
  assert.doesNotMatch(hero, /\breveal(-stagger)?\b/);
});

test('tactile buttons lift and press only when enabled, and keep still for reduced motion', () => {
  const button = code('src/components/storefront/button.tsx');
  assert.match(button, /\[&:not\(:disabled\):hover\]:-translate-y-px/);
  assert.match(button, /motion-reduce:!translate-y-0/);
});

test('product gallery thumbnails are real buttons with labels from both locales', () => {
  const gallery = code('src/app/[locale]/(storefront)/products/[slug]/product-gallery.tsx');
  assert.match(gallery, /aria-pressed=\{isActive\}/);
  for (const path of ['messages/vi.json', 'messages/en.json']) {
    assert.match(JSON.parse(read(path)).products.galleryThumbnail, /\{index\}/, path);
  }
});
