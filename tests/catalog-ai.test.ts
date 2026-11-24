import test from 'node:test';
import assert from 'node:assert/strict';
import {
  productAiSuggestInputSchema,
  buildFallbackSuggestion,
  suggestProductMetadataFromImage,
} from '../src/services/catalog-ai.service';

test('productAiSuggestInputSchema validates correct input and rejects invalid', () => {
  const valid = {
    imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD',
    mimeType: 'image/jpeg',
    categories: [{ id: 'cat-1', name: 'Đồ chơi & Fidget' }],
    hint: 'Mèo may mắn',
  };

  const parsed = productAiSuggestInputSchema.safeParse(valid);
  assert.ok(parsed.success);

  // Short image rejected
  const invalidImage = { imageBase64: 'abc' };
  const res = productAiSuggestInputSchema.safeParse(invalidImage);
  assert.equal(res.success, false);
});

test('buildFallbackSuggestion generates proper names and descriptions with hint', () => {
  const categories = [
    { id: 'cat-decor', name: 'Trang trí để bàn' },
    { id: 'cat-toys', name: 'Đồ chơi & Fidget' },
  ];

  const suggestion = buildFallbackSuggestion('Rồng khớp nối', categories);
  assert.equal(suggestion.source, 'fallback');
  assert.equal(suggestion.suggestedNames.length, 3);
  assert.ok(suggestion.suggestedNames[0].includes('Rồng khớp nối'));
  assert.ok(suggestion.suggestedShortDescription.includes('Rồng khớp nối'));
});

test('buildFallbackSuggestion matches category when hint contains category name', () => {
  const categories = [
    { id: 'cat-decor', name: 'Trang trí' },
    { id: 'cat-toys', name: 'Đồ chơi' },
  ];

  const suggestion = buildFallbackSuggestion('Đồ chơi giải trí mini', categories);
  assert.equal(suggestion.suggestedCategoryId, 'cat-toys');
  assert.equal(suggestion.suggestedCategoryName, 'Đồ chơi');
});

test('suggestProductMetadataFromImage returns fallback when no image provided', async () => {
  const suggestion = await suggestProductMetadataFromImage({
    hint: 'Khung ảnh',
  });
  assert.equal(suggestion.source, 'fallback');
  assert.equal(suggestion.suggestedNames.length, 3);
});


test('suggestProductMetadataFromImage handles image input gracefully with dual-engine', async () => {
  const result = await suggestProductMetadataFromImage({
    imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    hint: 'Móc khoá chibi',
  });
  assert.ok(['local_ollama', 'ai_vision', 'fallback'].includes(result.source));
  assert.ok(result.suggestedNames.length > 0);
  assert.ok(result.suggestedShortDescription.length > 0);
});
