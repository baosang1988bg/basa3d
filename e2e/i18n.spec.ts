import { test, expect } from '@playwright/test';

// phase-18.md Slice 5: verifies the merged middleware.ts (Path Branching — decision #3) keeps
// storefront locale routing and admin auth redirect independent, and that the language switcher
// actually flips locale while staying on the same page.

test('VI is the unprefixed default locale on the storefront home page', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('In 3D');
});

test('language switcher flips to /en and back while staying on the same page', async ({ page }) => {
  await page.goto('/products');
  await expect(page).toHaveURL('/products');

  const switcher = page.getByRole('group', { name: /language|ngôn ngữ/i });
  await switcher.getByRole('link', { name: 'en', exact: true }).click();
  await expect(page).toHaveURL('/en/products');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Products');

  await switcher.getByRole('link', { name: 'vi', exact: true }).click();
  await expect(page).toHaveURL('/products');
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sản phẩm');
});

test('/en pages outside the translated content slice show the untranslated-content notice', async ({ page }) => {
  await page.goto('/en/cart');
  await expect(page.getByText('This page is currently only available in Vietnamese.')).toBeVisible();
});

test('/admin/dashboard has no locale prefix and redirects unauthenticated visitors to /admin/login', async ({ page }) => {
  const response = await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(response?.status()).toBe(200);
});

test('/en/admin is not a route — admin never goes through locale routing', async ({ page }) => {
  const response = await page.goto('/en/admin/dashboard');
  expect(response?.status()).toBe(404);
});

test('/api routes are not redirected or rewritten by the locale middleware', async ({ request }) => {
  // GET /api/products is public (no auth) — asserts a real 200 API response, never a 3xx locale
  // redirect that a misconfigured middleware matcher could introduce.
  const response = await request.get('/api/products', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
});
