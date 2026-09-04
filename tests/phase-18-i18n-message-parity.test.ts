import assert from 'node:assert/strict';
import test from 'node:test';
import viMessages from '../messages/vi.json' with { type: 'json' };
import enMessages from '../messages/en.json' with { type: 'json' };

// phase-18.md Slice 4: a missing key in either locale renders as an empty/erroring string at
// runtime instead of failing a build — this guard catches that at test time instead.
type Messages = Record<string, unknown>;

function collectKeyPaths(messages: Messages, prefix = ''): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...collectKeyPaths(value as Messages, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

test('vi.json and en.json have identical message key sets', () => {
  const viKeys = collectKeyPaths(viMessages).sort();
  const enKeys = collectKeyPaths(enMessages).sort();

  const onlyInVi = viKeys.filter((key) => !enKeys.includes(key));
  const onlyInEn = enKeys.filter((key) => !viKeys.includes(key));

  assert.deepEqual(onlyInVi, [], `keys present in vi.json but missing from en.json: ${onlyInVi.join(', ')}`);
  assert.deepEqual(onlyInEn, [], `keys present in en.json but missing from vi.json: ${onlyInEn.join(', ')}`);
});

test('array-shaped message values (categories, workflowSteps, faq, heroValueProps) have matching lengths', () => {
  const arrayPaths = ['home.categories', 'home.workflowSteps', 'home.faq', 'home.heroValueProps'] as const;

  for (const path of arrayPaths) {
    const [namespace, key] = path.split('.');
    const viArray = (viMessages as unknown as Record<string, Record<string, unknown[]>>)[namespace][key];
    const enArray = (enMessages as unknown as Record<string, Record<string, unknown[]>>)[namespace][key];
    assert.equal(Array.isArray(viArray), true, `${path} must be an array in vi.json`);
    assert.equal(Array.isArray(enArray), true, `${path} must be an array in en.json`);
    assert.equal(viArray.length, enArray.length, `${path} array length differs between vi.json (${viArray.length}) and en.json (${enArray.length})`);
  }
});
