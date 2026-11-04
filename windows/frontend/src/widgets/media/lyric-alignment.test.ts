import assert from 'node:assert/strict';
import test from 'node:test';
import { alignVocalSegments } from './lyric-alignment.ts';

test('uses vocal timestamps and leaves instrumental gaps unhighlighted', () => {
  const result = alignVocalSegments('Всё начинается\nС первого шага\nСледующая строка', [
    { startMs: 8000, endMs: 9300, text: 'Все начинается!' },
    { startMs: 9400, endMs: 11200, text: 'С первого шага' },
    { startMs: 20000, endMs: 22200, text: 'Следующая строка' },
  ]);
  assert.deepEqual(result, [
    { timeMs: 8000, text: 'Всё начинается' }, { timeMs: 9300, text: '' },
    { timeMs: 9400, text: 'С первого шага' }, { timeMs: 11200, text: '' },
    { timeMs: 20000, text: 'Следующая строка' }, { timeMs: 22200, text: '' },
  ]);
});

test('rejects ambiguous refrains and isolated matches', () => {
  assert.deepEqual(alignVocalSegments('Once again\nDifferent words\nOnce again', [
    { startMs: 1000, endMs: 2000, text: 'Once again' },
    { startMs: 3000, endMs: 4000, text: 'Once again' },
  ]), []);
});

test('matches repeated lyrics when another line confirms their order', () => {
  const cues = alignVocalSegments('Once again\nDifferent words\nOnce again', [
    { startMs: 1000, endMs: 2000, text: 'Once again' },
    { startMs: 3000, endMs: 4000, text: 'Different words' },
    { startMs: 5000, endMs: 6000, text: 'Once again' },
  ]);
  assert.deepEqual(cues.filter(cue => cue.text).map(cue => cue.text),
    ['Once again', 'Different words', 'Once again']);
});

test('finds line boundaries inside or across recognition segments', () => {
  const cues = alignVocalSegments('Первый куплет\nВторая строка', [
    { startMs: 1000, endMs: 2500, text: 'Первый куплет вторая' },
    { startMs: 2600, endMs: 3000, text: 'строка' },
  ]);
  assert.deepEqual(cues.filter(cue => cue.text), [
    { timeMs: 1000, text: 'Первый куплет' },
    { timeMs: 2000, text: 'Вторая строка' },
  ]);
});

test('keeps matched lines when adjacent vocal timestamps overlap slightly', () => {
  const cues = alignVocalSegments('Первая строка\nВторая строка', [
    { startMs: 1000, endMs: 1600, text: 'Первая' },
    { startMs: 1500, endMs: 2200, text: 'строка' },
    { startMs: 2100, endMs: 2700, text: 'Вторая' },
    { startMs: 2700, endMs: 3200, text: 'строка' },
  ]);
  assert.deepEqual(cues.filter(cue => cue.text).map(cue => cue.timeMs), [1000, 2200]);
});
