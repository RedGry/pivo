import assert from 'node:assert/strict';
import test from 'node:test';
import { AmbientMotion, type Gesture } from './ambient.ts';

test('compact eyes blink and occasionally look curious without a continuous frame loop', () => {
  let callback: () => void = () => {};
  const gestures: (Gesture | null)[] = [];
  const motion = new AmbientMotion({ set(next, delay) { callback = next; assert(delay >= 4500); return 1; }, clear() {} }, gesture => gestures.push(gesture));
  motion.setMode('eyes');
  for (let i = 0; i < 4; i++) callback();
  assert.deepEqual(gestures, [null, 'blink', 'blink', 'blink', 'curious']);
});

test('strip reminders stay rare and disabling motion cancels pending timers and active gestures', () => {
  let pending: (() => void) | undefined;
  let delay = 0;
  const gestures: (Gesture | null)[] = [];
  const motion = new AmbientMotion({ set(next, ms) { pending = next; delay = ms; return 1; }, clear() { pending = undefined; } }, gesture => gestures.push(gesture));
  motion.setMode('strip');
  assert(delay >= 120_000);
  pending!();
  assert.equal(gestures.at(-1), 'peek');
  motion.setMode(null);
  assert.equal(pending, undefined);
  assert.equal(gestures.at(-1), null);
  motion.setMode(null);
  assert.equal(pending, undefined);
});
