import assert from 'node:assert/strict';
import test from 'node:test';
import { holidaySceneArtwork } from '../settings/holiday-scene.ts';
import { winterGarland } from './winter-garland.ts';
import { applyHolidayAppearance } from './holiday-appearance.ts';
import { occasionOutfitArtwork, occasionPieces } from './occasion-outfits.ts';
import { holidayTheme, holidayThemes, holidays, holidaysOn } from './holidays.ts';

test('holiday modes are independent from the dates shown in the calendar', () => {
  const halloween = new Date(2026, 9, 31);
  assert.deepEqual(holidaysOn(halloween).map(([id]) => id), ['halloween']);
  assert.equal(holidayTheme('off', halloween), undefined);
  assert.equal(holidayTheme('auto', halloween), 'spooky');
  assert.equal(holidayTheme('winter', halloween), 'winter');
  assert.equal(holidayTheme('auto', new Date(2026, 9, 30)), undefined);
});

test('reduced motion settles an artwork swap even when the selected theme stays the same', () => {
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const priorMedia = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  let cancelled = 0;
  let removed = 0;
  const artwork = (outgoing: boolean) => ({
    getAnimations: () => [{ cancel: () => cancelled++ }],
    classList: { contains: () => outgoing },
    remove: () => removed++,
  });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    documentElement: { dataset: { holidayTheme: 'spring' } },
    querySelectorAll: () => [artwork(false), artwork(true)],
  } });
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
  try {
    applyHolidayAppearance('off', 'spring');
    assert.equal(cancelled, 2);
    assert.equal(removed, 1);
  } finally {
    if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (priorMedia) Object.defineProperty(globalThis, 'matchMedia', priorMedia);
    else Reflect.deleteProperty(globalThis, 'matchMedia');
  }
});

test('movable holidays use the local calendar year and keep coincident entries', () => {
  const ids = (year: number, month: number, day: number) =>
    holidaysOn(new Date(year, month - 1, day)).map(([id]) => id);
  assert.deepEqual(ids(2026, 4, 5), ['easter']);
  assert.deepEqual(ids(2026, 4, 12), ['cosmonautics', 'orthodoxEaster']);
  assert.deepEqual(ids(2026, 11, 26), ['thanksgiving']);
  assert.deepEqual(ids(2026, 11, 29), ['mothersRussia']);
  assert.deepEqual(ids(2027, 11, 25), ['thanksgiving']);
});

test('every holiday interface mode mounts its own icon and ornament, independently of clothing', () => {
  const dataset: Record<string, string> = {};
  const icon = { dataset: { holidayArt: 'icon' }, innerHTML: '', hidden: true };
  const ornament = { dataset: { holidayArt: 'ornament' }, innerHTML: '', hidden: true };
  const rail = { dataset: { holidayArt: 'garland' }, innerHTML: '', hidden: true, clientWidth: 860 };
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    documentElement: { dataset },
    querySelectorAll: (selector: string) => selector === '[data-holiday-art]' ? [icon, ornament, rail] : [],
  } });
  try {
    const icons = new Set<string>();
    const ornaments = new Set<string>();
    for (const theme of holidayThemes) {
      applyHolidayAppearance('off', theme);
      assert.equal(dataset.holidayTheme, theme);
      assert.equal(dataset.holidayOutfit, undefined);
      assert.equal(icon.hidden, false);
      assert.equal(ornament.hidden, theme === 'winter');
      assert.equal(rail.hidden, theme !== 'winter');
      assert.match(icon.innerHTML, /viewBox="0 0 16 16"/);
        assert.match(theme === 'winter' ? rail.innerHTML : ornament.innerHTML,
        theme === 'winter' ? /viewBox="0 0 860 22"/ : /viewBox="0 0 120 26"/);
      icons.add(icon.innerHTML);
      ornaments.add(theme === 'winter' ? rail.innerHTML : ornament.innerHTML);
    }
    assert.equal(icons.size, holidayThemes.length);
    assert.equal(ornaments.size, holidayThemes.length);
    applyHolidayAppearance('auto', 'off', new Date(2027, 0, 1), { newYear: 'signature', winter: 'alternate' });
    assert.equal(dataset.holidayVariant, 'signature');
    applyHolidayAppearance('winter', 'off');
    assert.equal(dataset.holidayOutfit, 'winter');
    assert.equal(dataset.holidayTheme, undefined);
    assert.equal(icon.hidden && ornament.hidden && rail.hidden, true);
    assert.match(icon.innerHTML, /<svg/);
    assert.match(ornament.innerHTML, /<svg/);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
test('winter garland uses one continuous in-bounds cable at different widths', () => {
  for (const width of [160, 436, 820, 2560, 3840]) {
    const svg = winterGarland(width);
    assert.equal(svg.match(/<svg\b/g)?.length, 1);
    assert.ok(svg.includes(`viewBox="0 0 ${width} 22"`));
    const cable = /<path d="([^"]+)"/.exec(svg)?.[1] ?? '';
    assert.equal(cable.match(/M/g)?.length, 1);
    assert.ok(cable.startsWith('M2 4 Q'));
    assert.ok(cable.endsWith(` ${width - 2} 4`));
    const bulbs = [...svg.matchAll(/<ellipse cx="([^"]+)" cy="([^"]+)"/g)];
    assert.ok(bulbs.length > 0);
    for (const [, x, y] of bulbs) {
      assert.ok(Number(x) >= 5 && Number(x) <= width - 5);
      assert.ok(Number(y) > 3.3 && Number(y) < 22 - 3.3);
    }
  }
});

test('each theme supplies two complete and distinct scenery illustrations', () => {
  const art = holidayThemes.flatMap(theme => [
    holidaySceneArtwork(theme, 'left'), holidaySceneArtwork(theme, 'right'),
  ]);
  assert.equal(new Set(art).size, holidayThemes.length * 2);
  for (const svg of art) {
    assert.match(svg, /viewBox="0 0 240 270"/);
    assert.match(svg, /<path\b/);
  }
});
test('every holiday has three fitted outfit combinations with distinct pieces', () => {
  const combinations = new Set<string>();
  const drawings = new Set<string>();
  for (const [id] of holidays) {
    for (const style of ['classic', 'alternate', 'signature']) {
      const pieces = occasionPieces(id, style);
      assert.ok(pieces, id);
      combinations.add(pieces.join(':'));
      const svg = occasionOutfitArtwork(id, style);
      assert.match(svg, /<path/);
      assert.match(svg, /occasion-neck/);
      drawings.add(svg);
    }
  }
  assert.equal(combinations.size, holidays.length * 3);
  assert.equal(drawings.size, holidays.length * 3);
});
test('manual themes use fitted outfit variants too', () => {
  for (const theme of holidayThemes) {
    const choices = ['classic', 'alternate', 'signature'].map(variant => occasionOutfitArtwork(theme, variant));
    assert.equal(new Set(choices).size, 3, theme);
    assert.ok(choices.every(choice => choice.includes('occasion-neck')), theme);
  }
});
