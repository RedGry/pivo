import assert from 'node:assert/strict';
import test from 'node:test';
import { clockRefreshDelay } from './clock.ts';

test('visible Strip and Expanded clocks update at the next exact minute boundary', () => {
  const now = new Date(2026, 9, 30, 17, 13, 42, 125);
  assert.equal(clockRefreshDelay(now, true, false, 'strip'), 17_875);
  assert.equal(clockRefreshDelay(now, true, false, 'expanded'), 17_875);
  assert.equal(clockRefreshDelay(new Date(2026, 9, 30, 17, 14), true, false, 'strip'), 60_000);
});

test('Eyes, native-hidden and document-hidden clocks have no scheduled wakeup', () => {
  const now = new Date();
  assert.equal(clockRefreshDelay(now, true, false, 'eyes'), undefined);
  for (const presentation of ['strip', 'eyes', 'expanded'] as const) {
    assert.equal(clockRefreshDelay(now, false, false, presentation), undefined);
    assert.equal(clockRefreshDelay(now, true, true, presentation), undefined);
  }
});
