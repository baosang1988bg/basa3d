// Phase 37 — brand assets: the files the storefront references exist with the dimensions the
// <Image width/height> props promise, the App Router metadata files are in place, and every new
// alt text exists in both locales with the placeholders the components pass.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import vi from '../messages/vi.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };

// PNG/JPEG/WebP header parsing — avoids adding an image dependency just for a size check.
function imageSize(path: string): { width: number; height: number } {
  const b = readFileSync(path);
  if (b.subarray(1, 4).toString() === 'PNG') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') {
    const chunk = b.subarray(12, 16).toString();
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc2) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  throw new Error(`unknown image format: ${path}`);
}

test('storefront brand images exist with the dimensions declared in <Image>', () => {
  const expected: Record<string, [number, number]> = {
    'public/brand/basa3d-logo.webp': [443, 192],
    'public/brand/basa3d-logo-full.png': [1386, 600],
    'public/brand/home-banner-2058.webp': [2058, 764],
    'public/brand/contact-card-800.webp': [800, 800],
  };
  for (const [path, [width, height]] of Object.entries(expected)) {
    assert.ok(existsSync(path), `${path} missing`);
    assert.deepEqual(imageSize(path), { width, height }, path);
    assert.ok(statSync(path).size < 500 * 1024, `${path} should stay under 500KB`);
  }
});

test('App Router metadata files are present (favicon, icons, 1200x630 share images)', () => {
  for (const f of ['src/app/favicon.ico', 'src/app/icon.png', 'src/app/apple-icon.png']) assert.ok(existsSync(f), f);
  assert.deepEqual(imageSize('src/app/icon.png'), { width: 512, height: 512 });
  assert.deepEqual(imageSize('src/app/apple-icon.png'), { width: 180, height: 180 });
  for (const f of ['src/app/opengraph-image.jpg', 'src/app/twitter-image.jpg']) {
    assert.deepEqual(imageSize(f), { width: 1200, height: 630 }, f);
    assert.ok(statSync(f).size < 300 * 1024, `${f} should stay small for link previews`);
  }
  // Declaring icons/openGraph.images in the root layout would override the file convention.
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  assert.doesNotMatch(layout, /icons\s*:/);
  assert.doesNotMatch(layout, /openGraph\s*:/);
});

test('brand alt texts exist in vi and en with the placeholders the components pass', () => {
  for (const messages of [vi, en]) {
    assert.ok(messages.nav.logoAlt.length > 0);
    assert.match(messages.footer.logoAlt, /\{name\}/);
    assert.match(messages.footer.contactCardAlt, /\{phone\}/);
    assert.match(messages.home.bannerAlt, /\{phone\}/);
    assert.match(messages.home.bannerAlt, /299k/);
  }
});

test('header, footer and home page reference the committed brand assets', () => {
  assert.match(readFileSync('src/components/storefront/header.tsx', 'utf8'), /\/brand\/basa3d-logo\.webp/);
  const footer = readFileSync('src/components/storefront/footer.tsx', 'utf8');
  assert.match(footer, /\/brand\/basa3d-logo-full\.png/);
  assert.match(footer, /\/brand\/contact-card-800\.webp/);
  assert.match(readFileSync('src/app/[locale]/(storefront)/page.tsx', 'utf8'), /\/brand\/home-banner-2058\.webp/);
});
