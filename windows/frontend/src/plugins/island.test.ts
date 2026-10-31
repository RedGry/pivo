import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { type TestContext } from 'node:test';
import { initialState, type PluginState } from './model.ts';

interface Fixture {
  state: PluginState;
  action?: (event: { payload: string }) => void;
  render?: () => void;
  failSave: boolean;
}
const fixture: Fixture = { state: initialState(), failSave: false };
Object.assign(globalThis, { __pluginIslandFixture: fixture });
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@tauri-apps/api/core' || specifier === '@tauri-apps/api/event') {
      return { url: `test:${specifier}`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    let source: string | undefined;
    if (url.endsWith('.css')) source = '';
    else if (url === 'test:@tauri-apps/api/core') source = 'export const invoke = async () => {};';
    else if (url === 'test:@tauri-apps/api/event') source = 'export const listen = async (_, callback) => { globalThis.__pluginIslandFixture.action = callback; return () => {}; };';
    else if (url.endsWith('/i18n/index.ts')) source = "export const locale = () => 'en'; export const t = key => key;";
    else if (url.endsWith('/plugins/store.ts')) source = `
      const fixture = globalThis.__pluginIslandFixture;
      export const loadPlugins = () => structuredClone(fixture.state);
      export const savePlugins = state => { if (fixture.failSave) throw Error('save failed'); fixture.state = state; fixture.render?.(); };
      export const subscribePlugins = render => { fixture.render = render; return () => {}; };
    `;
    if (source !== undefined) return { format: 'module', source, shortCircuit: true };
    return nextLoad(url, context);
  },
});
const { mountPluginIsland } = await import('./island.ts');

class Surface {
  readonly tagName: string;
  className = '';
  textContent = '';
  hidden = false;
  title = '';
  dataset: Record<string, string> = {};
  children: Surface[] = [];
  attributes = new Map<string, string>();
  classList = { add() {}, toggle() {} };
  constructor(tagName: string) { this.tagName = tagName; }
  append(...children: Surface[]) { this.children.push(...children); }
  replaceChildren(...children: Surface[]) { this.children = children; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
}

function setup(t: TestContext) {
  const originalDocument = globalThis.document;
  globalThis.document = {
    hidden: false,
    createElement: (tag: string) => new Surface(tag),
    createElementNS: (_namespace: string, tag: string) => new Surface(tag),
  } as unknown as Document;
  t.after(() => { globalThis.document = originalDocument; });
  fixture.state = initialState();
  fixture.failSave = false;
  fixture.action = undefined;
  fixture.render = undefined;
  const container = new Surface('div');
  return container as unknown as HTMLElement;
}

test('navigation arrows have symmetric vector bounds independent of font baseline', t => {
  const container = setup(t);
  const island = mountPluginIsland(container);
  t.after(() => island.dispose());
  const controls = (container as unknown as Surface).children[3]!;
  for (const index of [0, 3]) {
    const arrow = controls.children[index]!.children[0];
    assert(arrow, 'navigation must render a vector arrow instead of a baseline-dependent glyph');
    assert.equal(arrow.tagName, 'svg');
    assert.equal(arrow.attributes.get('viewBox'), '0 0 12 12');
    const coordinates = arrow.children[0]!.attributes.get('points')!.split(/[ ,]+/).map(Number);
    const x = coordinates.filter((_, i) => i % 2 === 0);
    const y = coordinates.filter((_, i) => i % 2 === 1);
    assert.equal((Math.min(...x) + Math.max(...x)) / 2, 6);
    assert.equal((Math.min(...y) + Math.max(...y)) / 2, 6);
  }
});

test('focus starts and observed countdown completion emit once after successful changes', async t => {
  const container = setup(t);
  let now = 10_000;
  t.mock.method(Date, 'now', () => now);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let starts = 0;
  let completed = 0;
  let pauses = 0;
  const island = mountPluginIsland(container, undefined, undefined, () => starts++, () => completed++, () => pauses++);
  t.after(() => island.dispose());
  island.setVisible(true);
  await Promise.resolve();
  const action = (payload: string) => fixture.action!({ payload });
  action('primary');
  assert.equal(starts, 1, 'starting focus emits after persistence');
  action('primary');
  assert.equal(starts, 1, 'pausing does not start focus');
  assert.equal(pauses, 1, 'pausing a running focus emits once');
  action('primary');
  assert.equal(starts, 2, 'resuming focus starts a session');
  now += 1_500_000;
  fixture.render!();
  assert.equal(completed, 1);
  fixture.render!();
  island.refreshLocale();
  island.setVisible(false);
  island.setVisible(true);
  assert.equal(completed, 1, 'rerenders do not repeat completion');
  action('secondary');
  action('primary');
  assert.equal(starts, 2, 'break starts do not start focus');
  action('primary');
  assert.equal(pauses, 2, 'pausing a running break emits once');
  action('secondary');
  fixture.failSave = true;
  const errors = t.mock.method(console, 'error', () => {});
  action('primary');
  assert.equal(starts, 2, 'failed persistence does not emit focus start');
  assert.equal(errors.mock.callCount(), 1);
});

test('a restored already finished timer does not produce a fresh completion', t => {
  const container = setup(t);
  fixture.state.entries[0]!.timer = { mode: 'focus', remaining: 1500, deadline: 1 };
  let completed = 0;
  const island = mountPluginIsland(container, undefined, undefined, undefined, () => completed++);
  t.after(() => island.dispose());
  island.setVisible(true);
  assert.equal(completed, 0);
});

test('break starts and resumes emit only after successful primary actions', async t => {
  const container = setup(t);
  t.mock.method(Date, 'now', () => 10_000);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let breaks = 0;
  let focuses = 0;
  const island = mountPluginIsland(container, undefined, undefined, () => focuses++, undefined, undefined, () => breaks++);
  t.after(() => island.dispose());
  island.setVisible(true);
  await Promise.resolve();
  const action = (payload: string) => fixture.action!({ payload });
  action('primary');
  assert.equal(focuses, 1);
  assert.equal(breaks, 0, 'focus starts never announce a break');
  action('secondary');
  assert.equal(breaks, 0, 'switching to break mode does not start the break');
  action('primary');
  assert.equal(breaks, 1, 'starting the break emits once');
  assert.equal(focuses, 1, 'starting a break never announces focus');
  action('primary');
  assert.equal(breaks, 1, 'pausing the break does not announce a start');
  action('primary');
  assert.equal(breaks, 2, 'resuming the break emits once');
  action('primary');
  fixture.failSave = true;
  const errors = t.mock.method(console, 'error', () => {});
  action('primary');
  assert.equal(breaks, 2, 'failed persistence does not announce a break');
  assert.equal(errors.mock.callCount(), 1);
});

test('selected focus reporting follows running timers, pause, completion and page changes', async t => {
  const container = setup(t);
  let now = 10_000;
  t.mock.method(Date, 'now', () => now);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const reports: boolean[] = [];
  const island = mountPluginIsland(container, undefined, undefined, undefined, undefined, undefined, undefined, running => reports.push(running));
  t.after(() => island.dispose());
  assert.deepEqual(reports, [], 'construction cannot call the not-yet-composed mascot');
  island.setVisible(true);
  assert.deepEqual(reports, [false]);
  await Promise.resolve();
  const action = (payload: string) => fixture.action!({ payload });
  action('primary');
  action('primary');
  action('primary');
  assert.deepEqual(reports, [false, true, false, true]);
  now += 1_500_000;
  fixture.render!();
  assert.deepEqual(reports, [false, true, false, true, false]);
  action('secondary');
  action('primary');
  assert.equal(reports.at(-1), false, 'running breaks do not enable laptop');
  const count = reports.length;
  island.refreshLocale();
  assert.equal(reports.length, count, 'unchanged renders do not repeat reports');
  action('secondary');
  action('primary');
  assert.equal(reports.at(-1), true);
  fixture.state.entries[0]!.enabled = false;
  fixture.render!();
  assert.equal(reports.at(-1), false, 'disabled focus pages stop laptop');
});

test('restored running focus is reported on first visibility update and failed saves do not change it', async t => {
  const container = setup(t);
  t.mock.method(Date, 'now', () => 10_000);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  fixture.state.entries[0]!.timer = { mode: 'focus', remaining: 1500, deadline: 20_000 };
  const reports: boolean[] = [];
  const island = mountPluginIsland(container, undefined, undefined, undefined, undefined, undefined, undefined, running => reports.push(running));
  t.after(() => island.dispose());
  assert.deepEqual(reports, []);
  island.setVisible(false);
  assert.deepEqual(reports, [true]);
  await Promise.resolve();
  island.setVisible(true);
  fixture.failSave = true;
  t.mock.method(console, 'error', () => {});
  fixture.action!({ payload: 'primary' });
  assert.deepEqual(reports, [true]);
});
