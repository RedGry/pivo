import assert from 'node:assert/strict';
import test from 'node:test';
import { mountExpressions } from './expressions.ts';
import { AmbientMotion, type Gesture } from './ambient.ts';
import { playWidgetReaction } from './widgets.ts';

function fixture() {
  let now = 0;
  let pending: { at: number; next: () => void } | undefined;
  const gestures: (Gesture | null)[] = [];
  const motion = new AmbientMotion({
    now: () => now,
    set(next, delay) { pending = { at: now + delay, next }; return 1; },
    clear() { pending = undefined; },
  }, gesture => gestures.push(gesture));
  return {
    motion, gestures,
    pending: () => pending !== undefined,
    advance(target: number) {
      while (pending && pending.at <= target) {
        now = pending.at;
        const { next } = pending;
        pending = undefined;
        next();
      }
      now = target;
    },
  };
}

test('idle Eyes blink, become drowsy, fall asleep and stop scheduling work until movement', () => {
  const f = fixture();
  f.motion.setMode('eyes');
  f.advance(24_000);
  assert.deepEqual(f.gestures, [null, 'blink', 'blink', 'blink', 'curious', 'drowsy']);
  f.advance(25_000);
  assert.equal(f.gestures.at(-1), 'asleep');
  assert.equal(f.pending(), false);
  f.motion.activity();
  assert.equal(f.gestures.at(-1), 'wake');
  f.advance(26_000);
  assert.equal(f.gestures.at(-1), 'wake');
  f.advance(32_000);
  assert.equal(f.gestures.at(-1), 'blink');
});

test('activity cancels a pending sleep and hiding cancels the waking gesture', () => {
  const f = fixture();
  f.motion.setMode('eyes');
  f.advance(24_001);
  f.motion.activity();
  f.advance(25_000);
  assert.equal(f.gestures.at(-1), 'wake');
  f.motion.setMode(null);
  f.advance(60_000);
  assert.equal(f.pending(), false);
  assert.equal(f.gestures.at(-1), null);
});

test('Strip ignores gaze activity, blinks, winks toward the clock and occasionally waves', () => {
  const f = fixture();
  f.motion.setMode('strip');
  f.advance(7_999);
  f.motion.activity();
  assert.deepEqual(f.gestures, [null]);
  f.advance(8_000);
  assert.equal(f.gestures.at(-1), 'strip-blink');
  f.advance(30_000);
  assert.equal(f.gestures.at(-1), 'strip-wink');
  f.advance(60_000);
  assert.equal(f.gestures.at(-1), 'wave');
  f.motion.setMode(null);
  f.advance(300_000);
  assert.equal(f.pending(), false);
  assert.equal(f.gestures.at(-1), null);
});

test('compact widget reactions are finite and use distinct eye poses', context => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true,
    value: () => ({ transform: 'none', opacity: '1' }) });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, 'getComputedStyle', previous);
    else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  });
  const calls: { frames: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
  const mascot = {
    animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
      calls.push({ frames, options });
    },
  } as unknown as HTMLElement;
  playWidgetReaction(mascot, 'water');
  playWidgetReaction(mascot, 'tasks');
  playWidgetReaction(mascot, '');
  assert.equal(calls.length, 2);
  assert.notDeepEqual(calls[0]?.frames, calls[1]?.frames);
  for (const { frames, options } of calls) {
    assert(options.duration && Number(options.duration) < 1000);
    assert.equal(options.iterations, undefined);
    assert.equal(frames.at(-1)?.transform, 'none');
  }
});

test('an interrupted eye expression starts at the sampled pose before cancellation', () => {
  const calls: Keyframe[][] = [];
  const pose = { transform: 'matrix(1, 0, 0, 0.4, -6, -5)', borderRadius: '30%' };
  let cancelled = false;
  const eye = {
    animate(frames: Keyframe[]) {
      calls.push(frames);
      return { cancel() { cancelled = true; } };
    },
  };
  const eyes = { querySelectorAll: () => [eye] } as unknown as HTMLElement;
  const miniEyes = { querySelectorAll: () => [] } as unknown as HTMLElement;
  Object.defineProperty(globalThis, 'getComputedStyle', {
    configurable: true,
    value() { assert.equal(cancelled, false); return pose; },
  });
  try {
    const express = mountExpressions(eyes, eyes, miniEyes);
    express('blink');
    express('curious');
    assert.equal(cancelled, true);
    assert.deepEqual(calls[1]?.[0], pose);
  } finally {
    Reflect.deleteProperty(globalThis, 'getComputedStyle');
  }
});

test('sleep retains the closing animation until it reaches its held pose', () => {
  let calls = 0;
  let cancellations = 0;
  const eye = { animate() { calls++; return { cancel() { cancellations++; } }; } };
  const eyes = { querySelectorAll: () => [eye] } as unknown as HTMLElement;
  const miniEyes = { querySelectorAll: () => [] } as unknown as HTMLElement;
  const express = mountExpressions(eyes, eyes, miniEyes);
  express('drowsy');
  express('asleep');
  assert.equal(calls, 1);
  assert.equal(cancellations, 0);
  express(null);
  assert.equal(cancellations, 1);
});
