import test from 'node:test';
import assert from 'node:assert/strict';
import { productOnboardingInputSchema } from '../src/domain/schemas';

test('productOnboardingInputSchema validates printLocalPath, printDriveUrl, and sourceUrl', () => {
  const validPayload = {
    requestId: '11111111-1111-4111-8111-111111111111',
    name: 'Móc khoá chibi cá mập',
    categoryId: '22222222-2222-4222-8222-222222222222',
    shortDescription: 'Móc khoá xinh xắn',
    productType: 'MADE_TO_ORDER',
    basePrice: 45000,
    licenseType: 'OWN_DESIGN',
    licenseSourceUrl: 'https://makerworld.com/en/models/123456',
    printLocalPath: 'D:\\3D_Models\\MocKhoa\\MeoShiba.3mf',
    printDriveUrl: 'https://drive.google.com/drive/folders/abcdef123456',
    variants: [
      {
        name: 'Mặc định',
        openingStock: 0,
      },
    ],
  };

  const parsed = productOnboardingInputSchema.safeParse(validPayload);
  assert.ok(parsed.success);
  if (parsed.success) {
    assert.equal(parsed.data.printLocalPath, 'D:\\3D_Models\\MocKhoa\\MeoShiba.3mf');
    assert.equal(parsed.data.printDriveUrl, 'https://drive.google.com/drive/folders/abcdef123456');
    assert.equal(parsed.data.licenseSourceUrl, 'https://makerworld.com/en/models/123456');
  }
});
