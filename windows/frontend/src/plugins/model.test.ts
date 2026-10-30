import assert from 'node:assert/strict';
import test from 'node:test';
import { builtin, informationText, initialState, localized, movePlugin, parseManifest, pluginProgress, resetTimer, restore, saveConfiguration, secondsLeft, timerAction, timerFor, type Entry } from './model.ts';
import { configuration } from './configuration.ts';

test('external timer manifests accept localized names and bounded durations', () => {
  const manifest = parseManifest({ schemaVersion: 1, id: 'example.stretch', name: { en: 'Stretch', ru: 'Разминка' }, kind: 'timer', seconds: 3600, breakSeconds: 60, script: 'untrusted' });
  assert.equal(localized(manifest.name, 'ru-RU'), 'Разминка');
  assert.equal(localized(manifest.name, 'fr'), 'Stretch');
  assert.equal('script' in manifest, false);
  for (const seconds of [0, -1, 86401, Infinity, '25']) assert.throws(() => parseManifest({ ...manifest, seconds }));
  assert.throws(() => parseManifest({ ...manifest, schemaVersion: 2 }));
  assert.throws(() => parseManifest({ ...manifest, name: { ru: 'No fallback' } }));
});

test('timer pauses without losing elapsed time and catches up after sleep', () => {
  const entry = initialState().entries[0]!;
  entry.timer = timerAction(entry, 'primary', 1000);
  assert.equal(secondsLeft(entry.timer, 31_000), 1470);
  entry.timer = timerAction(entry, 'primary', 31_000);
  assert.equal(secondsLeft(entry.timer, 500_000), 1470);
  entry.timer = timerAction(entry, 'primary', 500_000);
  assert.equal(secondsLeft(entry.timer, 2_000_000), 0);
  entry.timer = timerAction(entry, 'primary', 2_000_000);
  assert.equal(secondsLeft(entry.timer, 2_000_000), 1500);
});

test('switching focus and break resets timer to plugin durations', () => {
  const entry = initialState().entries[0]!;
  entry.timer = timerAction(entry, 'primary', 1000);
  entry.timer = timerAction(entry, 'secondary', 9000);
  assert.deepEqual(entry.timer, { remaining: 300, deadline: null, mode: 'break' });
  entry.timer = timerAction(entry, 'secondary', 9000);
  assert.deepEqual(entry.timer, { remaining: 1500, deadline: null, mode: 'focus' });
});

test('restoration preserves disabled plugin order and rejects corrupted state', () => {
  const state = initialState();
  state.entries[0]!.enabled = false;
  state.entries.unshift({ enabled: true, manifest: parseManifest({ schemaVersion: 1, id: 'example.note', name: { en: 'Note' }, kind: 'information', text: { en: '<script>plain text</script>' } }) });
  state.selected = 'example.note';
  assert.deepEqual(restore(JSON.stringify(state)), state);
  assert.deepEqual(restore('{broken'), initialState());
  assert.deepEqual(restore(JSON.stringify({ entries: [{ enabled: true, manifest: builtin }, { enabled: true, manifest: builtin }] })), initialState());
});

test('reset stops a running timer and restores the current mode duration', () => {
  const entry = initialState().entries[0]!;
  entry.timer = timerAction(entry, 'primary', 1000);
  assert.deepEqual(resetTimer(entry), { remaining: 1500, deadline: null, mode: 'focus' });
  entry.timer = timerAction(entry, 'secondary', 1000);
  entry.timer = timerAction(entry, 'primary', 1000);
  assert.deepEqual(resetTimer(entry), { remaining: 300, deadline: null, mode: 'break' });
});

const configurableTimer = () => ({ schemaVersion: 1, id: 'example.timer', name: { en: 'Timer' }, kind: 'timer', seconds: 60, breakSeconds: 30,
  settings: [{ key: 'duration', type: 'number', bind: 'seconds', unit: 'minutes', label: { en: 'Duration (minutes)' }, default: 2, min: 1, max: 10 }],
});

test('declared timer settings drive initial duration, reset and subsequent starts', () => {
  const entry = { manifest: parseManifest(configurableTimer()), enabled: true };
  assert.equal(timerFor(entry).remaining, 120);
  saveConfiguration(entry, { duration: 4 });
  assert.equal(timerFor(entry).remaining, 240);
  assert.equal(secondsLeft(timerAction(entry, 'primary', 1000), 2000), 239);
  assert.equal(resetTimer(entry).remaining, 240);
});

test('configuration updates stop and reset only changed timer durations', () => {
  const state = initialState();
  const entry = state.entries[0]!;
  entry.timer = timerAction(entry, 'primary', 1000);
  const deadline = entry.timer.deadline;
  saveConfiguration(entry, { focus: 25, break: 5 });
  assert.equal(entry.timer.deadline, deadline);
  saveConfiguration(entry, { focus: 15, break: 3 });
  assert.deepEqual(entry.timer, { remaining: 900, deadline: null, mode: 'focus' });
  assert.equal(state.selected, builtin.id);
  assert.equal(entry.enabled, true);
  entry.timer = timerAction(entry, 'secondary', 1000);
  entry.timer = timerAction(entry, 'primary', 1000);
  saveConfiguration(entry, { focus: 15, break: 7 });
  assert.deepEqual(entry.timer, { remaining: 420, deadline: null, mode: 'break' });
});

test('invalid declarations, duplicate/reserved keys and unsupported bindings are rejected', () => {
  const manifest = configurableTimer();
  const field = manifest.settings[0]!;
  for (const override of [
    { key: 'constructor' }, { key: '__proto__' }, { type: 'javascript' }, { bind: 'process' }, { unit: 'hours' },
    { min: 0 }, { min: 5 }, { max: 2000 }, { default: '2' }, { label: { fr: 'No English' } }, { labelKey: 'plugins.focusMinutes' },
  ]) assert.throws(() => parseManifest({ ...manifest, settings: [{ ...field, ...override }] }));
  assert.throws(() => parseManifest({ ...manifest, settings: [field, field] }));
  assert.throws(() => parseManifest({ ...manifest, settings: [field, { ...field, key: 'other' }] }));
  for (const value of [0, 11, 1.5, '2', Infinity]) assert.throws(() => configuration(parseManifest(manifest).settings, { duration: value }, true));
  assert.throws(() => configuration(parseManifest(manifest).settings, { missing: 1 }, true));
});

test('information text settings interpolate as plain text, with language fallback', () => {
  const manifest = parseManifest({ schemaVersion: 1, id: 'example.note', name: { en: 'Note' }, kind: 'information',
    text: { en: 'Hello, {name}' }, settings: [{ key: 'name', type: 'text', bind: 'text', label: { en: 'Name' }, default: 'friend', maxLength: 30 }] });
  const entry = { manifest, enabled: true };
  assert.equal(informationText(entry, 'fr'), 'Hello, friend');
  saveConfiguration(entry, { name: '<img src=x onerror=alert(1)>' });
  assert.equal(informationText(entry, 'fr'), 'Hello, <img src=x onerror=alert(1)>');
  assert.throws(() => saveConfiguration(entry, { name: 'x'.repeat(31) }));
  assert.throws(() => parseManifest({ ...manifest, text: { en: '{unknown}' } }));
  assert.throws(() => parseManifest({ ...manifest, settings: [{ ...manifest.settings![0], bind: 'seconds' }] }));
});

test('restoration validates saved values and migrates old builtins without changing running time', () => {
  const old = { ...builtin }; delete old.settings;
  const timer = { remaining: 500, deadline: 10000, mode: 'focus' };
  const restored = restore(JSON.stringify({ selected: builtin.id, entries: [{ manifest: old, enabled: false, timer }] }));
  assert.equal(restored.entries[0]!.manifest.settings!.length, 2);
  assert.deepEqual(restored.entries[0]!.timer, timer);
  assert.equal(restored.entries[0]!.enabled, false);
  const corrupt = restore(JSON.stringify({ selected: builtin.id, entries: [{ manifest: builtin, enabled: true, values: { focus: -1, break: 'oops', constructor: 'x' }, timer }] }));
  assert.deepEqual(corrupt.entries[0]!.values, { focus: 25, break: 5 });
  const entry = restored.entries[0]!;
  saveConfiguration(entry, { focus: 9, break: 2 });
  assert.deepEqual(restore(JSON.stringify(restored)), restored);
});

test('legacy information cards keep literal braces without declaring settings', () => {
  const entry = { manifest: parseManifest({ schemaVersion: 1, id: 'example.legacy', name: { en: 'Legacy' }, kind: 'information', text: { en: 'Literal {name}' } }), enabled: true };
  assert.equal(informationText(entry, 'en'), 'Literal {name}');
});

test('plugin progress reports idle, running, paused, reset and completed timer states', () => {
  const entry = initialState().entries[0]!;
  assert.equal(pluginProgress(entry, 1000), 0);
  entry.timer = timerAction(entry, 'primary', 1000);
  assert.equal(pluginProgress(entry, 751000), 0.5);
  entry.timer = timerAction(entry, 'primary', 751000);
  assert.equal(pluginProgress(entry, 800000), 0.5);
  entry.timer = timerAction(entry, 'primary', 800000);
  assert.equal(pluginProgress(entry, 1550000), 1);
  assert.equal(pluginProgress(entry, 9999999), 1);
  entry.timer = resetTimer(entry);
  assert.equal(pluginProgress(entry, 9999999), 0);
});

test('external timer progress follows configured active-mode duration and clamps clock changes', () => {
  const entry: Entry = { manifest: parseManifest(configurableTimer()), enabled: true };
  saveConfiguration(entry, { duration: 4 });
  entry.timer = timerAction(entry, 'primary', 1000);
  assert.equal(pluginProgress(entry, 121000), 0.5);
  assert.equal(pluginProgress(entry, -10000), 0);
  entry.timer = timerAction(entry, 'secondary', 121000);
  assert.equal(pluginProgress(entry, 121000), 0);
  entry.timer = timerAction(entry, 'primary', 121000);
  assert.equal(pluginProgress(entry, 136000), 0.5);
  saveConfiguration(entry, { duration: 3 });
  assert.equal(pluginProgress(entry, 136000), 0);
});

test('information plugins provide no timer progress', () => {
  const entry: Entry = { manifest: parseManifest({ schemaVersion: 1, id: 'example.progressless', name: { en: 'Note' }, kind: 'information', text: { en: 'No progress' } }), enabled: true };
  assert.equal(pluginProgress(entry, 1000), null);
});

test('optional plugin metadata validates and roundtrips, with legacy metadata absent', () => {
  const raw = { ...configurableTimer(), description: { en: 'Take a break', ru: 'Перерыв' }, author: '  Example author  ', icon: { type: 'emoji', value: '🧘' } };
  const manifest = parseManifest(raw);
  assert.equal(manifest.author, 'Example author');
  assert.deepEqual(manifest.icon, { type: 'emoji', value: '🧘' });
  assert.equal(localized(manifest.description!, 'de'), 'Take a break');
  assert.deepEqual(parseManifest(manifest), manifest);
  assert.equal(parseManifest(configurableTimer()).description, undefined);
  assert.equal(parseManifest(configurableTimer()).author, undefined);
  assert.equal(parseManifest(configurableTimer()).icon, undefined);
  assert.throws(() => parseManifest({ ...raw, icon: { type: 'remote', url: 'https://example.com/icon.svg' } }));
  for (const author of ['', '  ', 123, {}, 'x'.repeat(81), null]) assert.throws(() => parseManifest({ ...raw, author }));
  for (const description of ['', null, {}, { fr: 'No fallback' }, { en: 'x'.repeat(501) }]) assert.throws(() => parseManifest({ ...raw, description }));
});

test('Island ordering swaps enabled neighbors while preserving disabled slots, selection and timers', () => {
  const state = initialState();
  const first = state.entries[0]!;
  first.timer = timerAction(first, 'primary', 1000);
  const disabled: Entry = { enabled: false, manifest: parseManifest({ ...configurableTimer(), id: 'example.disabled' }) };
  const second: Entry = { enabled: true, manifest: parseManifest(configurableTimer()) };
  state.entries.push(disabled, second);
  const selected = state.selected;
  const timer = { ...first.timer };
  movePlugin(state, first.manifest.id, 1);
  assert.deepEqual(state.entries, [second, disabled, first]);
  assert.equal(state.selected, selected);
  assert.deepEqual(first.timer, timer);
  movePlugin(state, disabled.manifest.id, 1);
  assert.deepEqual(state.entries, [second, disabled, first]);
  movePlugin(state, first.manifest.id, 1);
  assert.deepEqual(state.entries, [second, disabled, first]);
  movePlugin(state, first.manifest.id, -1);
  assert.deepEqual(state.entries, [first, disabled, second]);
  assert.deepEqual(restore(JSON.stringify(state)), state);
});
