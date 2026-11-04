import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PanelMotion } from '../motion/panel.ts';
import { gazeOffset, islandContentOpacity, islandFrame, remainingProgress } from './island.ts';

test('compact text leaves before expanded text enters the same header space', () => {
  assert.deepEqual(islandContentOpacity(0), { compact: 1, expanded: 0 });
  assert.deepEqual(islandContentOpacity(1), { compact: 0, expanded: 1 });
  for (let step = 0; step <= 1000; step++) {
    const frame = islandContentOpacity(step / 1000);
    assert(frame.compact === 0 || frame.expanded === 0, `overlapping text at ${step / 1000}`);
  }
});

test('text choreography retains opacity through reversals and eases at handoff', () => {
  const motion = new PanelMotion('island');
  motion.setExpanded(true, 0, true);
  for (const [now, expanded] of [[180, false], [210, true], [260, false], [280, true]] as const) {
    const before = islandContentOpacity(motion.frame(now).reveal);
    motion.setExpanded(expanded, now, true);
    assert.deepEqual(islandContentOpacity(motion.frame(now).reveal), before);
  }
  for (const reveal of [0, 0.3, 0.82, 1]) {
    const before = islandContentOpacity(Math.max(0, reveal - 0.0001));
    const after = islandContentOpacity(Math.min(1, reveal + 0.0001));
    assert(Math.abs(after.compact - before.compact) < 0.000001);
    assert(Math.abs(after.expanded - before.expanded) < 0.000001);
  }
});

test('folding from a settled island does not replay the opening overshoot', () => {
  const expanded = islandFrame(1);
  for (const reveal of [0.999, 0.99, 0.98, 0.97, 0.96]) {
    const folding = islandFrame(reveal, 0, 480, 148, 34, 148, 34, 0, 0);
    assert(folding.width <= expanded.width);
    assert(folding.height <= expanded.height);
  }
});

test('the silhouette briefly exceeds its expanded size and settles at the exact endpoint', () => {
  const motion = new PanelMotion('island');
  motion.setExpanded(true, 0, true);
  const render = (now: number, tucked: number) =>
    islandFrame(motion.frame(now).reveal, tucked, 480, 148, 34, 148, 34, 0, motion.openingSettle(now));
  for (const tucked of [0, 1]) {
    const frames = Array.from({ length: 50 }, (_, index) => render(index * 10, tucked));
    const settled = render(650, tucked);
    assert(frames.some(frame => frame.width > settled.width));
    assert(frames.some(frame => frame.height > settled.height));
    assert.equal(settled.width, 480);
    assert.equal(settled.height, 156);
  }
  const before = render(275, 1);
  motion.setExpanded(false, 275, true);
  assert.deepEqual(render(275, 1), before);
});

test('opening settlement preserves a four-to-five percent pulse across compact and expanded sizes', () => {
  for (const width of [480, 752]) for (const compactWidth of [148, 300]) {
    for (const compactHeight of [34, 54]) for (const tucked of [0, 1]) {
      const motion = new PanelMotion('island');
      motion.setExpanded(true, 0, true);
      let peakWidth = 0, peakHeight = 0;
      for (let now = 0; now <= 650; now++) {
        const frame = islandFrame(motion.frame(now).reveal, tucked, width, compactWidth, compactHeight,
          compactWidth, compactHeight, 0, motion.openingSettle(now));
        peakWidth = Math.max(peakWidth, frame.width);
        peakHeight = Math.max(peakHeight, frame.height);
      }
      const widthPulse = peakWidth / width - 1, heightPulse = peakHeight / 156 - 1;
      assert(widthPulse >= 0.04 && widthPulse <= 0.05, `width pulse ${widthPulse} for ${width}/${compactWidth}`);
      assert(heightPulse >= 0.04 && heightPulse <= 0.05, `height pulse ${heightPulse} for ${compactHeight}`);
    }
  }
});

test('overshoot reversals retain silhouette position and velocity and reduced motion snaps to endpoints', () => {
  for (const width of [480, 752]) for (const tucked of [0, 1]) {
    const motion = new PanelMotion('island');
    const frame = (now: number) => islandFrame(motion.frame(now).reveal, tucked, width, 300, 54,
      300, 54, 0, motion.openingSettle(now));
    motion.setExpanded(true, 0, true);
    assert(frame(275).width > width);
    for (const [now, expanded] of [[275, false], [285, true], [295, false]] as const) {
      const h = 0.00001, before = frame(now), prior = frame(now - h);
      motion.setExpanded(expanded, now, true);
      assert.deepEqual(frame(now), before);
      const after = frame(now + h);
      for (const dimension of ['width', 'height'] as const) {
        const incomingVelocity = (before[dimension] - prior[dimension]) / h;
        const outgoingVelocity = (after[dimension] - before[dimension]) / h;
        assert(Math.abs(incomingVelocity - outgoingVelocity) < 0.0001, `${dimension} velocity at ${now}`);
      }
    }
    motion.setExpanded(false, 310, false);
    assert.equal(frame(310).width, 300);
    assert.equal(frame(310).height, 54);
    motion.setExpanded(true, 320, false);
    assert.equal(frame(320).width, width);
    assert.equal(frame(320).height, 156);
  }
});

test('folding through the end of the pulse has no silhouette velocity cusp', () => {
  for (const width of [480, 752]) for (const reverseAt of [250, 275, 300, 350]) {
    const motion = new PanelMotion('island');
    motion.setExpanded(true, 0, true);
    motion.setExpanded(false, reverseAt, true);
    let beforeZero = reverseAt, afterZero = 450;
    for (let step = 0; step < 60; step++) {
      const middle = (beforeZero + afterZero) / 2;
      if (motion.openingSettle(middle) > 0) beforeZero = middle;
      else afterZero = middle;
    }
    const zero = (beforeZero + afterZero) / 2, h = 0.0001;
    assert(motion.frame(zero).reveal > 0.91, 'Exercise directional settlement, not the approach boundary');
    const frame = (now: number) => islandFrame(motion.frame(now).reveal, 1, width, 300, 54,
      300, 54, 0, motion.openingSettle(now));
    const left = frame(zero - h), center = frame(zero), right = frame(zero + h);
    for (const dimension of ['width', 'height'] as const) {
      const incomingVelocity = (center[dimension] - left[dimension]) / h;
      const outgoingVelocity = (right[dimension] - center[dimension]) / h;
      assert(Math.abs(incomingVelocity - outgoingVelocity) < 0.001, `${dimension} cusp at ${zero}`);
    }
  }
});

test('the reserved canvas contains the painted pulse around the fixed base anchor', () => {
  const geometry = readFileSync(new URL('../../../src/app/geometry.rs', import.meta.url), 'utf8');
  const canvasScale = Number(geometry.match(/pub const CANVAS_SCALE: f64 = ([\d.]+);/)?.[1]);
  assert(Number.isFinite(canvasScale), 'Read the native canvas reservation');
  for (const width of [480, 752]) for (const compact of [148, 300, 420, 480]) {
    for (const tucked of [0, 1]) for (const minimal of [0, 1]) {
      const motion = new PanelMotion('island');
      motion.setExpanded(true, 0, true);
      for (let now = 0; now <= 650; now++) {
        const reveal = motion.frame(now).reveal;
        const shape = islandFrame(reveal, tucked, width, compact, 54, compact, 54, minimal, motion.openingSettle(now));
        for (const scale of [1, 1.15, 1.3, 1.5]) {
          const nominal = shape.compactWidth + (width - shape.compactWidth) * reveal;
          // Match the fixed 480-unit native anchor used by the main renderer.
          const left = 240 * (canvasScale - scale)
            + ((480 - shape.compactWidth) * (1 - reveal) - (shape.width - nominal)) * scale / 2;
          assert(left >= 2, `left pulse margin ${left} at width ${width}, scale ${scale}`);
          assert(left + shape.width * scale <= width * canvasScale - 2, 'right pulse margin');
          assert((shape.height + shape.lift) * scale <= 156 * canvasScale - 2, 'bottom pulse margin');
        }
      }
    }
  }
});

test('minimal Strip shrinks around the same center and can reveal the full island', () => {
  const strip = (reveal: number, minimal: number) => islandFrame(reveal, 1, 480, 148, 34, 148, 34, minimal);
  assert.equal(strip(0, 0.5).width, 102);
  assert.equal(strip(0, 1).width, 56);
  assert.equal(strip(0, 1).height + strip(0, 1).lift, 8);
  assert.deepEqual(strip(1, 1), strip(1, 0));
});

test('a notice widens Eyes and Strip while preserving their height and the expanded endpoint', () => {
  assert.equal(islandFrame(0, 0, 480, 148, 34, 320).width, 320);
  assert.equal(islandFrame(0, 1, 480, 148, 34, 320).height, 34);
  assert.equal(islandFrame(0, 1, 480, 420, 34, 320).width, 420);
  assert.deepEqual(islandFrame(1, 1, 480, 148, 34, 320), islandFrame(1, 1));
});

test('Eyes can show a lyric below the eye cluster without tucking the panel', () => {
  const shape = islandFrame(0, 0, 480, 300, 34, 300, 54);
  assert.equal(shape.width, 300);
  assert.equal(shape.height, 54);
  assert.equal(Math.abs(shape.lift), 0);
  assert.equal(shape.eyeOpacity, 1);
  assert.deepEqual(islandFrame(1, 0, 480, 300, 34, 300, 54), islandFrame(1));
});

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

test('zero-progress arc hiding participates in the drain transition', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const arc = /\.panel:not\(\[data-reduced-motion="true"\]\) \.ring-progress\s*\{([^}]+)\}/.exec(css)?.[1] ?? '';
  assert.match(arc, /stroke-dashoffset\s+[\d.]+m?s/);
  assert.match(arc, /visibility\s+(?!0(?:m?s)?\b)[\d.]+m?s/,
    'hiding at zero must wait for the visible drain instead of cutting it off');
});

test('cursor following is visible and rejects invalid or excessive offsets', () => {
  assert.equal(gazeOffset(0), 0);
  assert.equal(gazeOffset(0.5), 3);
  assert.equal(gazeOffset(-10), -6);
  assert.equal(gazeOffset(10), 6);
  assert.equal(gazeOffset(NaN), 0);
});

test('the compact row hides eyes while retaining room for future status content', () => {
  const eyes = islandFrame(0, 0);
  const strip = islandFrame(0, 1);
  const eyeCenter = 17;
  const eyeHalfHeight = 13 / 2;
  assert(eyeCenter - eyeHalfHeight + eyes.lift >= 0);
  assert(eyeCenter + eyeHalfHeight + eyes.lift < eyes.height + eyes.lift);
  assert.equal(eyes.eyeOpacity, 1);
  assert.equal(strip.eyeOpacity, 0);
  assert.equal(islandFrame(0, 0.5).eyeOpacity, 0.5);
  assert.equal(strip.height + strip.lift, 24);
});

test('the wider silhouette has stable endpoints regardless of the previous compact pose', () => {
  assert.deepEqual(islandFrame(1, 0), islandFrame(1, 1));
  assert.equal(islandFrame(0).width, 148);
  assert.equal(islandFrame(0).height, 34);
  assert.equal(islandFrame(1, 1).width, 480);
  assert.equal(islandFrame(1, 1).height, 156);
});

test('widening the expanded canvas preserves a centered footprint through reveal', () => {
  for (const reveal of [0, 0.25, 0.5, 0.75, 1]) {
    const shape = islandFrame(reveal);
    const left = (480 - shape.width) / 2;
    assert.equal(left + shape.width / 2, 240);
    assert.equal(shape.height, 34 + 122 * reveal);
  }
});

test('lyrics grows the expanded silhouette without changing compact geometry', () => {
  assert.deepEqual(islandFrame(0, 1, 752), islandFrame(0, 1));
  assert.equal(islandFrame(1, 0, 752).width, 752);
  assert.equal(islandFrame(1, 0, 752).height, 156);
});

test('both compact silhouettes start their shoulders at the visible screen edge', () => {
  for (const tucked of [0, .5, 1]) {
    const shape = islandFrame(0, tucked);
    const numbers = shape.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    assert.equal(numbers[1]! + shape.lift, 0);
    assert.equal(numbers[7]! + shape.lift, 7);
    assert.equal(numbers[6], 8);
    assert.equal(shape.width, 148);
  }
});

test('a wider multiline Strip leaves the Eyes and Expanded endpoints intact', () => {
  const strip = islandFrame(0, 1, 480, 420, 56);
  assert.equal(strip.width, 420);
  assert.equal(strip.height, 56);
  assert.deepEqual(islandFrame(0, 0, 480, 420, 56), islandFrame(0, 0));
  assert.deepEqual(islandFrame(1, 1, 480, 420, 56), islandFrame(1, 1));
});
