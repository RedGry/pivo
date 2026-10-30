import assert from 'node:assert/strict';
import test from 'node:test';
import { gazeOffset, islandFrame, remainingProgress } from './island.ts';

test('timer rings drain from full to empty and keep progressless plugins hidden', () => {
  assert.equal(remainingProgress(0), 1);
  assert.equal(remainingProgress(0.25), 0.75);
  assert.equal(remainingProgress(0.5), 0.5);
  assert.equal(remainingProgress(1), 0);
  assert.equal(remainingProgress(null), null);
  assert.equal(remainingProgress(-1), 1);
  assert.equal(remainingProgress(2), 0);
  assert.equal(remainingProgress(NaN), 1);
});

test('cursor following is subtle and rejects invalid or excessive offsets', () => {
  assert.equal(gazeOffset(0), 0);
  assert.equal(gazeOffset(0.5), 1);
  assert.equal(gazeOffset(-10), -2);
  assert.equal(gazeOffset(10), 2);
  assert.equal(gazeOffset(NaN), 0);
});

test('the compact row hides eyes while retaining room for future status content', () => {
  const eyes = islandFrame(0, 0);
  const strip = islandFrame(0, 1);
  const eyeCenter = 20;
  const eyeHalfHeight = 15.5 / 2;
  assert(eyeCenter - eyeHalfHeight + eyes.lift >= 0);
  assert(eyeCenter + eyeHalfHeight + eyes.lift < eyes.height + eyes.lift);
  assert.equal(eyes.eyeOpacity, 1);
  assert.equal(strip.eyeOpacity, 0);
  assert.equal(islandFrame(0, 0.5).eyeOpacity, 0.5);
  assert.equal(strip.height + strip.lift, 24);
});

test('the wider silhouette has stable endpoints regardless of the previous compact pose', () => {
  assert.deepEqual(islandFrame(1, 0), islandFrame(1, 1));
  assert.equal(islandFrame(0).width, 180);
  assert.equal(islandFrame(0).height, 40);
  assert.equal(islandFrame(1, 1).width, 560);
  assert.equal(islandFrame(1, 1).height, 160);
});

test('widening the expanded canvas preserves a centered footprint through reveal', () => {
  for (const reveal of [0, 0.25, 0.5, 0.75, 1]) {
    const shape = islandFrame(reveal);
    const left = (560 - shape.width) / 2;
    assert.equal(left + shape.width / 2, 280);
    assert.equal(shape.height, 40 + 120 * reveal);
  }
});
