import assert from 'node:assert/strict';
import test from 'node:test';
import { mountTaskReorder, moveTask } from './task-reorder.ts';

function withMotionEnvironment(run: (setReduced: (kind: 'native' | 'media', value: boolean) => void) => void) {
  const listeners = new Set<() => void>();
  let nativeReduced = false;
  let systemReduced = false;
  const globals = {
    document: { documentElement: { hasAttribute: () => nativeReduced } },
    matchMedia: () => ({ get matches() { return systemReduced; }, addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) }),
    MutationObserver: class { constructor(listener: () => void) { listeners.add(listener); this.listener = listener; } listener: () => void; observe() {} disconnect() { listeners.delete(this.listener); } },
  };
  const prior = Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.entries(globals).forEach(([key, value]) => Object.defineProperty(globalThis, key, { configurable: true, value }));
  try {
    run((kind, value) => { if (kind === 'native') nativeReduced = value; else systemReduced = value; listeners.forEach(listener => listener()); });
    assert.equal(listeners.size, 0, 'disposal releases media and native preference listeners');
  }
  finally { prior.forEach(([key, descriptor]) => descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key)); }
}

test('keyboard reordering retains painted position and reverses from a sampled in-flight position', () => withMotionEnvironment(setReduced => {
  const listeners = new Map<string, (event: KeyboardEvent) => void>();
  let order = ['a', 'b'];
  const entries = ['a', 'b'].map(id => {
    const animations: { cancelled: boolean; options: KeyframeAnimationOptions; cancel(): void; finished: Promise<void> }[] = [];
    const row = { dataset: { taskId: id }, inert: false, offset: 0,
      classList: { remove() {} }, style: { removeProperty() {} }, querySelector: () => handle,
      getBoundingClientRect: () => ({ top: order.indexOf(id) * 64 + row.offset }),
      animate: (frames: Keyframe[], options: KeyframeAnimationOptions) => {
        row.offset = Number.parseFloat(String(frames[0]!.translate).split(' ')[1]!);
        const animation = { cancelled: false, options, cancel() { this.cancelled = true; row.offset = 0; }, finished: new Promise<void>(() => {}) };
        animations.push(animation); return animation;
      },
    };
    const handle = { closest: (selector: string) => selector === '.task-drag-handle' ? handle : row, focus() {} };
    return { row, handle, animations };
  });
  const list = { querySelectorAll: () => order.map(id => entries.find(entry => entry.row.dataset.taskId === id)!.row),
    addEventListener: (key: string, listener: (event: KeyboardEvent) => void) => listeners.set(key, listener), removeEventListener: (key: string) => listeners.delete(key) };
  const dispose = mountTaskReorder(list as unknown as HTMLUListElement, (id, target) => { order = moveTask(order.map(id => ({ id })), id, target).map(item => item.id); });
  const first = entries[0]!;
  const press = (key: string) => listeners.get('keydown')!({ key, target: first.handle, preventDefault() {} } as unknown as KeyboardEvent);
  try {
    const before = first.row.getBoundingClientRect().top;
    press('ArrowDown');
    assert.equal(first.row.getBoundingClientRect().top, before, 'reordering must not jump before the first frame');
    assert.equal(first.animations[0]!.options.duration, 300);
    first.row.offset = -32;
    const reversedAt = first.row.getBoundingClientRect().top;
    press('ArrowUp');
    assert.equal(first.row.getBoundingClientRect().top, reversedAt, 'reversal begins at the current painted position');
    assert.equal(first.animations[0]!.cancelled, true);
    setReduced('native', true);
    assert.equal(first.animations.at(-1)!.cancelled, true, 'native reduced motion stops the current reorder');
    const count = first.animations.length;
    press('ArrowDown');
    assert.equal(first.animations.length, count, 'native reduced motion does not start another animation');
    setReduced('native', false);
    press('ArrowUp');
    setReduced('media', true);
    assert.equal(first.animations.at(-1)!.cancelled, true, 'media reduced motion stops the current reorder');
    setReduced('media', false);
    press('ArrowDown');
  } finally { dispose(); }
  assert.equal(first.animations.at(-1)!.cancelled, true);
}));

test('reordering ignores a removed task that is still painting its exit', () => withMotionEnvironment(() => {
  const listeners = new Map<string, (event: KeyboardEvent) => void>();
  const rows = ['a', 'b', 'c'].map(id => {
    const row = { dataset: { taskId: id }, inert: id === 'a',
      classList: { remove() {} }, style: { removeProperty() {} }, querySelector: () => handle, getBoundingClientRect: () => ({ top: 0 }) };
    const handle = { closest: (selector: string) => selector === '.task-drag-handle' ? handle : row, focus() {} };
    return { row, handle };
  });
  const list = {
    querySelectorAll: () => rows.map(entry => entry.row),
    addEventListener: (kind: string, listener: (event: KeyboardEvent) => void) => listeners.set(kind, listener),
    removeEventListener: (kind: string) => listeners.delete(kind),
  };
  // The model already excludes A while its inert row remains for the 300 ms exit.
  let items = [{ id: 'b' }, { id: 'c' }];
  const dispose = mountTaskReorder(list as unknown as HTMLUListElement, (id, target) => { items = moveTask(items, id, target); });
  try {
    listeners.get('keydown')!({ key: 'ArrowDown', target: rows[1]!.handle, preventDefault() {} } as unknown as KeyboardEvent);
    assert.deepEqual(items.map(item => item.id), ['c', 'b']);
  } finally { dispose(); }
  assert.equal(listeners.size, 0);
}));
