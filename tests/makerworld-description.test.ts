import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMakerWorldDescription } from '../src/lib/parsers/makerworld-description';

test('parseMakerWorldDescription parses full MakerWorld description string from makerworld-order-modal', () => {
  const raw = `[MakerWorld] Bottle Opener and Cap GUN! 
Nguồn mẫu: https://makerworld.com/en/models/2128043-bottle-opener-and-cap-gun#profileId-2304413
Tác giả: 3DEddy
Bàn in (Profile): (NEW) Set support to "SNUG" to make the handle more smooth (ID: 589422863)
Thông số in: 13h 47p · 378g · 3 bàn in
Máy in: P2S · AMS: Cần AMS (Đa màu)
Màu sắc file: PLA (PLA), PLA (PLA), PLA (PLA)
Màu khách yêu cầu: Đỏ đen
Phương án: Bản Ráp sẵn hoàn thiện
Báo giá ước tính hiển thị: ~400.000đ/chiếc (Tổng: ~400.000đ)
Ghi chú khách hàng: Giao gấp trong ngày mai giúp mình`;

  const parsed = parseMakerWorldDescription(raw);

  assert.strictEqual(parsed.isMakerWorld, true);
  assert.strictEqual(parsed.modelTitle, 'Bottle Opener and Cap GUN!');
  assert.strictEqual(parsed.sourceUrl, 'https://makerworld.com/en/models/2128043-bottle-opener-and-cap-gun#profileId-2304413');
  assert.strictEqual(parsed.author, '3DEddy');
  assert.strictEqual(parsed.profileTitle, '(NEW) Set support to "SNUG" to make the handle more smooth');
  assert.strictEqual(parsed.profileId, '589422863');
  assert.strictEqual(parsed.printMinutes, 827);
  assert.strictEqual(parsed.weightGrams, 378);
  assert.strictEqual(parsed.platesCount, 3);
  assert.strictEqual(parsed.printerTarget, 'P2S');
  assert.strictEqual(parsed.amsRequired, true);
  assert.strictEqual(parsed.material, 'PLA');
  assert.strictEqual(parsed.requestedColor, 'Đỏ đen');
  assert.strictEqual(parsed.tier, 'ASSEMBLED');
  assert.strictEqual(parsed.estimatedPriceVnd, 400000);
  assert.strictEqual(parsed.customerNote, 'Giao gấp trong ngày mai giúp mình');
});

test('parseMakerWorldDescription handles MakerWorld intake card format with no extra notes', () => {
  const raw = `[MakerWorld] SSBAP 02
Profile: 0.2mm layer, 2 walls, 15% infill
Phương án: Bản Ráp sẵn hoàn thiện`;

  const parsed = parseMakerWorldDescription(raw);

  assert.strictEqual(parsed.isMakerWorld, true);
  assert.strictEqual(parsed.modelTitle, 'SSBAP 02');
  assert.strictEqual(parsed.profileTitle, '0.2mm layer, 2 walls, 15% infill');
  assert.strictEqual(parsed.tier, 'ASSEMBLED');
  assert.strictEqual(parsed.customerNote, null);
});

test('parseMakerWorldDescription returns isMakerWorld: false for standard non-MakerWorld descriptions', () => {
  const raw = 'In cho mình 5 mẫu hộp đựng linh kiện theo file đính kèm';
  const parsed = parseMakerWorldDescription(raw);

  assert.strictEqual(parsed.isMakerWorld, false);
  assert.strictEqual(parsed.cleanDescription, raw);
});
