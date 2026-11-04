import assert from 'node:assert/strict';
import test from 'node:test';
import { mountNotices, publishNotice } from './notice.ts';

class Node {
  namespaceURI = 'http://www.w3.org/2000/svg';
  className = '';
  dataset: Record<string, string> = {};
  children: Node[] = [];
  properties = new Map<string, string>();
  style = { setProperty: (name: string, value: string) => this.properties.set(name, value) };
  attributes = new Map<string, string>();
  textContent = '';
  hidden = true;
  animations = 0;
  parent?: Node;
  append(...children: Node[]) {
    for (const child of children) child.parent = this;
    this.children.push(...children);
  }
  replaceChildren(...children: Node[]) { this.children = []; this.append(...children); }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
  }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  animate() { this.animations++; return { cancel() {} }; }
}

test('same-kind language and Caps Lock changes retain outgoing text for the fade', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => new Node(), createElementNS: () => new Node(),
  } });
  const surface = new Node();
  const stop = mountNotices(surface as unknown as HTMLElement);
  try {
    publishNotice({ kind: 'language', text: 'English', badge: 'EN' });
    const english = surface.children[0]!;
    publishNotice({ kind: 'language', text: 'Russian', badge: 'RU' });
    assert.equal(english.children[0]?.children[1]?.textContent, 'English');
    assert.equal(english.attributes.get('aria-hidden'), 'true');
    assert.equal(surface.children[1]?.children[0]?.children[1]?.textContent, 'Russian');
    context.mock.timers.tick(310);
    publishNotice({ kind: 'capsLock', text: 'Caps Lock', badge: 'On', badgeActive: true });
    context.mock.timers.tick(310);
    const capsOn = surface.children[0]!;
    publishNotice({ kind: 'capsLock', text: 'Caps Lock', badge: 'Off', badgeActive: false });
    assert.equal(capsOn.children[0]?.children[3]?.textContent, 'On');
    assert.equal(capsOn.attributes.get('aria-hidden'), 'true');
    assert.equal(surface.children[1]?.children[0]?.children[3]?.textContent, 'Off');
  } finally {
    stop();
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('notices update meters in place and retain outgoing rows only during replacement', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => new Node(),
    createElementNS: () => new Node(),
  } });
  const surface = new Node();
  const stop = mountNotices(surface as unknown as HTMLElement);
  try {
    publishNotice({ kind: 'volume', text: 'Volume 32%', level: 32 });
    assert.equal(surface.hidden, false);
    assert.equal(surface.animations, 0);
    const row = surface.children[0]!;
    const card = row.children[0]!;
    assert.equal(card.dataset.kind, 'volume');
    assert.ok(card.children[0]?.children[0]?.attributes.get('d'));
    assert.equal(card.children[2]?.properties.get('--notice-level'), '0.32');
    publishNotice({ kind: 'volume', text: 'Volume 75%', level: 75 });
    assert.equal(surface.children[0]?.children[0], card);
    assert.equal(card.children[1]?.textContent, 'Volume 75%');
    assert.equal(card.children[2]?.properties.get('--notice-level'), '0.75');
    publishNotice({ kind: 'water', text: 'Water' }, { kind: 'tasks', text: 'Tasks' });
    assert.equal(row.attributes.get('aria-hidden'), 'true');
    assert.deepEqual(surface.children[1]?.children.map(node => node.dataset.kind), ['water', 'tasks']);
    context.mock.timers.tick(300);
    assert.equal(surface.children.length, 2);
    context.mock.timers.tick(10);
    assert.equal(surface.children.length, 1);
    publishNotice({ kind: 'language', text: 'English (United States)', badge: 'EN' });
    const languageCard = surface.children[1]?.children[0];
    assert.equal(languageCard?.children[1]?.textContent, 'English (United States)');
    assert.equal(languageCard?.children[3]?.textContent, 'EN');
    assert.equal(languageCard?.children[3]?.hidden, false);
    context.mock.timers.tick(2600);
    assert.equal(surface.hidden, true);
    const fading = surface.children[0]!;
    publishNotice({ kind: 'capsLock', text: 'Caps Lock', badge: 'On' });
    assert.equal(surface.hidden, false);
    assert.equal(fading.attributes.get('aria-hidden'), 'true');
    assert.equal(surface.children[1]?.children[0]?.dataset.kind, 'capsLock');
  } finally {
    stop();
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
