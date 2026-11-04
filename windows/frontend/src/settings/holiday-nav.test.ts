import assert from 'node:assert/strict';
import test from 'node:test';
import { holidayNavPath, holidayNavSections, renderHolidayNavigation } from './holiday-nav.ts';
import { holidayThemes } from '../presentation/holidays.ts';
import { mountHolidayScene } from './holiday-scene.ts';
import { applyHolidayAppearance } from '../presentation/holiday-appearance.ts';

test('garland resize ignores height-only and fractional observer changes at the same client width', context => {
  let resized: ResizeObserverCallback | undefined, writes = 0, markup = '';
  const host = { dataset: { holidayArt: 'garland' } as Record<string, string>, hidden: true, clientWidth: 500,
    get innerHTML() { return markup; }, set innerHTML(value: string) { writes++; markup = value; } };
  const original = ['document', 'ResizeObserver'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: { documentElement: { dataset: {}, hasAttribute: () => false }, querySelectorAll: () => [host] } },
    ResizeObserver: { configurable: true, value: class { constructor(callback: ResizeObserverCallback) { resized = callback; } disconnect() {} observe() {} } },
  });
  context.after(() => { applyHolidayAppearance('off', 'off'); for (const [key, prior] of original) { if (prior) Object.defineProperty(globalThis, key, prior); else Reflect.deleteProperty(globalThis, key); } });
  const resize = (width: number, height: number) => resized?.([{ target: host, contentRect: { width, height } } as unknown as ResizeObserverEntry], {} as ResizeObserver);
  applyHolidayAppearance('off', 'winter');
  assert.equal(writes, 1);
  const first = markup;
  resize(500.25, 12);
  resize(500.25, 22);
  assert.equal(writes, 1, 'Animating rail height must not recreate its SVG');
  host.clientWidth = 521;
  resize(520.75, 22);
  assert.equal(writes, 2);
  assert.notEqual(markup, first);
  resize(521.25, 22);
  assert.equal(writes, 2, 'Observer fractions must use the same client-width normalization');
});

test('holiday scenes retain painted layers through reversal and settle on reduced motion, resize and disposal', context => {
  const active = new Set<FakeAnimation>();
  type FakeAnimation = { frames: Keyframe[]; onfinish: (() => void) | null; cancel(): void };
  class Node {
    dataset: Record<string, string> = {};
    children: Node[] = [];
    hidden = false;
    opacity = '1';
    parent?: Node;
    svg = false;
    lastAnimation?: FakeAnimation;
    classes = new Set<string>();
    classList = {
      toggle: (name: string, enabled: boolean) => { if (enabled) this.classes.add(name); else this.classes.delete(name); },
      remove: (name: string) => this.classes.delete(name),
    };
    get firstElementChild() { return this.children[0]; }
    set innerHTML(_markup: string) { const child = new Node(); child.svg = true; this.append(child); }
    append(child: Node) { child.parent = this; this.children.push(child); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    querySelectorAll(selector: string) { return selector === 'svg' ? this.children.filter(child => child.svg) : this.children; }
    getBoundingClientRect() { return { left: 0, top: 0, height: this.hidden ? 0 : 147 }; }
    animate(frames: Keyframe[]) {
      const animation: FakeAnimation = { frames, onfinish: null, cancel() { active.delete(animation); } };
      this.opacity = String(frames[0]?.opacity ?? this.opacity);
      this.lastAnimation = animation;
      active.add(animation);
      return animation;
    }
  }
  const host = new Node(); host.hidden = true;
  const left = new Node(), right = new Node(); left.dataset.holidayScene = 'left'; right.dataset.holidayScene = 'right'; host.append(left); host.append(right);
  let resize: (() => void) | undefined, reduced = false;
  const originals = ['document', 'window', 'getComputedStyle'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: { createElement: () => new Node() } },
    window: { configurable: true, value: { addEventListener: (_name: string, listener: () => void) => { resize = listener; }, removeEventListener: () => { resize = undefined; } } },
    getComputedStyle: { configurable: true, value: (node: Node) => ({ opacity: node.opacity, position: node === host ? 'static' : 'relative' }) },
  });
  context.after(() => { for (const [key, prior] of originals) { if (prior) Object.defineProperty(globalThis, key, prior); else Reflect.deleteProperty(globalThis, key); } });
  const scene = mountHolidayScene(host as unknown as HTMLElement, () => reduced);
  try {
    scene.render('winter');
    const winter = left.children[0]!; winter.opacity = '.45';
    scene.render('love');
    assert.equal(left.children.length, 2);
    assert.equal(winter.lastAnimation?.frames[0]?.opacity, '.45');
    const staleExit = winter.lastAnimation?.onfinish;
    scene.render('winter');
    staleExit?.();
    assert(left.children.includes(winter), 'A cancelled exit must not remove a returning layer');
    reduced = true; scene.render('winter');
    assert.equal(active.size, 0);
    assert.deepEqual(left.children, [winter]);
    reduced = false; scene.render('love'); resize?.();
    assert.equal(active.size, 0);
    assert.equal(left.children[0]?.dataset.sceneTheme, 'love');
    scene.render(undefined);
    assert.equal(host.hidden, false);
    assert.equal(host.lastAnimation?.frames.at(-1)?.flexBasis, '0px');
    host.lastAnimation?.onfinish?.();
    assert.equal(host.hidden, true);
    assert.equal(left.children.length, 0);
    scene.render('spring'); scene.dispose();
    assert.equal(active.size, 0);
    assert.equal(resize, undefined);
    scene.render('winter');
    assert.equal(left.children[0]?.dataset.sceneTheme, 'spring');
  } finally { scene.dispose(); }
});

test('each theme provides a different drawing for every sidebar icon', () => {
  const all = new Set<string>();
  for (const section of holidayNavSections) {
    const paths = holidayThemes.map(theme => holidayNavPath(theme, section));
    assert.ok(paths.every(path => path?.startsWith('M')), section);
    assert.equal(new Set(paths).size, holidayThemes.length, section);
    for (const path of paths) all.add(path!);
  }
  assert.equal(all.size, holidayNavSections.length * holidayThemes.length);
});

test('switching themes replaces the primary SVG and restores it when disabled', () => {
  const original = { geometry: 'base' };
  const svg = {
    namespaceURI: 'http://www.w3.org/2000/svg',
    childNodes: [original],
    replaceChildren(...next: typeof original[]) { this.childNodes = next; },
  };
  const tab = { dataset: { section: 'music' }, querySelector: () => svg };
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    querySelectorAll: () => [tab],
    createElementNS: () => ({ geometry: '', setAttribute(_: string, value: string) { this.geometry = value; } }),
  } });
  try {
    renderHolidayNavigation('spooky');
    assert.equal(svg.childNodes[0]?.geometry, holidayNavPath('spooky', 'music'));
    renderHolidayNavigation('winter');
    assert.equal(svg.childNodes[0]?.geometry, holidayNavPath('winter', 'music'));
    renderHolidayNavigation(undefined);
    assert.deepEqual(svg.childNodes, [original]);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'document', saved);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
