import { currentLyricText, lyricSeekTarget, renderLyricRows, replaceLyricText, settleLyricText } from './lyric-rows.ts';
import assert from 'node:assert/strict';
import test from 'node:test';

test('track replacement preserves outgoing lyrics until their fade finishes and settles on reduced motion', async () => {
  class Line {
    textContent = ''; hidden = false; title = ''; inert = false;
    parentElement: Line | null = null; children: Line[] = []; style = {};
    scrollTop = 0; scrollLeft = 0; clientTop = 0; clientLeft = 0; offsetTop = 0; offsetHeight = 20; clientHeight = 80; offsetHeightValue = 80;
    classList = { toggle() {}, add() {} };
    animations: { cancelled: boolean; finished: Promise<void>; cancel(): void; finish(): void }[] = [];
    setAttribute() {}
    cloneNode() { const clone = new Line(); clone.textContent = this.textContent; return clone; }
    append(node: Line) { node.parentElement = this; this.children.push(node); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
    getBoundingClientRect() { return { top: 0, left: 0, width: 120, height: 20 }; }
    getAnimations() { return this.animations.filter(animation => !animation.cancelled); }
    animate() {
      let finish!: () => void;
      const animation = { cancelled: false, finished: new Promise<void>(resolve => { finish = resolve; }), cancel() { this.cancelled = true; }, finish: () => finish() };
      this.animations.push(animation); return animation;
    }
  }
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: () => ({ opacity: '.4', font: '13px Segoe UI', color: 'white', whiteSpace: 'normal', transform: 'none', fontSize: '13px' }) });
  try {
    const host = new Line();
    const rows = [new Line(), new Line(), new Line()];
    rows.forEach(row => host.append(row));
    const render = renderLyricRows(rows as unknown as HTMLElement[]);
    render('first', [undefined, { text: 'Old line', timeMs: 0 }, undefined], '', true, true);
    render('second', [undefined, { text: 'New line', timeMs: 0 }, undefined], '', true, true);
    const outgoing = host.children.find(line => !rows.includes(line) && line.textContent === 'Old line');
    assert.ok(outgoing, 'track replacement must retain the outgoing lyric during the fade');
    render('third', [undefined, { text: 'Latest line', timeMs: 0 }, undefined], '', true, true);
    outgoing.animations[0]!.finish(); await Promise.resolve();
    assert.equal(rows[1]!.textContent, 'Latest line');
    render('third', [undefined, { text: 'Latest line', timeMs: 0 }, undefined], '', true, false);
    assert.deepEqual(host.children, rows, 'reduced motion removes every outgoing snapshot');
    assert(rows.every(row => row.getAnimations().length === 0));
    render('fourth', [undefined, { text: 'Fourth line', timeMs: 0 }, undefined], '', true, true);
    render.dispose();
    assert.deepEqual(host.children, rows, 'disposal removes active snapshots');
    assert(rows.every(row => row.getAnimations().length === 0));
    const plain = new Line(); host.append(plain);
    plain.textContent = 'Scrolled old lyrics'; plain.scrollTop = 40;
    replaceLyricText(plain as unknown as HTMLElement, 'New plain lyrics', true);
    const plainSnapshot = host.children.find(line => line !== plain && line.textContent === 'Scrolled old lyrics');
    assert.equal(plainSnapshot?.scrollTop, 40, 'outgoing plain lyrics retain their visible scroll position');
    assert.equal(plain.textContent, 'New plain lyrics');
    settleLyricText(plain as unknown as HTMLElement);
    assert.equal(host.children.length, 4);
  } finally {
    if (prior) Object.defineProperty(globalThis, 'getComputedStyle', prior); else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  }
});

test('a retained lyric uses its sampled center, opacity and font size after moving rows', () => {
  const frames: Keyframe[][] = [];
  const rows = [0, 20, 40].map(top => ({
    textContent: '', hidden: false, title: '', parentElement: null,
    classList: { toggle() {} },
    getAnimations: () => [],
    getBoundingClientRect: () => ({ top, height: 12 }),
    animate(keyframes: Keyframe[]) { frames.push(keyframes); },
  }));
  Object.defineProperty(globalThis, 'getComputedStyle', {
    configurable: true,
    value: (row: typeof rows[number]) => ({
      color: 'white', opacity: '.4',
      transform: row === rows[1] && frames.length === 0 ? 'matrix(0.8, 0, 0, 0.8, 0, 0)' : 'none',
      fontSize: row === rows[1] ? '15px' : '12px',
    }),
  });
  Object.defineProperty(globalThis, 'DOMMatrixReadOnly', {
    configurable: true,
    value: class { readonly a = 0.8; },
  });
  try {
    const render = renderLyricRows(rows as unknown as HTMLElement[]);
    const first = { text: 'First', timeMs: 1000 };
    const second = { text: 'Second', timeMs: 2000 };
    render('track', [undefined, first, second], '', true, true);
    render('track', [first, second, undefined], '', true, true);
    assert.equal(frames[0]?.[0]?.transform, 'translateY(20px) scale(1)');
    assert.equal(frames[0]?.[0]?.opacity, '.4');
  } finally {
    Reflect.deleteProperty(globalThis, 'getComputedStyle');
    Reflect.deleteProperty(globalThis, 'DOMMatrixReadOnly');
  }
});

test('lyric snapshots convert scaled viewport geometry into the parent local coordinates', () => {
  const previousStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  const previousMatrix = Object.getOwnPropertyDescriptor(globalThis, 'DOMMatrixReadOnly');
  const snapshots: { style: Record<string, string> }[] = [];
  const parent = {
    clientLeft: 2, clientTop: 1, scrollLeft: 3, scrollTop: 7,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 300, height: 120 }),
    append(snapshot: { style: Record<string, string> }) { snapshots.push(snapshot); },
  };
  const line = {
    parentElement: parent, textContent: 'Old', hidden: false, scrollTop: 0,
    getBoundingClientRect: () => ({ left: 128.5, top: 86, width: 144, height: 24 }),
    getAnimations: () => [], animate: () => ({}),
    cloneNode: () => ({ style: {}, classList: { add() {} }, setAttribute() {}, remove() {},
      animate: () => ({ finished: new Promise(() => {}) }) }),
  };
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: (element: unknown) => element === parent
    ? { width: '200px' } : { font: '15px Segoe UI', fontSize: '15px', lineHeight: '20px', opacity: '.6', color: 'white', whiteSpace: 'normal', transform: 'matrix(.8,0,0,.8,0,0)' } });
  Object.defineProperty(globalThis, 'DOMMatrixReadOnly', { configurable: true, value: class { readonly a = .8; } });
  try {
    replaceLyricText(line as unknown as HTMLElement, 'New', true);
    assert.equal(snapshots[0]?.style.left, '20px', 'screen position must be divided by ancestor scale before scroll/border offsets');
    assert.equal(snapshots[0]?.style.top, '30px');
    assert.equal(snapshots[0]?.style.width, '96px');
    assert.equal(snapshots[0]?.style.height, '16px');
    assert.equal(snapshots[0]?.style.fontSize, '12px', 'retain the line own sampled scale only');
  } finally {
    for (const [key, descriptor] of [['getComputedStyle', previousStyle], ['DOMMatrixReadOnly', previousMatrix]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('cue slides and height samples exclude the ancestor panel scale', () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  const frames: Keyframe[][] = [], heights: Keyframe[][] = [];
  const viewport = { offsetHeight: 80, clientHeight: 80, scrollTop: 0,
    getBoundingClientRect: () => ({ width: 300, height: 120 }),
    animate: (keys: Keyframe[]) => { heights.push(keys); return { cancel() {} }; } };
  const rows = [50, 80, 110].map(top => ({ parentElement: viewport, textContent: '', hidden: false, title: '', offsetTop: 0, offsetHeight: 12,
    classList: { toggle() {} }, getAnimations: () => [], getBoundingClientRect: () => ({ top, height: 18 }),
    animate: (keys: Keyframe[]) => { frames.push(keys); } }));
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true, value: (element: unknown) => element === viewport
    ? { width: '200px' } : { color: 'white', opacity: '1', transform: 'none', fontSize: '12px' } });
  try {
    const render = renderLyricRows(rows as unknown as HTMLElement[]);
    const first = { text: 'First', timeMs: 0 }, second = { text: 'Second', timeMs: 1000 };
    render('track', [undefined, first, second], '', true, true);
    render('track', [first, second, undefined], '', true, true);
    assert.equal(frames[1]?.[0]?.transform, 'translateY(20px) scale(1)');
    assert.equal(heights.length, 0, 'unchanged local height must not animate from a scaled height');
  } finally {
    if (prior) Object.defineProperty(globalThis, 'getComputedStyle', prior); else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  }
});
import { nextLyricDelay, lyricAt, lyricCueWindow, lyricWindow, parseLyrics } from './lyrics.ts';

test('lyric seek accepts a steady click on one visible cue and rejects drags and overlap', () => {
  const viewport = { left: 0, right: 100, top: 10, bottom: 40 };
  const first = { bounds: { ...viewport, top: 5, bottom: 20 }, target: 0.2 };
  const second = { bounds: { ...viewport, top: 20, bottom: 35 }, target: 0.4 };
  const rows = [first, second];
  assert.equal(lyricSeekTarget([20, 13], [22, 14], viewport, rows), 0.2);
  assert.equal(lyricSeekTarget([20, 13], [26, 14], viewport, rows), undefined);
  assert.equal(lyricSeekTarget([20, 19], [20, 21], viewport, rows), undefined);
  assert.equal(lyricSeekTarget([20, 9], [20, 10], viewport, rows), undefined);
  assert.equal(lyricSeekTarget([20, 19], [20, 19], viewport, [
    first, { ...second, bounds: { ...second.bounds, top: 18 } },
  ]), undefined);
});

test('LRC uses all timestamps, fractional seconds and track offset', () => {
  const lines = parseLyrics('[ti:Ignored]\r\n[00:04.20]Later\r\n[00:01.2][00:03.005]Repeat\r\n[00:02.00]\r\n[offset:-100]');
  assert.deepEqual(lines.map(line => line.timeMs), [1100, 1900, 2905, 4100]);
  assert.equal(lyricAt(lines, 1099), '');
  assert.equal(lyricAt(lines, 1100), 'Repeat');
  assert.equal(lyricAt(lines, 1900), '');
  assert.equal(lyricAt(lines, 4101), 'Later');
});

test('LRC ignores metadata, plain text and invalid seconds', () => {
  assert.deepEqual(parseLyrics('[ar:Artist]\nNo timestamps\n[00:99]Invalid'), []);
});

test('lyric window advances through cues and preserves timed gaps', () => {
  const lines = parseLyrics('[00:01]First\n[00:02]\n[00:04]Second\n[00:06]Third');
  assert.deepEqual(lyricWindow(lines, 500), ['', '', 'First']);
  assert.deepEqual(lyricWindow(lines, 2000), ['First', '', 'Second']);
  assert.deepEqual(lyricWindow(lines, 4000), ['First', 'Second', 'Third']);
  assert.deepEqual(lyricWindow(lines, 6000), ['Second', 'Third', '']);
  assert.deepEqual(lyricWindow(lines, 1100), ['', 'First', 'Second']);
});

test('cue deadlines use the exact next timestamp and playback rate', () => {
  const lines = [{ timeMs: 250, text: 'First' }, { timeMs: 725, text: 'Next' }];
  assert.equal(nextLyricDelay(lines, 500, 1), 225);
  assert.equal(nextLyricDelay(lines, 500, 1.5), 150);
  assert.equal(nextLyricDelay(lines, 725, 1), undefined);
});
test('repeated lyrics advance by cue identity and timed gaps retain their timestamp', () => {
  const lines = parseLyrics('[00:01]Again\n[00:02]Again\n[00:03]\n[00:04]Next');
  assert.equal(currentLyricText(null), '');
  assert.equal(currentLyricText(lyricCueWindow(lines, 0)), '♪');
  assert.equal(lyricCueWindow(lines, 1000)[1], lines[0]);
  assert.equal(currentLyricText(lyricCueWindow(lines, 1000)), 'Again');
  assert.equal(lyricCueWindow(lines, 2000)[1], lines[1]);
  assert.equal(lyricCueWindow(lines, 3000)[1]?.text, '');
  assert.equal(currentLyricText(lyricCueWindow(lines, 3000)), '♪');
});

test('the upcoming lyric moves into the bright row only when its cue starts', context => {
  const lines = parseLyrics('[00:01]First\n[00:02]Next\n[00:03]');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
  Object.defineProperty(globalThis, 'getComputedStyle', { configurable: true,
    value: (element: { sung: boolean }) => ({
      color: element.sung ? 'white' : 'gray', opacity: '1', transform: 'none', fontSize: '12px',
    }),
  });
  context.after(() => {
    if (original) Object.defineProperty(globalThis, 'getComputedStyle', original);
    else Reflect.deleteProperty(globalThis, 'getComputedStyle');
  });
  const rows = [0, 20, 55].map(top => {
    const row = {
      hidden: false, sung: false, textContent: '', title: '', frames: [] as Keyframe[],
      getBoundingClientRect: () => ({ top, height: 12 }),
      getAnimations: () => [],
      animate(frames: Keyframe[]) { this.frames = frames; },
      classList: { toggle(_: string, active: boolean) { row.sung = active; } },
    };
    return row;
  });
  let heightFrames: Keyframe[] = [];
  const viewport = {
    scrollTop: 0,
    clientHeight: 60,
    get offsetHeight() { return rows[1]?.textContent === 'Next' ? 60 : 80; },
    getBoundingClientRect() { return { height: this.offsetHeight }; },
    animate(frames: Keyframe[]) {
      heightFrames = frames;
      return { cancel() { heightFrames = []; } };
    },
  };
  Object.assign(rows[1]!, { parentElement: viewport, offsetTop: 20, offsetHeight: 20 });
  const render = renderLyricRows(rows as unknown as HTMLElement[]);
  render('track', lyricCueWindow(lines, 1999), '', true, true);
  assert.equal(rows[2]?.sung, false);
  render('track', lyricCueWindow(lines, 2000), '', true, true);
  assert.equal(rows[1]?.textContent, 'Next');
  assert.equal(rows[1]?.sung, true);
  assert.equal(rows[1]?.frames[0]?.transform, 'translateY(35px) scale(1)');
  assert.equal(rows[1]?.frames.at(-1)?.color, 'white');
  assert.deepEqual(heightFrames, [{ height: '80px' }, { height: '60px' }]);
  assert.equal(rows[0]?.frames[0]?.transform, 'translateY(20px) scale(1)');
  for (const row of rows) row.frames = [];
  render('track', lyricCueWindow(lines, 3000), '', true, false);
  assert.equal(rows[1]?.textContent, '♪');
  assert.equal(rows[1]?.sung, true);
  assert(rows.every(row => row.frames.length === 0));
  assert.deepEqual(heightFrames, []);
});
