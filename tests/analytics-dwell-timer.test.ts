import assert from 'node:assert/strict';
import test from 'node:test';
import { createDwellTimer } from '../src/lib/analytics-dwell-timer';
import { classifyNavigationOrigin } from '../src/lib/analytics-navigation';

function fakeClock(start = 1_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

const opts = { minMs: 1_000, maxMs: 30 * 60_000, idleMs: 120_000 };

test('counts visible time and resets after flush', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, opts);
  timer.start('/products', true);
  clock.advance(5_000);
  assert.deepEqual(timer.flush(), { key: '/products', ms: 5_000 });
});

test('a second flush right after the first never double-counts', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, opts);
  timer.start('/a', true);
  clock.advance(4_000);
  assert.equal(timer.flush()?.ms, 4_000);
  assert.equal(timer.flush(), null);
});

test('hidden time is excluded (tab switch)', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, opts);
  timer.start('/a', true);
  clock.advance(3_000);
  timer.hide();
  clock.advance(60_000);
  timer.show();
  clock.advance(2_000);
  assert.equal(timer.flush()?.ms, 5_000);
});

test('flush on hide, then resume on show for the same screen', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, opts);
  timer.start('/a', true);
  clock.advance(3_000);
  timer.hide();
  assert.equal(timer.flush()?.ms, 3_000);
  clock.advance(10 * 60_000); // bfcache / background — must not count
  timer.show();
  clock.advance(2_000);
  assert.deepEqual(timer.flush(), { key: '/a', ms: 2_000 });
});

test('screen that starts hidden counts nothing until shown', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, opts);
  timer.start('/a', false);
  clock.advance(10_000);
  timer.activity(); // input while hidden is ignored
  assert.equal(timer.flush(), null);
});

test('drops results below minMs (quick skip noise)', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, opts);
  timer.start('/a', true);
  clock.advance(999);
  assert.equal(timer.flush(), null);
});

test('stops counting after idleMs without activity, resumes on activity', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, opts);
  timer.start('/a', true);
  clock.advance(30_000);
  timer.activity();
  clock.advance(10 * 60_000); // AFK
  timer.activity(); // comes back: banks 30s + 120s idle window
  clock.advance(5_000);
  assert.equal(timer.flush()?.ms, 30_000 + 120_000 + 5_000);
});

test('clamps a single result to maxMs', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, { ...opts, idleMs: Number.POSITIVE_INFINITY });
  timer.start('/a', true);
  clock.advance(2 * 60 * 60_000);
  assert.equal(timer.flush()?.ms, 30 * 60_000);
});

test('start() of a new route discards unflushed time of the old one', () => {
  const clock = fakeClock();
  const timer = createDwellTimer(clock.now, opts);
  timer.start('/a', true);
  clock.advance(5_000);
  timer.start('/b', true);
  clock.advance(2_000);
  assert.deepEqual(timer.flush(), { key: '/b', ms: 2_000 });
});

test('flush without start is a no-op', () => {
  const timer = createDwellTimer(fakeClock().now, opts);
  assert.equal(timer.flush(), null);
  timer.show();
  timer.activity();
  assert.equal(timer.flush(), null);
});

test('navigation origin: only user-initiated changes count', () => {
  const base = { origin: 'https://basa3d.vn', msSincePopstate: null as number | null };
  assert.equal(classifyNavigationOrigin({ ...base, isInitialDocument: false, referrer: '' }), 'user');
  assert.equal(classifyNavigationOrigin({ ...base, isInitialDocument: false, referrer: '', msSincePopstate: 300 }), 'history');
  assert.equal(classifyNavigationOrigin({ ...base, isInitialDocument: false, referrer: '', msSincePopstate: 60_000 }), 'user');
  assert.equal(classifyNavigationOrigin({ ...base, isInitialDocument: true, navigationType: 'reload', referrer: 'https://basa3d.vn/products' }), 'reload');
  assert.equal(classifyNavigationOrigin({ ...base, isInitialDocument: true, navigationType: 'back_forward', referrer: 'https://basa3d.vn/' }), 'history');
  // GET <form> submit on /products → full load, same-origin referrer.
  assert.equal(classifyNavigationOrigin({ ...base, isInitialDocument: true, navigationType: 'navigate', referrer: 'https://basa3d.vn/products' }), 'user');
  // Shared link / Google result landing.
  assert.equal(classifyNavigationOrigin({ ...base, isInitialDocument: true, navigationType: 'navigate', referrer: 'https://www.google.com/' }), 'landing');
  assert.equal(classifyNavigationOrigin({ ...base, isInitialDocument: true, navigationType: 'navigate', referrer: '' }), 'landing');
});
