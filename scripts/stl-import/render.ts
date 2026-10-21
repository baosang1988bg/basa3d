// Feature 003 (FR-004, research R4): headless three.js renders in Playwright Chromium, same approach
// as the Phase 32 spike (6.5 s for a ~1M-triangle mesh). Runs only on the OWNER's machine.
import { chromium, type Browser, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'http://stl-import.local';
const RECYCLE_EVERY = 40; // reload the page periodically so WebGL/JS memory cannot creep up
const here = path.dirname(fileURLToPath(import.meta.url));
const threeRoot = path.resolve(path.dirname(createRequire(import.meta.url).resolve('three')), '..');

export type RenderOptions = { size: number; quality: number; color: string; views: 2 | 4; dims: { x: number; y: number; z: number } | null };

export class ModelRenderer {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private renders = 0;
  private readonly blobs = new Map<string, Buffer>();

  constructor(private readonly timeoutMs: number) {}

  private async openPage(): Promise<Page> {
    if (!this.browser) {
      const channel = process.platform === 'win32' ? 'chrome' : undefined;
      this.browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], ...(channel ? { channel } : {}) });
    }
    const page = await this.browser.newPage();
    await page.route(`${ORIGIN}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({ path: path.join(here, 'render-page.html'), contentType: 'text/html' });
      if (url.pathname.startsWith('/three/')) {
        const file = path.join(threeRoot, ...url.pathname.slice('/three/'.length).split('/'));
        if (!file.startsWith(threeRoot + path.sep)) return route.abort();
        return route.fulfill({ path: file, contentType: 'text/javascript' });
      }
      const blob = this.blobs.get(url.pathname);
      return blob ? route.fulfill({ body: blob, contentType: 'application/octet-stream' }) : route.abort();
    });
    page.on('pageerror', (error) => console.warn('  [render page]', error.message));
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
    return page;
  }

  /** WebP images, cover first. Throws on timeout or WebGL failure (the page is then recycled). */
  async render(parts: Uint8Array[], options: RenderOptions): Promise<Uint8Array[]> {
    this.page ??= await this.openPage();
    const urls = parts.map((bytes, index) => {
      const url = `/blob/${this.renders}-${index}`;
      this.blobs.set(url, Buffer.from(bytes));
      return url;
    });
    let timer: NodeJS.Timeout | undefined;
    try {
      const page = this.page;
      const dataUrls = await Promise.race([
        page.evaluate(([u, o]) => (window as unknown as { renderModel: (u: string[], o: RenderOptions) => Promise<string[]> }).renderModel(u, o), [urls, options] as const),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`TIMEOUT_${this.timeoutMs / 1000}s`)), this.timeoutMs); }),
      ]);
      this.renders += 1;
      if (this.renders % RECYCLE_EVERY === 0) await this.recycle();
      return dataUrls.map((dataUrl) => new Uint8Array(Buffer.from(dataUrl.split(',')[1], 'base64')));
    } catch (error) {
      await this.recycle();
      throw new Error(`RENDER_FAILED: ${String((error as Error).message ?? error).replace(/^page\.evaluate:\s*/, '').split('\n')[0].slice(0, 300)}`);
    } finally {
      clearTimeout(timer);
      for (const url of urls) this.blobs.delete(url);
    }
  }

  private async recycle() {
    await this.page?.close().catch(() => undefined);
    this.page = null;
  }

  async close() {
    await this.recycle();
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
  }
}
