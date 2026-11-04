import assert from 'node:assert/strict';
import test from 'node:test';
import { PanelMotion } from './panel.ts';

test('island reveal spreads the fastest part of the transition across multiple frames', () => {
  const motion = new PanelMotion('island');
  motion.setExpanded(true, 0, true);
  for (let now = 16; now <= 320; now += 16) {
    assert(motion.frame(now).reveal - motion.frame(now - 16).reveal < 0.115);
  }
  assert(motion.frame(300).reveal > 0.95);
});

test('elapsed time determines motion independently of sampling frequency', () => {
  const reference = new PanelMotion();
  reference.setExpanded(true, 100, true);
  for (const step of [4, 7, 16, 50]) {
    const motion = new PanelMotion();
    motion.setExpanded(true, 100, true);
    for (let now = 100; now < 700; now += step) {
      assert.deepEqual(motion.frame(now), reference.frame(now));
    }
    assert.deepEqual(motion.frame(700), { reveal: 1, moving: false });
    motion.setExpanded(false, 800, true);
    assert.deepEqual(motion.frame(1400), { reveal: 0, moving: false });
  }
});

test('rapid reversals remain bounded and retain position, velocity and acceleration', () => {
  const motion = new PanelMotion();
  motion.setExpanded(true, 0, true);
  for (const [now, expanded] of [[195, false], [200, true], [235, false], [250, true]] as const) {
    const h = 0.001;
    const before = motion.frame(now).reveal;
    const velocity = (before - motion.frame(now - h).reveal) / h;
    const acceleration = (before - 2 * motion.frame(now - h).reveal + motion.frame(now - 2 * h).reveal) / h ** 2;
    motion.setExpanded(expanded, now, true);
    assert.equal(motion.frame(now).reveal, before);
    const next = motion.frame(now + h).reveal;
    assert(Math.abs((next - before) / h - velocity) < 0.00001);
    assert(Math.abs((motion.frame(now + 2 * h).reveal - 2 * next + before) / h ** 2 - acceleration) < 0.000001);
  }
  for (let now = 250; now <= 1000; now++) {
    const { reveal, moving } = motion.frame(now);
    assert(reveal >= 0 && reveal <= 1);
    if (moving) assert(reveal < 1, 'An active reveal must not freeze against an artificial clamp');
  }
  assert.deepEqual(motion.frame(1000), { reveal: 1, moving: false });
});

test('reduced motion snaps immediately and long idle intervals remain finite', () => {
  const motion = new PanelMotion();
  motion.setExpanded(true, 0, true);
  assert(motion.frame(50).moving);
  motion.setExpanded(true, 50, false);
  assert.deepEqual(motion.frame(50), { reveal: 1, moving: false });
  motion.setExpanded(false, 60, false);
  assert.deepEqual(motion.frame(60), { reveal: 0, moving: false });
  assert.deepEqual(motion.frame(Number.MAX_VALUE), { reveal: 0, moving: false });
});

test('reveal visibly progresses within eighty milliseconds without a frame-count warmup', () => {
  const motion = new PanelMotion();
  motion.setExpanded(true, 0, true);
  assert(motion.frame(80).reveal >= 0.35);
  assert.deepEqual(motion.frame(420), { reveal: 1, moving: false });
});

test('three short reveal and fold cycles produce visible movement within one second', () => {
  const motion = new PanelMotion();
  for (const start of [0, 320, 640]) {
    motion.setExpanded(true, start, true);
    const opened = motion.frame(start + 150).reveal;
    assert(opened > 0.9);
    motion.setExpanded(false, start + 150, true);
    assert(motion.frame(start + 310).reveal < 0.1);
  }
});

test('motion re-enabled after a reduced-motion snap starts from the snapped endpoint', () => {
  const motion = new PanelMotion();
  motion.setExpanded(true, 0, true);
  motion.setExpanded(false, 65, true);
  motion.setExpanded(false, 75, false);
  assert.deepEqual(motion.frame(75), { reveal: 0, moving: false });
  motion.setExpanded(true, 80, true);
  const fresh = new PanelMotion();
  fresh.setExpanded(true, 80, true);
  for (const now of [80, 85, 100, 140, 400]) {
    assert.deepEqual(motion.frame(now), fresh.frame(now));
  }
});
