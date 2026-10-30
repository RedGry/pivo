import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import english from '../../../../locales/en.json' with { type: 'json' };
import { translate, type Catalog } from './catalog.ts';

const directory = new URL('../../../../locales/', import.meta.url);
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('every discovered locale has valid keys and preserves message placeholders', () => {
  for (const file of readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const id = file.slice(0, -5);
    assert.equal(Intl.getCanonicalLocales(id).length, 1, `Invalid locale identifier: ${id}`);
    const catalog: Catalog = JSON.parse(readFileSync(new URL(file, directory), 'utf8'));
    assert.equal(typeof catalog.name, 'string');
    assert(catalog.name.length > 0);
    for (const [key, value] of Object.entries(catalog.messages)) {
      assert(Object.hasOwn(english.messages, key), `Unknown key ${key} in ${file}`);
      assert.equal(typeof value, 'string');
      assert.deepEqual(placeholders(value!), placeholders(english.messages[key as keyof typeof english.messages]), `${file}: ${key}`);
    }
  }
});

test('missing locales and partial translations fall back to English with safe interpolation', () => {
  const catalogs = { partial: { name: 'Partial', messages: {} } };
  assert.equal(translate(catalogs, 'missing', 'settings.title'), english.messages['settings.title']);
  assert.equal(translate(catalogs, 'partial', 'settings.title'), english.messages['settings.title']);
  assert.equal(translate(catalogs, 'partial', 'settings.version', { version: '<0.2>' }), 'Version <0.2>');
});
