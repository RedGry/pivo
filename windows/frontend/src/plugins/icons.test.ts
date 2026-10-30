import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePluginIcon } from './icons.ts';

const pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const png = (data: Uint8Array) => ({ type: 'png', data: 'data:image/png;base64,' + Buffer.from(data).toString('base64') });

test('emoji icons accept one glyph including joined families, flags and keycaps', () => {
  for (const value of ['🍅', '👨‍👩‍👧‍👦', '🇬🇧', '1️⃣', '♥️']) {
    assert.deepEqual(parsePluginIcon({ type: 'emoji', value, ignored: true }), { type: 'emoji', value });
  }
  for (const value of ['', 'hello', '🍅🍅', ' 🍅', '<script>', 'a'.repeat(40), '🍅\n']) {
    assert.throws(() => parsePluginIcon({ type: 'emoji', value }));
  }
});

test('static inline PNG icons preserve their data while rejecting external and executable formats', () => {
  const icon = { type: 'png', data: 'data:image/png;base64,' + pixel };
  assert.deepEqual(parsePluginIcon(icon), icon);
  for (const raw of [null, undefined, [], { type: 'svg', data: '<svg/>' }, { type: 'image', data: icon.data },
    { ...icon, data: 'https://example.com/icon.png' }, { ...icon, data: 'file:///icon.png' },
    { ...icon, data: 'data:image/svg+xml;base64,' + pixel }, { ...icon, data: icon.data + '\n' },
    { ...icon, data: 'data:image/png;base64,not base64' }, { ...icon, data: 'data:image/png;base64,AAAA' }]) {
    assert.throws(() => parsePluginIcon(raw));
  }
});

test('PNG size, dimensions and chunk structure are bounded before browser decoding', () => {
  const original = Buffer.from(pixel, 'base64');
  for (const [width, height] of [[0, 1], [1, 0], [257, 1], [1, 257], [0xffffffff, 1]]) {
    const bytes = Buffer.from(original); bytes.writeUInt32BE(width!, 16); bytes.writeUInt32BE(height!, 20);
    assert.throws(() => parsePluginIcon(png(bytes)));
  }
  assert.throws(() => parsePluginIcon(png(Buffer.alloc(32769))));
  assert.throws(() => parsePluginIcon(png(original.subarray(0, -1))));
  assert.throws(() => parsePluginIcon(png(Buffer.concat([original, Buffer.from([0])]))));
  const wrongSignature = Buffer.from(original); wrongSignature[0] = 0;
  assert.throws(() => parsePluginIcon(png(wrongSignature)));
  const impossibleLength = Buffer.from(original); impossibleLength.writeUInt32BE(0xffffffff, 8);
  assert.throws(() => parsePluginIcon(png(impossibleLength)));
  const noData = Buffer.concat([original.subarray(0, 33), original.subarray(-12)]);
  assert.throws(() => parsePluginIcon(png(noData)));
});

test('animated PNG chunks are rejected so icons cannot keep idle animation running', () => {
  const original = Buffer.from(pixel, 'base64');
  for (const name of ['acTL', 'fcTL', 'fdAT']) {
    const chunk = Buffer.alloc(12); chunk.write(name, 4, 'ascii');
    assert.throws(() => parsePluginIcon(png(Buffer.concat([original.subarray(0, 33), chunk, original.subarray(33)]))));
  }
});
