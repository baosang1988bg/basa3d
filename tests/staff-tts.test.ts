import assert from 'node:assert/strict';
import test from 'node:test';
import { createTtsJobSchema } from '../src/domain/tts';

test('createTtsJobSchema validates valid input and applies defaults', () => {
  const result = createTtsJobSchema.parse({
    textPrompt: 'Chào mừng bạn đến với xưởng in 3D BaSa3D.',
  });

  assert.equal(result.textPrompt, 'Chào mừng bạn đến với xưởng in 3D BaSa3D.');
  assert.equal(result.voiceProfile, 'default');
  assert.equal(result.speed, 1.0);
});

test('createTtsJobSchema accepts custom voice and speed', () => {
  const result = createTtsJobSchema.parse({
    textPrompt: 'Kịch bản review sản phẩm mới.',
    voiceProfile: 'adamsang',
    speed: 1.15,
  });

  assert.equal(result.voiceProfile, 'adamsang');
  assert.equal(result.speed, 1.15);
});

test('createTtsJobSchema trims input whitespace', () => {
  const result = createTtsJobSchema.parse({
    textPrompt: '   Đoạn văn có nhiều khoảng trắng thừa.   ',
    voiceProfile: '  my_voice  ',
  });

  assert.equal(result.textPrompt, 'Đoạn văn có nhiều khoảng trắng thừa.');
  assert.equal(result.voiceProfile, 'my_voice');
});

test('createTtsJobSchema rejects empty textPrompt', () => {
  assert.throws(
    () => createTtsJobSchema.parse({ textPrompt: '   ' }),
    (error: unknown) => {
      const err = error as Error;
      return err.message.includes('Vui lòng nhập văn bản');
    },
  );
});

test('createTtsJobSchema rejects speed out of bounds', () => {
  assert.throws(
    () => createTtsJobSchema.parse({ textPrompt: 'Hello', speed: 0.3 }),
    (error: unknown) => {
      const err = error as Error;
      return err.message.includes('Tốc độ tối thiểu');
    },
  );

  assert.throws(
    () => createTtsJobSchema.parse({ textPrompt: 'Hello', speed: 2.5 }),
    (error: unknown) => {
      const err = error as Error;
      return err.message.includes('Tốc độ tối đa');
    },
  );
});
