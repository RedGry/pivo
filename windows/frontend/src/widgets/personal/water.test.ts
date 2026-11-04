import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const hooks = registerHooks({
  load(url, context, next) {
    if (url.endsWith('/i18n/index.ts')) return { format: 'module', shortCircuit: true,
      source: 'export const locale=()=>"en"; export const t=(key)=>key;' };
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: '' };
    return next(url, context);
  },
});
const { widgets } = await import('./index.ts');
hooks.deregister();

class Element extends EventTarget {
  readonly tag: string;
  constructor(tag: string) { super(); this.tag = tag; }
  children: Element[] = [];
  className = '';
  classList = { add() {}, remove() {} };
  value = '';
  checked = false;
  disabled = false;
  textContent = '';
  type = '';
  valid = true;
  reportValidity() { return this.valid; }
  style = { setProperty() {} };
  append(...children: Element[]) { this.children.push(...children); }
  replaceChildren(...children: Element[]) { this.children = children; }
  setAttribute() {}
  querySelector<T>(selector: string): T | null { return this.all(selector)[0] as T ?? null; }
  all(tag: string): Element[] { return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.all(tag)]); }
}

test('water updates retain progress and controls, preserve a focused draft, and unsubscribe on disposal', () => {
  const keys = ['window', 'document', 'localStorage'] as const;
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const events = new EventTarget();
  const values = new Map<string, string>();
  const document = { activeElement: null as Element | null, createElement: (tag: string) => new Element(tag) };
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
  keys.forEach((key, i) => Object.defineProperty(globalThis, key, { configurable: true, value: [events, document, storage][i] }));
  try {
    const container = new Element('div');
    let refreshes = 0;
    const water = widgets.find(widget => widget.id === 'water')!;
    const dispose = water.mount(container as unknown as HTMLElement, () => refreshes++);
    const progress = container.all('progress')[0];
    const goal = container.all('input')[0]!;
    document.activeElement = goal;
    goal.value = '230';
    water.primary!();
    assert.equal(container.all('progress')[0], progress, 'progress must survive an intake update');
    assert.equal(container.all('input')[0], goal, 'goal control must retain identity');
    assert.equal(goal.value, '230', 'uncommitted focused draft must survive');
    assert.equal(refreshes, 1);
    const state = JSON.parse(values.get('pivo.personal.water')!);
    values.set('pivo.personal.water', JSON.stringify({ ...state, goal: 3200, from: '10:00' }));
    events.dispatchEvent(new Event('pivo.personal.water'));
    assert.equal(goal.value, '230', 'external updates must preserve a focused draft');
    document.activeElement = null;
    container.dispatchEvent(new Event('focusout'));
    assert.equal(goal.value, '3200');
    goal.value = 'invalid';
    goal.valid = false;
    goal.dispatchEvent(new Event('change'));
    assert.equal(goal.value, '3200', 'invalid input must restore the latest saved value');
    const from = container.all('input')[3]!;
    from.value = '';
    from.valid = false;
    from.dispatchEvent(new Event('change'));
    assert.equal(from.value, '10:00', 'invalid time must restore the latest saved value');
    dispose();
    water.primary!();
    assert.equal(refreshes, 2);
    assert.equal(container.children.length, 0);
  } finally {
    keys.forEach((key, i) => { const descriptor = previous[i]; if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); });
  }
});
