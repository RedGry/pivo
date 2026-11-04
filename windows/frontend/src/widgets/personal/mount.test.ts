import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const hooks = registerHooks({ load(url, context, next) {
  if (url.endsWith('/i18n/index.ts')) return { format: 'module', shortCircuit: true, source: 'export const locale=()=>"en";export const t=key=>key;' };
  if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: '' };
  return next(url, context);
} });
const { widgets, toggleTaskDone } = await import('./index.ts');
hooks.deregister();

class Element extends EventTarget {
  tag: string;
  constructor(tag: string) { super(); this.tag = tag; }
  children: Element[] = [];
  parent: Element | undefined;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  className = ''; textContent = ''; value = ''; checked = false; hidden = false; type = ''; inert = false;
  private markup = '';
  get innerHTML(): string { return this.markup + this.textContent + this.children.map(child => child.tag + child.className + JSON.stringify(child.dataset) + child.innerHTML).join(''); }
  set innerHTML(value: string) { this.markup = value; this.replaceChildren(); }
  style = { setProperty() {}, removeProperty() {} };
  classList = {
    add: (...names: string[]) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' ').trim(); },
    remove: (...names: string[]) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
    toggle: (name: string, enabled = !this.className.split(' ').includes(name)) => { if (enabled) this.classList.add(name); else this.classList.remove(name); },
  };
  append(...items: (Element | string)[]) { for (const item of items) if (typeof item !== 'string') { item.remove(); item.parent = this; this.children.push(item); } }
  replaceChildren(...items: Element[]) { this.children.forEach(item => { item.parent = undefined; }); this.children = []; this.append(...items); }
  insertBefore(item: Element, before: Element | null) { item.remove(); const i = before ? this.children.indexOf(before) : -1; this.children.splice(i < 0 ? this.children.length : i, 0, item); item.parent = this; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = undefined; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  hasAttribute(key: string) { return this.attributes.has(key); }
  get options() { return this.children.filter(child => child.tag === 'option'); }
  contains(node: Element | null): boolean { return node === this || this.children.some(child => child.contains(node)); }
  querySelectorAll<T = Element>(selector: string): T[] {
    const direct = selector.startsWith(':scope > ');
    const query = selector.replace(':scope > ', '');
    const matches = (node: Element) => query.startsWith('.') ? node.className.split(' ').includes(query.slice(1))
      : query.includes('[data-task-id]') ? node.tag === 'li' && Boolean(node.dataset.taskId) : node.tag === query;
    return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...(direct ? [] : child.querySelectorAll<Element>(query))]) as T[];
  }
  querySelector<T = Element>(query: string): T | null { return this.querySelectorAll<T>(query)[0] ?? null; }
  add(option: Element) { this.append(option); }
  getBoundingClientRect(): { height: number; top: number } {
    const height = this.className.includes('personal-calendar-grid') ? Math.ceil(this.children.length / 7) * 40
      : this.className === 'calendar-grid-stage' ? this.children.find(child => !child.className.includes('calendar-grid-outgoing'))?.getBoundingClientRect().height ?? 0
      : 40;
    return { height, top: 0 };
  }
  animations: { frames: Keyframe[]; options: KeyframeAnimationOptions; cancelled: boolean; finished: Promise<void>; finish: () => void; cancel: () => void }[] = [];
  animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
    let finish!: () => void;
    const animation = { frames, options, cancelled: false, finished: new Promise<void>(resolve => { finish = resolve; }),
      finish: () => finish(), cancel() { this.cancelled = true; } };
    this.animations.push(animation); return animation;
  }
  focus() { environment.document.activeElement = this; }
  reset() { this.querySelectorAll<Element>('input').forEach(input => { input.value = ''; }); }
}
let reduced = true;
const preferenceListeners = new Set<() => void>();
const observers = new Set<() => void>();
const environment = {
  document: { activeElement: null as Element | null, documentElement: new Element('html'), createElement: (tag: string) => new Element(tag) },
  window: new EventTarget(),
  localStorage: { getItem: (_: string): string | null => null, setItem: (_: string, __: string) => {} },
  matchMedia: () => ({ get matches() { return reduced; }, addEventListener(_: string, changed: () => void) { preferenceListeners.add(changed); }, removeEventListener(_: string, changed: () => void) { preferenceListeners.delete(changed); } }),
  MutationObserver: class { changed: () => void; constructor(changed: () => void) { this.changed = changed; } observe() { observers.add(this.changed); } disconnect() { observers.delete(this.changed); } },
  getComputedStyle: () => ({ height: '40px', opacity: '1', paddingBlock: '9px', borderTopWidth: '1px', marginBottom: '0px' }),
  Option: class extends Element { constructor(label: string, value: string) { super('option'); this.value = value; this.textContent = label; } },
};

function setup(run: (container: Element, values: Map<string, string>) => void) {
  reduced = true; environment.document.documentElement.attributes.clear();
  const values = new Map<string, string>();
  environment.localStorage.getItem = key => values.get(key) ?? null;
  environment.localStorage.setItem = (key, value) => { values.set(key, value); };
  const prior = Object.keys(environment).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.entries(environment).forEach(([key, value]) => Object.defineProperty(globalThis, key, { configurable: true, value }));
  try { run(new Element('div'), values); }
  finally { prior.forEach(([key, value]) => value ? Object.defineProperty(globalThis, key, value) : Reflect.deleteProperty(globalThis, key)); }
}

test('tasks retain row controls and settings while a task changes', () => setup((container, values) => {
  values.set('pivo.personal.tasks', JSON.stringify({ items: [{ id: 'a', title: 'Alpha', due: null, done: false }], snooze: 10, reminders: false }));
  const dispose = widgets.find(widget => widget.id === 'tasks')!.mount(container as unknown as HTMLElement, () => {});
  try {
    const row = container.querySelector('.task-list')!.children[0]!;
    const done = row.querySelector('input');
    const setting = container.querySelector('.widget-rows')!.querySelector('input');
    toggleTaskDone('a');
    assert.equal(container.querySelector('.task-list')!.children[0], row);
    assert.equal(row.querySelector('input'), done);
    assert.equal(container.querySelector('.widget-rows')!.querySelector('input'), setting);
    assert.equal(done!.checked, true);
    reduced = false;
    const saved = values.get('pivo.personal.tasks')!;
    values.set('pivo.personal.tasks', JSON.stringify({ items: [], snooze: 10, reminders: false }));
    environment.window.dispatchEvent(new Event('pivo.personal.tasks'));
    assert.equal(row.inert, true);
    const exit = row.animations.at(-1)!;
    assert.equal(exit.options.duration, 300);
    values.set('pivo.personal.tasks', saved);
    environment.window.dispatchEvent(new Event('pivo.personal.tasks'));
    assert.equal(exit.cancelled, true);
    assert.equal(container.querySelector('.task-list')!.children[0], row);
    assert.equal(row.inert, false);
    values.set('pivo.personal.tasks', JSON.stringify({ items: [], snooze: 10, reminders: false }));
    environment.window.dispatchEvent(new Event('pivo.personal.tasks'));
    reduced = true;
    preferenceListeners.forEach(changed => changed());
    assert.equal(container.querySelector('.task-list')!.children.length, 0);
  } finally { dispose(); }
}));

test('task edit actions retain their slots and drafts while cancel becomes inactive', () => setup((container, values) => {
  values.set('pivo.personal.tasks', JSON.stringify({ items: [{ id: 'edit', title: 'Saved task', due: null, done: false }], snooze: 10, reminders: false }));
  const dispose = widgets.find(widget => widget.id === 'tasks')!.mount(container as unknown as HTMLElement, () => {});
  try {
    const form = container.querySelector('.task-editor')!;
    const actions = form.querySelector('.personal-form-actions')!;
    const submit = actions.children[0]!, cancel = actions.children[1]!;
    const title = form.querySelector('input')!;
    assert.equal(cancel.hidden, true);
    assert.equal(cancel.inert, true);
    container.querySelector('.task-actions')!.children[0]!.dispatchEvent(new Event('click'));
    assert.equal(form.querySelector('.personal-form-actions'), actions);
    assert.equal(actions.children[0], submit);
    assert.equal(cancel.hidden, false);
    assert.equal(cancel.inert, false);
    assert.equal(title.value, 'Saved task');
    title.value = 'Editing draft';
    environment.window.dispatchEvent(new Event('pivo.personal.tasks'));
    assert.equal(title.value, 'Editing draft');
    assert.equal(environment.document.activeElement, title);
    cancel.focus();
    cancel.dispatchEvent(new Event('click'));
    assert.equal(environment.document.activeElement, title, 'cancel returns focus to the live task title');
    assert.equal(actions.children[0], submit);
    assert.equal(cancel.hidden, true);
    assert.equal(cancel.inert, true);
    assert.equal(title.value, '');
    container.querySelector('.task-actions')!.children[0]!.dispatchEvent(new Event('click'));
    assert.equal(cancel.inert, false);
    assert.equal(title.value, 'Saved task');
    const due = form.querySelectorAll<Element>('input')[1]!;
    due.focus();
    cancel.dispatchEvent(new Event('click'));
    assert.equal(environment.document.activeElement, due, 'reset does not steal focus from another live control');
  } finally { dispose(); assert.equal(observers.size, 0); assert.equal(preferenceListeners.size, 0); }
}));

test('calendar preserves the icon control while direct and external country changes disable it', () => setup((container, values) => {
  values.set('pivo.personal.calendar-countries', JSON.stringify({ filter: 'all', custom: [{ id: 'fixture', name: 'Fixture country' }] }));
  const dispose = widgets.find(widget => widget.id === 'calendar')!.mount(container as unknown as HTMLElement, () => {});
  try {
    const form = container.querySelector('.calendar-event-form')!;
    const title = form.querySelector('input')!;
    const country = form.querySelector('select')!;
    const iconField = form.querySelector('.calendar-icon-field')!;
    const icon = iconField.querySelector('select')!;
    const create = form.querySelector('button')!;
    title.value = 'Retained draft';
    assert.equal(iconField.hidden, true);
    assert.equal(iconField.inert, true);
    country.value = 'fixture'; country.focus(); country.dispatchEvent(new Event('change'));
    assert.equal(iconField.hidden, false); assert.equal(iconField.inert, false);
    icon.value = 'heart';
    icon.focus(); country.value = ''; country.dispatchEvent(new Event('change'));
    assert.equal(environment.document.activeElement, country, 'direct removal also restores logical focus');
    assert.equal(iconField.hidden, true); assert.equal(iconField.inert, true);
    country.value = 'fixture'; country.dispatchEvent(new Event('change'));
    title.focus();
    environment.window.dispatchEvent(new Event('pivo.personal.calendar-countries'));
    assert.equal(environment.document.activeElement, title, 'country refresh does not steal focus from another live control');
    icon.focus();
    values.set('pivo.personal.calendar-countries', JSON.stringify({ filter: 'all', custom: [] }));
    environment.window.dispatchEvent(new Event('pivo.personal.calendar-countries'));
    assert.equal(form.querySelector('.calendar-icon-field'), iconField);
    assert.equal(iconField.querySelector('select'), icon);
    assert.equal(form.querySelector('button'), create);
    assert.equal(title.value, 'Retained draft');
    assert.equal(environment.document.activeElement, country, 'country removal returns focus from the inactive icon field');
    assert.equal(iconField.hidden, true); assert.equal(iconField.inert, true);
    assert.equal(icon.value, 'heart');
  } finally { dispose(); assert.equal(observers.size, 0); assert.equal(preferenceListeners.size, 0); }
}));

test('calendar retains navigation, forms and drafts during paging and external events', () => setup((container, values) => {
  reduced = false;
  const dispose = widgets.find(widget => widget.id === 'calendar')!.mount(container as unknown as HTMLElement, () => {});
  try {
    const controls = container.querySelector('.personal-calendar-controls')!;
    const next = controls.children[2]!;
    const form = container.querySelector('.calendar-event-form')!;
    const title = form.querySelector('input')!;
    title.value = 'Draft';
    const stage = container.querySelector('.calendar-grid-stage')!;
    const grid = stage.children[0]!;
    next.dispatchEvent(new Event('click'));
    assert.equal(container.querySelector('.personal-calendar-controls'), controls);
    assert.equal(container.querySelector('.calendar-event-form'), form);
    assert.equal(title.value, 'Draft');
    assert.equal(stage.children.includes(grid), true, 'outgoing month remains for its fade');
    assert.equal(grid.inert, true);
    assert.equal(stage.animations.at(-1)!.options.duration, 300);
    next.dispatchEvent(new Event('click'));
    assert.ok(stage.children.length > 2, 'a second navigation must not delete an in-flight outgoing month');
    values.set('pivo.personal.calendar', JSON.stringify({ start: 'monday', view: 'week' }));
    environment.window.dispatchEvent(new Event('pivo.personal.calendar'));
    const resize = stage.animations.at(-1)!;
    assert.ok(Number.parseFloat(String(resize.frames[0]!.height)) > Number.parseFloat(String(resize.frames[1]!.height)), 'month to week animates height down');
    environment.document.documentElement.setAttribute('data-reduced-motion', '');
    observers.forEach(changed => changed());
    assert.equal(stage.children.length, 1, 'native reduced motion settles outgoing months');
    environment.window.dispatchEvent(new Event('pivo.personal.tasks'));
    assert.equal(container.querySelector('.calendar-event-form'), form);
    assert.equal(title.value, 'Draft');
  } finally { dispose(); assert.equal(observers.size, 0); assert.equal(preferenceListeners.size, 0); }
}));

test('calendar keeps siblings below an exiting first event', () => setup((container, values) => {
  reduced = false;
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const entries = [{ id: 'a', date, title: 'Alpha' }, { id: 'b', date, title: 'Beta' }];
  values.set('pivo.personal.calendar-events', JSON.stringify(entries));
  const dispose = widgets.find(widget => widget.id === 'calendar')!.mount(container as unknown as HTMLElement, () => {});
  try {
    const list = container.querySelector('.personal-holiday-events')!;
    const rows = list.children.filter(row => ['a', 'b'].includes(row.dataset.eventId!));
    values.set('pivo.personal.calendar-events', JSON.stringify(entries.slice(1)));
    environment.window.dispatchEvent(new Event('pivo.personal.calendar-events'));
    assert.deepEqual(list.children.filter(row => rows.includes(row)).map(row => rows.indexOf(row)), [0, 1],
      'surviving second row must stay below the collapsing first row');
    assert.equal(rows[0]!.inert, true);
  } finally { dispose(); }
}));

test('calendar prefers a live replacement over an outgoing event with the same id', () => setup((container, values) => {
  reduced = false;
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  values.set('pivo.personal.calendar-events', JSON.stringify([{ id: 'a', date, title: 'Alpha' }]));
  const dispose = widgets.find(widget => widget.id === 'calendar')!.mount(container as unknown as HTMLElement, () => {});
  try {
    const list = container.querySelector('.personal-holiday-events')!;
    values.set('pivo.personal.calendar-events', JSON.stringify([{ id: 'a', date, title: 'Updated' }]));
    environment.window.dispatchEvent(new Event('pivo.personal.calendar-events'));
    const replacement = list.children.find(row => row.dataset.eventId === 'a' && !row.inert)!;
    environment.window.dispatchEvent(new Event('pivo.personal.tasks'));
    assert.equal(list.children.find(row => row.dataset.eventId === 'a' && !row.inert), replacement,
      'unrelated updates must retain the live replacement');
    assert.equal(list.children.filter(row => row.dataset.eventId === 'a').length, 2);
  } finally { dispose(); }
}));
