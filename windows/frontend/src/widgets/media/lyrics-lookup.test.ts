import assert from 'node:assert/strict';
import test from 'node:test';
import { LyricsLookup } from './lyrics-lookup.ts';
import { LyricsCooldown, type LyricsResult } from './provider.ts';

test('the next track starts immediately and a late old response cannot replace it', async () => {
  const requests: { name: string; signal?: AbortSignal; resolve: (result: LyricsResult) => void }[] = [];
  const lookup = new LyricsLookup((name, _artist, _duration, _album, _allowed, signal) =>
    new Promise(resolve => requests.push({ name, signal, resolve })));
  const base = { artist: 'Artist', durationMs: 180_000, album: '' };
  let changes = 0;
  lookup.request({ ...base, title: 'First', trackKey: 'a' }, () => changes++);
  lookup.request({ ...base, title: 'Next', trackKey: 'b' }, () => changes++);
  assert.deepEqual(requests.map(request => request.name), ['First', 'Next']);
  assert.equal(requests[0]?.signal?.aborted, true);
  requests[0]?.resolve({ timed: [], plain: 'Old fixture' });
  requests[1]?.resolve({ timed: [], plain: 'Current fixture' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(lookup.state('a').status, 'idle');
  assert.deepEqual(lookup.state('b'), { status: 'ready', result: { timed: [], plain: 'Current fixture' } });
  assert.equal(changes, 1);
});

test('temporary errors retry on their own and stop at the attempt limit', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const lookup = new LyricsLookup(async () => {
    calls++;
    throw new Error('Temporary failure');
  });
  const track = { trackKey: 'a', title: 'Song', artist: 'Artist', album: '', durationMs: null };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  lookup.request(track, () => {});
  await flush();
  for (const delay of [3000, 15000, 80000]) {
    assert.equal(lookup.state('a').status, 'loading');
    t.mock.timers.tick(delay);
    await flush();
  }
  assert.equal(calls, 4);
  assert.equal(lookup.state('a').status, 'error');
  t.mock.timers.tick(300000);
  lookup.request(track, () => {});
  assert.equal(calls, 4);
});

test('successful recovery publishes once and cancellation clears a pending retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  let changes = 0;
  const lookup = new LyricsLookup(async () => {
    if (++calls === 2) return { timed: [], plain: 'Recovered' };
    throw new Error('Temporary failure');
  });
  const track = { trackKey: 'a', title: 'Song', artist: 'Artist', album: '', durationMs: null };
  const flush = () => new Promise(resolve => setImmediate(resolve));
  lookup.request(track, () => changes++);
  await flush();
  t.mock.timers.tick(3000);
  await flush();
  assert.equal(lookup.state('a').status, 'ready');
  assert.equal(changes, 1);
  lookup.request({ ...track, trackKey: 'b' }, () => changes++);
  await flush();
  lookup.cancel();
  t.mock.timers.tick(100000);
  assert.equal(calls, 3);
  assert.equal(changes, 1);
});

test('a 503 cooldown does not spend a retry before the service can accept it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let calls = 0;
  const lookup = new LyricsLookup(async () => {
    if (++calls === 1) throw new LyricsCooldown(Date.now() + 60_000);
    return { timed: [], plain: 'Recovered' };
  });
  lookup.request({ trackKey: 'a', title: 'Song', artist: 'Artist', album: '', durationMs: null }, () => {});
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  t.mock.timers.tick(3000);
  await flush();
  assert.equal(calls, 1);
  t.mock.timers.tick(57_000);
  await flush();
  assert.equal(lookup.state('a').status, 'ready');
});

test('repeated service cooldowns allow eight retries before stopping', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let calls = 0;
  const lookup = new LyricsLookup(async () => {
    calls++;
    throw new LyricsCooldown(Date.now() + 60_000);
  });
  lookup.request({ trackKey: 'a', title: 'Song', artist: 'Artist', album: '', durationMs: null }, () => {});
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  for (let index = 0; index < 8; index++) {
    assert.equal(lookup.state('a').status, 'loading');
    t.mock.timers.tick(index < 2 ? 60_000 : 80_000);
    await flush();
  }
  assert.equal(lookup.state('a').status, 'error');
  assert.equal(calls, 9);
});

test('VEVO metadata looks up the song and artist from the video title', () => {
  const calls: string[][] = [];
  const lookup = new LyricsLookup(async (title, artist) => {
    calls.push([title, artist]);
    return null;
  });
  lookup.request({
    trackKey: 'youtube',
    title: 'Vendredi sur Mer - Écoute chérie (Official Music Video)',
    artist: 'VendredisurMerVEVO',
    album: '',
    durationMs: 226_000,
  }, () => {});
  assert.deepEqual(calls, [['Écoute chérie', 'Vendredi sur Mer']]);
  lookup.cancel();
});
