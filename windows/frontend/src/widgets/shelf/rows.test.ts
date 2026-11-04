import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

class Node {
  children: Node[] = [];
  parent: Node | undefined;
  style = { height: '', opacity: '', overflow: '' };
  inert = false;
  disabled = false;
  checked = false;
  textContent = '';
  className = '';
  listeners = new Map<string, () => void>();
  animations: { frames: Keyframe[]; options: KeyframeAnimationOptions; cancelled: boolean; finished: Promise<void>; finish: () => void; cancel: () => void }[] = [];
  tag: string;
  constructor(tag: string) { this.tag = tag; }
  setAttribute() {}
  append(...nodes: (Node | string)[]) { for (const node of nodes) { if (typeof node === 'string') continue; node.remove(); node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes: Node[]) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  insertBefore(node: Node, before: Node | null) { node.remove(); node.parent = this; const index = before ? this.children.indexOf(before) : -1; this.children.splice(index < 0 ? this.children.length : index, 0, node); }
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = undefined; } }
  addEventListener(name: string, fn: () => void) { this.listeners.set(name, fn); }
  querySelectorAll(tag: string): Node[] { return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
  getBoundingClientRect() { return { height: 48 }; }
  animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
    let finish!: () => void;
    const animation = { frames, options, cancelled: false, finished: new Promise<void>(resolve => { finish = resolve; }), finish: () => finish(), cancel() { this.cancelled = true; } };
    this.animations.push(animation);
    return animation;
  }
}

test('shelf retains controls during pending updates and reverses removed rows safely', async () => {
  let changed!: (event: { payload: { paths: string[]; clearOnStartup: boolean } }) => void;
  let reduced = false;
  let mediaChanged = () => {};
  let attributeChanged = () => {};
  let completeCommand!: () => void;
  const root = { hasAttribute: () => reduced };
  const globals: Record<string, unknown> = {
    document: { createElement: (tag: string) => new Node(tag), documentElement: root },
    matchMedia: () => ({ matches: false, addEventListener: (_: string, fn: () => void) => { mediaChanged = fn; }, removeEventListener() {} }),
    MutationObserver: class { constructor(fn: () => void) { attributeChanged = fn; } observe() {} disconnect() {} },
    getComputedStyle: () => ({ height: '48px', opacity: '0.6', overflow: 'visible' }),
    __shelfInvoke: (command: string) => command === 'pivo_shelf_get'
      ? Promise.resolve({ paths: ['C:/one.txt'], clearOnStartup: false })
      : new Promise<void>(resolve => { completeCommand = resolve; }),
    __shelfListen: async (_: string, fn: typeof changed) => { changed = fn; return () => {}; },
  };
  const prior = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  let dispose = () => {};
  try {
    let source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
    source = 'const invoke = globalThis.__shelfInvoke; const listen = globalThis.__shelfListen; const t = key => key; const publishNotice = () => {};\n' + source;
    const module = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
    const container = new Node('section');
    dispose = module.widgets[0].mount(container, () => {});
    await new Promise(resolve => setImmediate(resolve));
    const list = container.querySelectorAll('ul')[0]!;
    const row = list.children.find(item => item.querySelectorAll('button').length)!;
    const action = row.querySelectorAll('button')[0]!;
    const animationsBeforePending = row.animations.length;
    action.listeners.get('click')!();
    assert.ok(list.children.includes(row), 'pending update must retain the existing file row');
    assert.equal(action.disabled, false, 'pending must not blur a focused file control');
    assert.equal(row.animations.length, animationsBeforePending, 'pending does not restart entry');
    completeCommand();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(row.querySelectorAll('button')[0], action);
    changed({ payload: { paths: ['C:/one.txt', 'C:/two.txt', 'C:/three.txt'], clearOnStartup: false } });
    const siblings = list.children.filter(item => item.querySelectorAll('button').length);
    changed({ payload: { paths: ['C:/two.txt', 'C:/three.txt'], clearOnStartup: false } });
    assert.deepEqual(list.children.filter(item => siblings.includes(item)).map(item => siblings.indexOf(item)), [0, 1, 2],
      'surviving siblings must remain below the exiting first row while it collapses');
    changed({ payload: { paths: ['C:/one.txt'], clearOnStartup: false } });
    changed({ payload: { paths: [], clearOnStartup: false } });
    assert.ok(list.children.includes(row), 'removed row remains during its exit');
    assert.equal(row.inert, true);
    const exit = row.animations.at(-1)!;
    assert.equal(exit.options.duration, 300);
    assert.equal(exit.frames.at(-1)?.height, '0px');
    changed({ payload: { paths: ['C:/one.txt'], clearOnStartup: false } });
    assert.ok(list.children.includes(row), 're-added row reuses the leaving node');
    exit.finish();
    await Promise.resolve();
    assert.ok(list.children.includes(row), 'stale exit completion cannot remove a restored row');
    changed({ payload: { paths: [], clearOnStartup: false } });
    reduced = true;
    attributeChanged();
    mediaChanged();
    assert.ok(!list.children.includes(row), 'reduced motion settles the exit immediately');
    dispose();
    dispose = () => {};
    assert.equal(container.children.length, 0);
  } finally {
    dispose();
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
