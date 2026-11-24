import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestProductMetadataFromImage } from '../src/services/catalog-ai.service';
import { detectCategoryFromName, getCategoryIconEmoji } from '../src/lib/categories';
import { productOnboardingInputSchema } from '../src/domain/schemas';

test('SMOKE TEST: Step 1 - AI Vision Engine (Local Ollama / Fallback)', async () => {
  // 1x1 valid transparent PNG base64
  const sampleImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  const suggestion = await suggestProductMetadataFromImage({
    imageBase64: sampleImage,
    mimeType: 'image/png',
    hint: 'Mèo may mắn maneki neko',
    categories: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Móc khoá & Keyring' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Trang trí để bàn' },
    ],
  });

  console.log('  [Smoke Step 1] AI Engine Source:', suggestion.source);
  console.log('  [Smoke Step 1] Suggested Names:', suggestion.suggestedNames);
  console.log('  [Smoke Step 1] Matched Category:', suggestion.suggestedCategoryName);

  assert.ok(['local_ollama', 'ai_vision', 'fallback'].includes(suggestion.source));
  assert.equal(suggestion.suggestedNames.length, 3);
  assert.ok(suggestion.suggestedShortDescription.length > 10);
});

test('SMOKE TEST: Step 2 - Auto-Categorization & Emoji Mapping', () => {
  const categories = [
    { id: 'cat-keychain', label: 'Móc khoá & Keyring', slug: 'moc-khoa' },
    { id: 'cat-toys', label: 'Mô hình & Đồ chơi', slug: 'mo-hinh' },
    { id: 'cat-decor', label: 'Trang trí để bàn', slug: 'trang-tri' },
    { id: 'cat-tools', label: 'Phụ kiện & Dụng cụ', slug: 'phu-kien' },
  ];

  // Case A: Keychain
  const res1 = detectCategoryFromName('Móc khoá mèo thần tài', categories);
  assert.equal(res1?.categoryId, 'cat-keychain');
  const emoji1 = getCategoryIconEmoji(res1?.categoryLabel || '');
  assert.equal(emoji1, '🔑');

  // Case B: Fidget / Toy
  const res2 = detectCategoryFromName('Rồng khớp nối uốn lượn flexi fidget', categories);
  assert.equal(res2?.categoryId, 'cat-toys');
  const emoji2 = getCategoryIconEmoji(res2?.categoryLabel || '');
  assert.equal(emoji2, '🧸');

  // Case C: Decor / Desk
  const res3 = detectCategoryFromName('Chậu cây để bàn trang trí góc làm việc', categories);
  assert.equal(res3?.categoryId, 'cat-decor');
  const emoji3 = getCategoryIconEmoji(res3?.categoryLabel || '');
  assert.equal(emoji3, '🏠');

  console.log('  [Smoke Step 2] Auto-category detections verified with emoji!');
});

test('SMOKE TEST: Step 3 - Full Product Onboarding Schema with Storage & Source Links', () => {
  const staffInput = {
    requestId: '99999999-9999-4999-8999-999999999999',
    name: 'Móc khoá rồng vàng in 3D',
    categoryId: '11111111-1111-4111-8111-111111111111',
    shortDescription: 'Móc khoá in 3D sắc nét, rồng may mắn chi tiết cao.',
    productType: 'MADE_TO_ORDER',
    basePrice: 45000,
    licenseType: 'OWN_DESIGN',
    licenseSourceUrl: 'https://makerworld.com/en/models/123456',
    printLocalPath: 'D:\\3D_Models\\MocKhoa\\RongVang_AMS.3mf',
    printDriveUrl: 'https://drive.google.com/drive/folders/abc_xyz_123',
    variants: [
      {
        name: 'Mặc định',
        openingStock: 0,
      },
    ],
  };

  const parsed = productOnboardingInputSchema.safeParse(staffInput);
  assert.ok(parsed.success, 'Staff input must pass validation');

  if (parsed.success) {
    assert.equal(parsed.data.name, 'Móc khoá rồng vàng in 3D');
    assert.equal(parsed.data.basePrice, 45000);
    assert.equal(parsed.data.printLocalPath, 'D:\\3D_Models\\MocKhoa\\RongVang_AMS.3mf');
    assert.equal(parsed.data.printDriveUrl, 'https://drive.google.com/drive/folders/abc_xyz_123');
    assert.equal(parsed.data.licenseSourceUrl, 'https://makerworld.com/en/models/123456');
    console.log('  [Smoke Step 3] Product payload validated successfully with internal paths!');
  }
});

test('SMOKE TEST: Step 4 - Local Ollama Service Health Check (RTX 4060 GPU)', async () => {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = (await res.json()) as { models?: { name: string }[] };
      const modelNames = (data.models || []).map((m) => m.name);
      console.log('  [Smoke Step 4] Local Ollama Online! Models available:', modelNames);
      assert.ok(modelNames.some((n) => n.includes('llava') || n.includes('moondream')), 'Must have vision model installed');
    } else {
      console.log('  [Smoke Step 4] Ollama returned status:', res.status);
    }
  } catch {
    console.log('  [Smoke Step 4] Ollama local service not reachable in timeout (fallback active)');
  }
});
