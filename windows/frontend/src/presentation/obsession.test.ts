import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Presentation geometry needs no browser. Ignore its stylesheet when loading the module in Node.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { clockHandReach, drawnHeartOrigin, mountObsession } = await import('./obsession.ts');
const { obsessionDuration } = await import('../motion/obsession.ts');

test('jealous hand reaches the actual clock edge without covering any digits', () => {
  for (const origin of [0, 240, -800]) {
    const hand = { left: origin + 148, top: 90, width: 22 };
    const clock = { left: origin + 350, bottom: 32 };
    const reach = clockHandReach(hand, clock);
    const landed = { left: hand.left + reach.x, top: hand.top + reach.y };
    assert(landed.left <= clock.left && landed.left + hand.width >= clock.left,
      'the hand must touch the rendered clock edge, including translated monitor coordinates');
    assert(landed.top >= clock.bottom, 'the entire hand stays below the digits');
    assert(landed.top <= clock.bottom + 3, 'the hand reaches the clock, rather than waving below the body');
  }
});

test('drawn hearts follow local clicks while staying inside the mascot at different image scales', () => {
  const origin = drawnHeartOrigin({ x: 114, y: 84 }, { x: 40, y: 0, size: 150 });
  const scaled = drawnHeartOrigin({ x: 228, y: 168 }, { x: 80, y: 0, size: 300 });
  assert.deepEqual(origin, scaled, 'the same physical face location produces the same source coordinates after scaling');
  assert(origin.x > 470 && origin.x < 780);
  assert(origin.y > 670 && origin.y < 790);
  assert.deepEqual(drawnHeartOrigin({ x: -500, y: -500 }, { x: 40, y: 0, size: 150 }), { x: 470, y: 670 });
  assert.deepEqual(drawnHeartOrigin({ x: 500, y: 500 }, { x: 40, y: 0, size: 150 }), { x: 780, y: 790 });
});

test('every gesture renders finite poses, localizes captions and releases all decorative resources', t => {
  const calls: { name: string; frames: Keyframe[]; duration: number; cancelled: boolean }[] = [];
  const created: Surface[] = [];
  class Surface {
    className = '';
    hidden = false;
    textContent = '';
    innerHTML = '';
    src = '';
    removed = false;
    dataset: Record<string, string> = {};
    parentElement: Surface | undefined;
    classes = new Set<string>();
    classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
    values = new Map<string, string>();
    style = { setProperty: (key: string, value: string) => this.values.set(key, value), getPropertyValue: (key: string) => this.values.get(key) ?? '' };
    children = new Map<string, Surface>();
    attributes = new Map<string, string>();
    readonly name: string;
    constructor(name: string) { this.name = name; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    append() {}
    insertBefore() {}
    remove() { this.removed = true; }
    querySelector(selector: string): Surface {
      if (!this.children.has(selector)) this.children.set(selector, new Surface(selector));
      return this.children.get(selector)!;
    }
    querySelectorAll(selector: string): Surface[] {
      if (selector === '.obsession-drawn-heart') return ['first', 'middle', 'last'].map(name => this.querySelector(`${selector}:${name}`));
      return [this.querySelector(`${selector}:first`), this.querySelector(`${selector}:last`)];
    }
    getBoundingClientRect() {
      return this.name === '.header-status .clock' ? { left: 350, bottom: 32 }
        : { left: 148, top: 90, width: 22 };
    }
    animate(frames: Keyframe[], options: { duration: number }) {
      const call = { name: this.name, frames, duration: options.duration, cancelled: false };
      calls.push(call);
      return { cancel() { call.cancelled = true; } };
    }
  }
  const originalDocument = globalThis.document;
  const originalComputedStyle = globalThis.getComputedStyle;
  globalThis.document = { createElement() { const node = new Surface('created'); created.push(node); return node; } } as unknown as Document;
  globalThis.getComputedStyle = (() => ({ getPropertyValue: (key: string) => key === '--eye-x' ? '114' : '84' })) as unknown as typeof getComputedStyle;
  t.after(() => {
    globalThis.document = originalDocument;
    globalThis.getComputedStyle = originalComputedStyle;
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let random = 0;
  t.mock.method(Math, 'random', () => random);
  const panel = new Surface('panel');
  const image = new Surface('source');
  image.parentElement = new Surface('mascot');
  let language = 'first';
  const ownership: boolean[] = [];
  const view = mountObsession(panel as unknown as HTMLElement, image as unknown as HTMLImageElement,
    key => `${language}:${key}${key === 'obsession.visits' ? ' {count}' : ''}`, owned => ownership.push(owned));
  const caption = created.find(node => node.className === 'obsession-caption')!;
  const backs = created.find(node => node.className === 'obsession-eye-backs')!;
  const bodyBacks = created.find(node => node.className === 'obsession-body-backs')!;
  assert.equal(bodyBacks.hidden, true);
  let state = { enabled: true, visible: true, reducedMotion: false, presentation: 'expanded' as 'expanded' | 'eyes', transitionId: 1 };
  let checked = 0;
  function pose(gesture: string) {
    assert.equal(panel.dataset.obsessionPose, gesture);
    assert.equal(view.ownsEyes, true);
    assert.equal(image.classes.has('obsession-source'), true);
    assert.equal(backs.hidden, false, 'dark body patches must back the removed original eyes throughout the pose');
    assert.equal(bodyBacks.hidden, false, 'torso patches must back the original hand overlap throughout the pose');
    const newCalls = calls.slice(checked);
    assert(newCalls.length > 0, `${gesture} must animate visible parts`);
    for (const call of newCalls) {
      assert(call.duration > 0 && call.duration <= 3400, `${gesture} must finish within its bounded duration`);
      assert(call.frames.length >= 2);
    }
    checked = calls.length;
  }
  view.setState(state);
  pose('snap');
  t.mock.timers.tick(2000);
  assert.equal(backs.hidden, false, 'enabled heart eyes need the same opaque backing between cues');
  assert.equal(image.classes.has('obsession-heart-source'), true);
  assert.equal(panel.dataset.obsessionEnabled, 'true');
  assert.equal(bodyBacks.hidden, true);
  view.timerCancelled();
  pose('disappointed');
  assert.equal(caption.textContent, 'first:obsession.date');
  language = 'second';
  view.refreshLocale();
  assert.equal(caption.textContent, 'second:obsession.date');
  t.mock.timers.tick(2600);
  view.resume();
  pose('waited');
  assert.equal(caption.textContent, 'second:obsession.waited');
  t.mock.timers.tick(2600);
  view.pointer({ target: 'mascot', x: 114, y: 84 });
  t.mock.timers.tick(1000);
  pose('hug');
  view.pointer({ target: 'clock', x: 350, y: 20 });
  t.mock.timers.tick(700);
  pose('jealous');
  view.pointer({ target: 'none', x: 0, y: 0 });
  state = { ...state, presentation: 'eyes', transitionId: 2 };
  view.setState(state);
  pose('clutch');
  t.mock.timers.tick(480);
  state = { ...state, presentation: 'expanded', transitionId: 3 };
  view.setState(state);
  pose('visit');
  assert.equal(caption.textContent, 'second:obsession.visits 2');
  const parts = created.find(node => node.className === 'obsession-parts')!;
  assert.equal(parts.querySelector('.obsession-visit-old').textContent, '1');
  assert.equal(parts.querySelector('.obsession-visit-new').textContent, '2');
  t.mock.timers.tick(obsessionDuration.visit);
  view.timerStarted();
  pose('plans');
  assert.equal(caption.textContent, 'second:obsession.plans');
  t.mock.timers.tick(obsessionDuration.plans);
  pose('kiss');
  assert(calls.some(call => !call.cancelled && call.name === '.obsession-kiss-heart'
    && call.frames.some(frame => String(frame.transform).includes('290px,-220px'))), 'the kiss heart travels outward from the mouth');
  t.mock.timers.tick(obsessionDuration.kiss);
  view.timerBreakStarted();
  pose('tea');
  assert(calls.slice(-5).some(call => call.name === '.obsession-cup-right'
    && call.frames.some(frame => String(frame.transform).includes('140px'))), 'the second cup is offered toward the edge');
  assert(calls.some(call => !call.cancelled && call.name === '.obsession-sandwich'
    && call.frames.some(frame => String(frame.transform).includes('scale(1.08)'))), 'a visible sandwich is offered during the break scene');
  t.mock.timers.tick(obsessionDuration.tea);
  view.doubleClick({ x: 114, y: 84 });
  pose('drawnHearts');
  const drawing = calls.filter(call => !call.cancelled && call.name.startsWith('.obsession-drawn-heart:'));
  assert.equal(drawing.length, 3, 'all three decorative hearts draw in sequence');
  assert(drawing.every(call => call.frames[0]?.strokeDashoffset === 100 && call.frames.at(-1)?.strokeDashoffset === 0));
  const firstPlacement = parts.querySelector('.obsession-drawn-hearts').attributes.get('transform');
  view.doubleClick({ x: 170, y: 120 });
  pose('drawnHearts');
  assert(drawing.every(call => call.cancelled), 'a repeated double click releases the previous heart drawing');
  assert.notEqual(parts.querySelector('.obsession-drawn-hearts').attributes.get('transform'), firstPlacement,
    'the newly clicked face area positions the bounded decoration');
  t.mock.timers.tick(obsessionDuration.drawnHearts);
  assert(calls.every(call => call.cancelled), 'finite drawing completion releases each animation');
  view.timerPaused();
  pose('patience');
  t.mock.timers.tick(obsessionDuration.patience);
  view.timerCompleted();
  pose('spareHeart');
  t.mock.timers.tick(obsessionDuration.spareHeart);
  view.pointer({ target: 'mascot', x: 114, y: 84 });
  const noticedFrom = calls.length;
  view.timerCompleted();
  pose('spareHeart');
  assert(calls.slice(noticedFrom).some(call => call.name === '.obsession-small-heart'));
  assert(!calls.slice(noticedFrom).some(call => call.name === '.obsession-large-heart'), 'an already noticed gift never escalates to the larger heart');
  t.mock.timers.tick(obsessionDuration.spareHeart);
  view.pointer({ target: 'none', x: 0, y: 0 });
  view.clockChanged('11:11');
  pose('coincidence');
  t.mock.timers.tick(obsessionDuration.coincidence);
  view.pointer({ target: 'mascot', x: 114, y: 84 });
  view.pointer({ target: 'none', x: 190, y: 70 });
  t.mock.timers.tick(400);
  pose('search');
  const searchCalls = calls.filter(call => !call.cancelled);
  assert(searchCalls.some(call => call.name === '.obsession-binoculars'));
  view.pointer({ target: 'mascot', x: 114, y: 84 });
  assert.equal(view.ownsEyes, false, 'returning to the mascot immediately lowers the binoculars');
  assert(searchCalls.every(call => call.cancelled));
  view.pointer({ target: 'none', x: 190, y: 70 });
  t.mock.timers.tick(400);
  t.mock.timers.tick(obsessionDuration.search);
  // Select each sparse idle cue without exposing a test-only render API.
  view.setFocusRunning(true);
  const idle = ['smile', 'stare', 'distress', 'falseSleep', 'thread', 'compatibility', 'rehearsal', 'bouquet', 'mend', 'encourage', 'juggle', 'laptop', 'sharedActivity'] as const;
  for (let index = 0; index < idle.length; index++) {
    const gesture = idle[index]!;
    random = (index + .1) / idle.length;
    t.mock.timers.tick(40_000);
    pose(gesture);
    if (gesture === 'bouquet') assert(calls.some(call => !call.cancelled && call.name === '.eyes'
      && call.frames.some(frame => frame.transform === 'translateY(-29px)')), 'eyes peek above the oversized bouquet');
    if (gesture === 'mend') {
      assert(calls.some(call => !call.cancelled && call.name === '.obsession-heart-crack'
        && call.frames.at(-1)?.opacity === 0), 'the crack disappears after repair');
      assert(calls.some(call => !call.cancelled && call.name === '.obsession-plaster'
        && call.frames.at(-1)?.opacity === 1), 'the plaster remains until the heart is put away');
    }
    if (gesture === 'encourage') {
      assert.equal(parts.querySelector('.obsession-encourage-label').textContent, 'second:obsession.encourage');
      assert(calls.some(call => !call.cancelled && call.name === '.eyes'
        && call.frames.some(frame => frame.transform === 'translateY(-11px)')), 'the eyes peek above the lowered encouragement sign');
    }
    if (gesture === 'juggle') {
      assert(calls.some(call => !call.cancelled && call.name === '.obsession-juggle-top'
        && call.frames.at(-1)?.transform === 'translateY(-410px)'), 'the third heart lands on the head');
      for (const side of ['left', 'right']) assert(calls.some(call => !call.cancelled
        && call.name === `.obsession-juggle-${side}` && call.frames.at(-1)?.transform === 'translateY(80px)'), 'the other two hearts are caught');
    }
    if (gesture === 'laptop') assert(calls.some(call => !call.cancelled && call.name === '.obsession-activity-coding'), 'the running-focus scene opens the little computer');
    if (gesture === 'sharedActivity') assert(calls.some(call => !call.cancelled && call.name === '.obsession-activity-reading'), 'default shared activity is reading');
    random = 0;
    t.mock.timers.tick(obsessionDuration[gesture]);
  }
  view.setFocusRunning(false);
  for (const activity of ['writing', 'coding', 'reading'] as const) {
    view.setActivity(activity);
    pose('sharedActivity');
    const visible = calls.filter(call => !call.cancelled && call.name.startsWith('.obsession-activity-'));
    assert(visible.length > 0 && visible.every(call => call.name === `.obsession-activity-${activity}`), 'only the selected shared activity is rendered');
    if (activity === 'writing') assert(calls.some(call => !call.cancelled && call.name === '.obsession-pencil'), 'writing moves the pencil over the paper');
    t.mock.timers.tick(obsessionDuration.sharedActivity);
  }
  view.setFocusRunning(true);
  random = 11.1 / idle.length;
  t.mock.timers.tick(40_000);
  pose('laptop');
  const laptopCalls = calls.filter(call => !call.cancelled);
  view.pointer({ target: 'mascot', x: 114, y: 84 });
  assert.equal(view.ownsEyes, false, 'approaching promptly closes the secret laptop');
  assert(laptopCalls.every(call => call.cancelled));
  view.pointer({ target: 'none', x: 190, y: 70 });
  t.mock.timers.tick(400);
  t.mock.timers.tick(obsessionDuration.search);
  view.setFocusRunning(false);
  random = 3.1 / idle.length;
  t.mock.timers.tick(40_000);
  pose('falseSleep');
  view.pointer({ target: 'mascot', x: 114, y: 84 });
  pose('peek');
  t.mock.timers.tick(obsessionDuration.peek);
  view.pointer({ target: 'none', x: 0, y: 0 });
  state = { ...state, enabled: false };
  view.setState(state);
  pose('farewell');
  assert.equal(caption.textContent, 'second:obsession.no');
  t.mock.timers.tick(2400);
  assert.equal(view.ownsEyes, false);
  assert.equal(image.classes.has('obsession-source'), false);
  assert.equal(image.classes.has('obsession-heart-source'), false, 'OFF restores the original pupils');
  assert.equal(backs.hidden, true);
  state = { ...state, enabled: true };
  view.setState(state);
  view.doubleClick({ x: 114, y: 84 });
  pose('drawnHearts');
  state = { ...state, reducedMotion: true };
  view.setState(state);
  assert.equal(view.ownsEyes, false);
  assert.equal(backs.hidden, false);
  assert.equal(image.classes.has('obsession-heart-source'), true, 'reduced motion retains static heart eyes');
  assert.equal(bodyBacks.hidden, true);
  assert(calls.every(call => call.cancelled), 'completion and cancellation release every WAAPI animation');
  view.dispose();
  view.dispose();
  assert(created.every(node => node.removed), 'disposal removes all appended decorative nodes');
  assert.equal(ownership.at(-1), false);
});
