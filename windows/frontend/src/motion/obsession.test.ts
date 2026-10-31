import assert from 'node:assert/strict';
import test from 'node:test';
import { ObsessionMotion, obsessionDuration, type ObsessionCue, type ObsessionState } from './obsession.ts';

function fixture(random = 0) {
  let now = 0;
  let handle = 0;
  const timers = new Map<number, { callback: () => void; at: number }>();
  const cleared: (() => void)[] = [];
  const cues: (ObsessionCue | null)[] = [];
  const motion = new ObsessionMotion({
    now: () => now,
    set(callback, delay) { timers.set(++handle, { callback, at: now + delay }); return handle; },
    clear(value) {
      const timer = timers.get(value as number);
      if (timer) cleared.push(timer.callback);
      timers.delete(value as number);
    },
  }, cue => cues.push(cue), () => random);
  let state: ObsessionState = { enabled: true, visible: true, reducedMotion: false, presentation: 'expanded', transitionId: 1 };
  const update = (next: Partial<ObsessionState> = {}) => { state = { ...state, ...next }; motion.setState(state); };
  const advance = (elapsed: number) => {
    const target = now + elapsed;
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = target;
  };
  const gesture = () => cues.at(-1)?.gesture;
  return { motion, update, advance, gesture, cues, timers, cleared };
}

test('ON snaps once, holds direct gaze, then schedules a sparse finite gesture', () => {
  const f = fixture();
  f.update();
  assert.equal(f.gesture(), 'snap');
  assert.equal(f.timers.size, 1);
  f.update();
  assert.equal(f.cues.length, 1);
  f.advance(obsessionDuration.snap);
  assert.equal(f.gesture(), undefined);
  assert.equal(f.timers.size, 1);
  f.advance(18_000);
  assert.equal(f.gesture(), 'smile');
  f.advance(obsessionDuration.smile);
  assert.equal(f.gesture(), undefined);
});

test('all expanded sparse expressions can be selected; compact Eyes never fake sleep without pointer events', () => {
  const gestures = ['smile', 'stare', 'distress', 'falseSleep', 'thread', 'compatibility', 'rehearsal', 'bouquet', 'mend', 'encourage', 'juggle', 'laptop', 'sharedActivity'] as const;
  for (const [index, gesture] of gestures.entries()) {
    const random = (index + .1) / gestures.length;
    const f = fixture(random);
    f.motion.setFocusRunning(true);
    f.update();
    f.advance(obsessionDuration.snap + 18_000 + random * 22_000);
    assert.equal(f.gesture(), gesture);
  }
  const f = fixture();
  f.update({ presentation: 'eyes' });
  assert.equal(f.gesture(), undefined);
  f.advance(18_000);
  assert.equal(f.gesture(), 'stare');
  for (const random of [.6, .9, 1]) {
    const compact = fixture(random);
    compact.update({ presentation: 'eyes' });
    compact.advance(18_000 + random * 22_000);
    assert.equal(compact.gesture(), 'stare', 'compact Eyes have no pointer events to wake false sleep');
  }
});

test('OFF immediately cancels ON cues, plays only bounded no-no/relief, then has no timer', () => {
  const f = fixture();
  f.update();
  f.update({ enabled: false });
  assert.equal(f.gesture(), 'farewell');
  f.motion.resume();
  f.motion.timerCancelled();
  f.motion.timerStarted();
  f.motion.timerBreakStarted();
  f.motion.timerPaused();
  f.motion.timerCompleted();
  f.motion.clockChanged('11:11');
  f.motion.pointer({ target: 'mascot', x: 100, y: 80 });
  assert.equal(f.gesture(), 'farewell');
  f.advance(obsessionDuration.farewell);
  assert.equal(f.gesture(), undefined);
  assert.equal(f.timers.size, 0);
  f.advance(100_000);
  assert.equal(f.gesture(), undefined);
  for (const callback of f.cleared) callback();
  assert.equal(f.gesture(), undefined, 'a stale ON completion cannot restart idle behavior');
});

test('settings toggles made compact/hidden retain one reveal cue and rapid reversals replace it', () => {
  const f = fixture();
  f.update({ visible: false, presentation: 'strip' });
  assert.equal(f.timers.size, 0);
  f.update({ enabled: false });
  f.update({ visible: true, presentation: 'expanded' });
  assert.equal(f.gesture(), 'farewell');
  f.update({ enabled: true });
  assert.equal(f.gesture(), 'snap');
  f.advance(obsessionDuration.snap);
  assert.equal(f.gesture(), undefined);
  assert.equal(f.cues.filter(cue => cue?.gesture === 'farewell').length, 1);
});

test('pending reveal cues expire without hidden wakeups and reduced motion drops them', () => {
  const f = fixture();
  f.update({ visible: false });
  f.advance(60_001);
  f.update({ visible: true });
  assert.equal(f.gesture(), undefined);
  const g = fixture();
  g.update({ presentation: 'strip' });
  g.update({ reducedMotion: true });
  g.update({ reducedMotion: false, presentation: 'expanded' });
  assert.equal(g.gesture(), undefined);
});

test('hover dwell fires once per visit, never captures pointer, and cancels on leave', () => {
  const f = fixture();
  f.update();
  f.advance(obsessionDuration.snap);
  f.motion.pointer({ target: 'mascot', x: 100, y: 80 });
  f.advance(999);
  assert.equal(f.gesture(), undefined);
  f.motion.pointer({ target: 'none', x: 0, y: 0 });
  f.advance(1);
  assert.equal(f.gesture(), undefined);
  f.motion.pointer({ target: 'mascot', x: 100, y: 80 });
  f.advance(1000);
  assert.equal(f.gesture(), 'hug');
  f.motion.pointer({ target: 'mascot', x: 120, y: 90 });
  f.advance(obsessionDuration.hug + 1000);
  assert.equal(f.gesture(), undefined);
  assert.equal(f.cues.filter(cue => cue?.gesture === 'hug').length, 1);
  f.motion.pointer({ target: 'clock', x: 300, y: 20 });
  f.advance(700);
  assert.equal(f.gesture(), 'jealous');
  f.motion.pointer({ target: 'none', x: 0, y: 0 });
  assert.equal(f.gesture(), undefined);
});

test('resume widens Eyes, Strip queues waited for reveal, and cancellation reacts only while expanded', () => {
  const f = fixture();
  f.update({ presentation: 'eyes' });
  f.motion.resume();
  assert.equal(f.gesture(), 'waited');
  f.motion.timerCancelled();
  assert.equal(f.gesture(), 'waited');
  f.update({ presentation: 'expanded', transitionId: 2 });
  f.motion.timerCancelled();
  assert.equal(f.gesture(), 'disappointed');
  f.update({ presentation: 'strip', transitionId: 3 });
  f.motion.resume();
  f.advance(obsessionDuration.clutch);
  f.update({ presentation: 'expanded', transitionId: 4 });
  assert.equal(f.gesture(), 'waited');
});

test('moving directly between active hover poses starts the new target dwell', () => {
  const f = fixture();
  f.update();
  f.advance(obsessionDuration.snap);
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  f.advance(1000);
  assert.equal(f.gesture(), 'hug');
  f.motion.pointer({ target: 'clock', x: 350, y: 20 });
  assert.equal(f.gesture(), undefined);
  f.advance(700);
  assert.equal(f.gesture(), 'jealous');
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  assert.equal(f.gesture(), undefined);
  f.advance(1000);
  assert.equal(f.gesture(), 'hug');
});

test('leaving an active hover pose searches after mascot departure, then resumes sparse idle gestures', () => {
  for (const target of ['mascot', 'clock'] as const) {
    const f = fixture();
    f.update();
    f.advance(obsessionDuration.snap);
    f.motion.pointer({ target, x: 110, y: 85 });
    f.advance(target === 'mascot' ? 1000 : 700);
    assert.equal(f.gesture(), target === 'mascot' ? 'hug' : 'jealous');
    f.motion.pointer({ target: 'none', x: 0, y: 0 });
    assert.equal(f.gesture(), undefined);
    if (target === 'mascot') {
      f.advance(400);
      assert.equal(f.gesture(), 'search');
      f.advance(obsessionDuration.search);
    }
    f.advance(18_000);
    assert.equal(f.gesture(), 'smile', 'hover exit must restart sparse behavior without another state update');
  }
});

test('fold clutches immediately without delaying state; a new reveal counts one visit', () => {
  const f = fixture();
  f.update();
  f.advance(obsessionDuration.snap);
  f.update({ presentation: 'eyes', transitionId: 2 });
  assert.equal(f.gesture(), 'clutch');
  f.update();
  assert.equal(f.cues.filter(cue => cue?.gesture === 'clutch').length, 1);
  f.update({ presentation: 'expanded', transitionId: 3 });
  assert.equal(f.gesture(), 'visit');
  assert.equal(f.cues.at(-1)?.count, 2);
  f.update();
  assert.equal(f.cues.filter(cue => cue?.gesture === 'visit').length, 1);
  for (const callback of f.cleared) callback();
  assert.equal(f.gesture(), 'visit');
});

test('hide, reduced motion and disposal cancel every timer and pose; stale callbacks are inert', () => {
  for (const change of [{ visible: false }, { reducedMotion: true }] as const) {
    const f = fixture();
    f.update();
    f.advance(obsessionDuration.snap);
    f.motion.pointer({ target: 'mascot', x: 100, y: 80 });
    assert.equal(f.timers.size, 2);
    f.update(change);
    assert.equal(f.timers.size, 0);
    assert.equal(f.gesture(), undefined);
    for (const callback of f.cleared) callback();
    assert.equal(f.timers.size, 0);
    f.update({ visible: true, reducedMotion: false });
    f.advance(1000);
    assert.equal(f.gesture(), undefined, 'a stale hover cannot replay on return');
  }
  const f = fixture();
  f.update();
  f.motion.dispose();
  f.motion.dispose();
  f.update({ enabled: false });
  f.motion.resume();
  f.motion.timerCancelled();
  f.motion.timerStarted();
  f.motion.timerBreakStarted();
  f.motion.timerPaused();
  f.motion.timerCompleted();
  f.motion.clockChanged('22:22');
  for (const callback of f.cleared) callback();
  assert.equal(f.timers.size, 0);
  assert.equal(f.gesture(), undefined);
});

test('Pomodoro events show plans, patience and the completion heart as distinct finite cues', () => {
  const f = fixture();
  f.update();
  for (const [event, gesture] of [
    ['timerStarted', 'plans'], ['timerBreakStarted', 'tea'], ['timerPaused', 'patience'], ['timerCompleted', 'spareHeart'],
  ] as const) {
    f.motion[event]();
    assert.equal(f.gesture(), gesture);
    assert.equal(f.timers.size, 1);
    f.advance(obsessionDuration[gesture]);
    if (gesture === 'plans') {
      assert.equal(f.gesture(), 'kiss');
      f.advance(obsessionDuration.kiss);
    }
    assert.equal(f.gesture(), undefined);
    assert.equal(f.timers.size, 1, 'only a sparse idle timer remains');
  }
});

test('completion hearts queue one compact reveal, expire without wakeups and stop when noticed', () => {
  const f = fixture();
  f.update({ presentation: 'strip' });
  f.motion.timerCompleted();
  assert.equal(f.timers.size, 0);
  f.update({ presentation: 'expanded', transitionId: 2 });
  assert.equal(f.gesture(), 'spareHeart');
  assert.equal(f.cues.at(-1)?.noticed, false);
  f.motion.pointer({ target: 'mascot', x: 100, y: 80 });
  assert.equal(f.gesture(), undefined, 'noticing the first heart prevents the larger one');
  f.motion.timerCompleted();
  assert.equal(f.gesture(), 'spareHeart');
  assert.equal(f.cues.at(-1)?.noticed, true, 'the small heart still appears, but the larger heart is omitted when noticed');
  const expired = fixture();
  expired.update({ presentation: 'strip' });
  expired.motion.timerCompleted();
  expired.advance(60_001);
  expired.update({ presentation: 'expanded', transitionId: 2 });
  assert.equal(expired.gesture(), undefined);
});

test('false sleep wakes one eye on mascot entry, once, without scheduling pointer polling', () => {
  const random = 3.1 / 13;
  const f = fixture(random);
  f.update();
  f.advance(obsessionDuration.snap + 18_000 + random * 22_000);
  assert.equal(f.gesture(), 'falseSleep');
  f.motion.pointer({ target: 'mascot', x: 100, y: 80 });
  assert.equal(f.gesture(), 'peek');
  assert.equal(f.timers.size, 1);
  f.motion.pointer({ target: 'mascot', x: 101, y: 81 });
  assert.equal(f.cues.filter(cue => cue?.gesture === 'peek').length, 1);
  f.advance(obsessionDuration.peek);
  assert.equal(f.gesture(), undefined);
  f.advance(1000);
  assert.equal(f.gesture(), undefined, 'wake does not immediately chain into a hug');
  f.advance(18_000 + random * 22_000 - 1000);
  assert.equal(f.gesture(), 'stare', 'an observed mascot does not pretend to sleep again');
});

test('visit count follows actual reveals, ignores duplicate state updates and resets on OFF', () => {
  const f = fixture();
  f.update();
  f.advance(obsessionDuration.snap);
  f.update({ presentation: 'eyes', transitionId: 2 });
  f.update({ presentation: 'expanded', transitionId: 3 });
  assert.equal(f.gesture(), 'visit');
  assert.equal(f.cues.at(-1)?.count, 2);
  f.update({ transitionId: 4 });
  assert.equal(f.gesture(), undefined);
  f.update({ presentation: 'eyes', transitionId: 5 });
  f.update({ presentation: 'expanded', transitionId: 6 });
  assert.equal(f.cues.at(-1)?.count, 3);
  f.update({ enabled: false });
  f.update({ enabled: true });
  f.advance(obsessionDuration.snap);
  f.update({ presentation: 'eyes', transitionId: 7 });
  f.update({ presentation: 'expanded', transitionId: 8 });
  assert.equal(f.gesture(), undefined, 'the first reveal in a new enabled session has no repeated-visit caption');
});

test('matching clock digits celebrate once per minute and wait for an active pose to finish', () => {
  const f = fixture();
  f.update();
  f.motion.clockChanged('11:11');
  assert.equal(f.gesture(), 'snap');
  f.advance(obsessionDuration.snap);
  assert.equal(f.gesture(), 'coincidence');
  f.motion.clockChanged('1111');
  assert.equal(f.cues.filter(cue => cue?.gesture === 'coincidence').length, 1);
  f.advance(obsessionDuration.coincidence);
  for (const invalid of ['11:12', '25:25', 'abc', '1:1']) f.motion.clockChanged(invalid);
  assert.equal(f.gesture(), undefined);
  f.motion.clockChanged('22:22');
  assert.equal(f.gesture(), 'coincidence');
  f.update({ visible: false });
  f.motion.clockChanged('00:00');
  assert.equal(f.gesture(), undefined);
  assert.equal(f.timers.size, 0);
  f.update({ visible: true });
  f.motion.clockChanged('00:00');
  assert.equal(f.gesture(), undefined, 'a hidden coincidence cannot replay after returning');
});

test('new event cues respect hidden, compact, reduced-motion and disabled boundaries', () => {
  for (const change of [{ visible: false }, { enabled: false }, { reducedMotion: true }, { presentation: 'eyes' }] as const) {
    const f = fixture();
    f.update(change);
    const before = f.cues.length;
    f.motion.timerStarted();
    f.motion.timerBreakStarted();
    f.motion.timerPaused();
    f.motion.clockChanged('11:11');
    assert.equal(f.cues.length, before);
    f.motion.timerCompleted();
    assert.equal(f.cues.length, before, 'completion may queue while compact but never renders there');
  }
  const f = fixture();
  f.update();
  f.motion.clockChanged('11:11');
  f.motion.clockChanged('11:12');
  f.advance(obsessionDuration.snap);
  assert.equal(f.gesture(), undefined, 'an outdated matching minute does not replay after a pose');
});

test('cursor departure searches once, while return, clock transfer and folding cancel the delayed reaction', () => {
  const f = fixture();
  f.update();
  f.advance(obsessionDuration.snap);
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  f.motion.pointer({ target: 'none', x: 190, y: 70 });
  f.advance(399);
  assert.equal(f.gesture(), undefined);
  f.advance(1);
  assert.equal(f.gesture(), 'search');
  f.motion.pointer({ target: 'none', x: 191, y: 70 });
  assert.equal(f.cues.filter(cue => cue?.gesture === 'search').length, 1);
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  assert.equal(f.gesture(), undefined, 'finding the cursor stops searching immediately');
  f.motion.pointer({ target: 'clock', x: 350, y: 20 });
  f.advance(400);
  assert.equal(f.gesture(), undefined, 'mascot-to-clock movement is not losing the cursor');
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  f.motion.pointer({ target: 'none', x: 190, y: 190 });
  f.advance(200);
  f.update({ presentation: 'eyes', transitionId: 2 });
  f.advance(400);
  assert.equal(f.gesture(), 'clutch');
  assert.equal(f.cues.filter(cue => cue?.gesture === 'search').length, 1);
  for (const callback of f.cleared) callback();
  assert.equal(f.gesture(), 'clutch', 'stale departure callbacks cannot replace the fold');
});

test('return before departure delay prevents stale search even after leaving again', () => {
  const f = fixture();
  f.update();
  f.advance(obsessionDuration.snap);
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  f.motion.pointer({ target: 'none', x: 190, y: 70 });
  f.advance(300);
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  f.motion.pointer({ target: 'none', x: 190, y: 70 });
  for (const callback of f.cleared) callback();
  assert.equal(f.gesture(), undefined);
  f.advance(399);
  assert.equal(f.gesture(), undefined);
  f.advance(1);
  assert.equal(f.gesture(), 'search');
});

test('rehearsal stays private, stops on approach and permits ordinary mascot dwell', () => {
  const random = 6.1 / 13;
  const f = fixture(random);
  f.update();
  f.advance(obsessionDuration.snap + 18_000 + random * 22_000);
  assert.equal(f.gesture(), 'rehearsal');
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  assert.equal(f.gesture(), undefined);
  f.advance(1000);
  assert.equal(f.gesture(), 'hug');
  f.advance(obsessionDuration.hug + 18_000 + random * 22_000);
  assert.equal(f.gesture(), 'stare', 'a watched mascot does not rehearse a greeting');
});

test('new scenes end cleanly and cannot survive hide, OFF, reduced motion or disposal', () => {
  for (const random of [6.1 / 13, 7.1 / 13, 8.1 / 13]) {
    for (const change of [{ visible: false }, { enabled: false }, { reducedMotion: true }] as const) {
      const f = fixture(random);
      f.update();
      f.advance(obsessionDuration.snap + 18_000 + random * 22_000);
      assert(['rehearsal', 'bouquet', 'mend'].includes(f.gesture()!));
      f.update(change);
      if ('enabled' in change) f.advance(obsessionDuration.farewell);
      for (const callback of f.cleared) callback();
      assert.equal(f.gesture(), undefined);
      assert.equal(f.timers.size, 0);
    }
  }
  const f = fixture();
  f.update();
  f.motion.timerBreakStarted();
  assert.equal(f.gesture(), 'tea');
  f.motion.dispose();
  f.motion.timerBreakStarted();
  for (const callback of f.cleared) callback();
  assert.equal(f.gesture(), undefined);
  assert.equal(f.timers.size, 0);
});

test('focus start sends one kiss after plans, before a queued clock reaction', () => {
  const f = fixture();
  f.update();
  f.motion.timerStarted();
  assert.equal(f.gesture(), 'plans');
  f.motion.clockChanged('11:11');
  f.advance(obsessionDuration.plans - 1);
  assert.equal(f.gesture(), 'plans');
  f.advance(1);
  assert.equal(f.gesture(), 'kiss');
  assert.equal(f.timers.size, 1);
  f.advance(obsessionDuration.kiss);
  assert.equal(f.gesture(), 'coincidence');
  f.advance(obsessionDuration.coincidence);
  assert.equal(f.gesture(), undefined);
  assert.equal(f.cues.filter(cue => cue?.gesture === 'kiss').length, 1);
  assert.equal(f.timers.size, 1, 'only sparse idle scheduling remains after the finite chain');
});

test('focus kiss cannot survive replacement cues, state boundaries or disposal', () => {
  for (const replace of [
    (f: ReturnType<typeof fixture>) => f.motion.timerPaused(),
    (f: ReturnType<typeof fixture>) => f.motion.timerCancelled(),
    (f: ReturnType<typeof fixture>) => f.motion.timerBreakStarted(),
    (f: ReturnType<typeof fixture>) => f.motion.timerCompleted(),
    (f: ReturnType<typeof fixture>) => f.motion.resume(),
    (f: ReturnType<typeof fixture>) => f.motion.doubleClick({ x: 110, y: 85 }),
    (f: ReturnType<typeof fixture>) => f.update({ enabled: false }),
    (f: ReturnType<typeof fixture>) => f.update({ visible: false }),
    (f: ReturnType<typeof fixture>) => f.update({ reducedMotion: true }),
    (f: ReturnType<typeof fixture>) => f.update({ presentation: 'eyes', transitionId: 2 }),
    (f: ReturnType<typeof fixture>) => f.update({ transitionId: 2 }),
    (f: ReturnType<typeof fixture>) => f.motion.dispose(),
  ]) {
    const f = fixture();
    f.update();
    f.motion.timerStarted();
    f.advance(500);
    replace(f);
    f.advance(9000);
    for (const callback of f.cleared) callback();
    assert.equal(f.cues.some(cue => cue?.gesture === 'kiss'), false);
  }
  const restarted = fixture();
  restarted.update();
  restarted.motion.timerStarted();
  restarted.advance(1000);
  restarted.motion.timerStarted();
  for (const callback of restarted.cleared) callback();
  restarted.advance(obsessionDuration.plans - 1);
  assert.equal(restarted.gesture(), 'plans', 'an old completion cannot start the new kiss early');
  restarted.advance(1);
  assert.equal(restarted.gesture(), 'kiss');
});

test('double click draws copied finite hearts only over the enabled expanded mascot', () => {
  const f = fixture();
  f.update();
  for (const point of [
    { x: NaN, y: 85 }, { x: 110, y: Infinity }, { x: 59.99, y: 85 },
    { x: 175, y: 85 }, { x: 110, y: 44.99 }, { x: 110, y: 125 },
  ]) f.motion.doubleClick(point);
  assert.equal(f.gesture(), 'snap');
  const point = { x: 60, y: 45 };
  f.motion.doubleClick(point);
  point.x = 999;
  assert.equal(f.gesture(), 'drawnHearts');
  assert.deepEqual(f.cues.at(-1)?.point, { x: 60, y: 45 });
  assert.equal(f.timers.size, 1);
  f.advance(1000);
  f.motion.doubleClick({ x: 174.99, y: 124.99 });
  for (const callback of f.cleared) callback();
  f.advance(obsessionDuration.drawnHearts - 1);
  assert.equal(f.gesture(), 'drawnHearts');
  f.advance(1);
  assert.equal(f.gesture(), undefined);
  assert.equal(f.timers.size, 1);
  for (const change of [{ visible: false }, { enabled: false }, { reducedMotion: true }, { presentation: 'eyes' }] as const) {
    const blocked = fixture();
    blocked.update(change);
    const before = blocked.cues.length;
    blocked.motion.doubleClick({ x: 110, y: 85 });
    assert.equal(blocked.cues.length, before);
  }
  f.motion.dispose();
  f.motion.doubleClick({ x: 110, y: 85 });
  for (const callback of f.cleared) callback();
  assert.equal(f.timers.size, 0);
});

test('shared activity changes are explicit, bounded, and preserve the latest selection', () => {
  const f = fixture();
  f.motion.setActivity('writing');
  assert.equal(f.cues.length, 0, 'hidden selection changes do not play');
  f.update();
  f.advance(obsessionDuration.snap);
  f.motion.setActivity('coding');
  assert.equal(f.gesture(), 'sharedActivity');
  assert.equal(f.cues.at(-1)?.activity, 'coding');
  const count = f.cues.length;
  f.motion.setActivity('coding');
  assert.equal(f.cues.length, count, 'duplicate preference renders do not restart the scene');
  f.advance(obsessionDuration.sharedActivity);
  assert.equal(f.gesture(), undefined);
  f.update({ reducedMotion: true });
  f.motion.setActivity('reading');
  assert.equal(f.gesture(), undefined);
  f.update({ enabled: false });
  f.motion.setActivity('writing');
  assert.equal(f.gesture(), undefined);
});

test('laptop requires running focus and shuts on approach or focus ending', () => {
  const random = 11.1 / 13;
  const idleAt = obsessionDuration.snap + 18_000 + random * 22_000;
  const paused = fixture(random);
  paused.update();
  paused.advance(idleAt);
  assert.equal(paused.gesture(), 'stare');
  const f = fixture(random);
  f.motion.setFocusRunning(true);
  f.update();
  f.advance(idleAt);
  assert.equal(f.gesture(), 'laptop');
  f.motion.pointer({ target: 'mascot', x: 110, y: 85 });
  assert.equal(f.gesture(), undefined, 'approaching shuts the laptop immediately');
  f.motion.pointer({ target: 'none', x: 190, y: 70 });
  f.advance(400 + obsessionDuration.search + 18_000 + random * 22_000);
  assert.equal(f.gesture(), 'laptop');
  f.motion.setFocusRunning(false);
  assert.equal(f.gesture(), undefined, 'pause, completion, break and information pages end focus');
  const latest = f.cues.length;
  for (const callback of f.cleared) callback();
  assert.equal(f.cues.length, latest, 'stale completions cannot reopen the laptop');
});

test('new idle scenes never play while compact or after hidden/reduced/off boundaries', () => {
  for (const random of [9.1 / 13, 10.1 / 13, 11.1 / 13, 12.1 / 13]) {
    const f = fixture(random);
    f.motion.setFocusRunning(true);
    f.update({ presentation: 'eyes' });
    f.advance(18_000 + random * 22_000);
    assert.equal(f.gesture(), 'stare');
    f.update({ visible: false });
    f.motion.setActivity('coding');
    f.advance(100_000);
    assert.equal(f.gesture(), undefined);
    assert.equal(f.timers.size, 0);
    f.motion.dispose();
    f.motion.setFocusRunning(true);
    f.motion.setActivity('writing');
    assert.equal(f.timers.size, 0);
  }
});
