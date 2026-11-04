import assert from 'node:assert/strict';
import test from 'node:test';
import { artworkAccent } from './artwork.ts';

test('dark artwork keeps its dominant saturated accent', () => {
  assert.deepEqual(artworkAccent(new Uint8ClampedArray([
    5, 5, 5, 255, 255, 255, 255, 255, 110, 11, 11, 255, 110, 11, 11, 255, 0, 230, 0, 0,
  ])), [176, 18, 18]);
});

test('neutral artwork does not introduce a colored accent', () => {
  assert.equal(artworkAccent(new Uint8ClampedArray([150, 150, 150, 255])), null);
});

test('a vivid magenta accent wins over a larger muted blue patch', () => {
  const pixels = new Uint8ClampedArray([
    185, 11, 142, 255,
    ...Array.from({ length: 3 }, () => [35, 43, 140, 255]).flat(),
  ]);
  assert.deepEqual(artworkAccent(pixels), [185, 11, 142]);
});
