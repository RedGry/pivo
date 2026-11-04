import assert from 'node:assert/strict';
import test from 'node:test';
import { playbackConfirmed, projectedPosition } from './playback.ts';

test('only a post-command sample can confirm the preview or exhaust its grace period', () => {
  assert.equal(playbackConfirmed(true, true, null, 5000), false);
  assert.equal(playbackConfirmed(true, false, 100, 200), false);
  assert.equal(playbackConfirmed(true, true, 100, 200), true);
  assert.equal(playbackConfirmed(true, false, 100, 2100), true);
});

test('the sampled clock advances between snapshots without passing the track end', () => {
  assert.equal(projectedPosition(500, 350, 1, 2000), 850);
  assert.equal(projectedPosition(500, 350, 1.5, 1000), 1000);
  assert.equal(projectedPosition(500, -20, 1, 1000), 500);
  assert.equal(projectedPosition(null, 350, 1, 1000), null);
});