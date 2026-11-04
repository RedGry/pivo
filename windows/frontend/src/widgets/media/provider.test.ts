import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchLyrics, fetchLyricsLink } from './provider.ts';

test('looks up encoded Windows metadata and accepts timed lyrics', async context => {
  context.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(url.origin + url.pathname, 'https://lrclib.net/api/get');
    assert.equal(url.searchParams.get('track_name'), 'Музыка & звук');
    assert.equal(url.searchParams.get('artist_name'), 'Artist');
    assert.equal(url.searchParams.get('duration'), '155');
    assert.equal(init.credentials, 'omit');
    return new Response(JSON.stringify({ syncedLyrics: '[00:01.5]Line', plainLyrics: 'Plain' }));
  });
  assert.deepEqual(await fetchLyrics('Музыка & звук', 'Artist', 155200), { timed: [{ timeMs: 1500, text: 'Line' }], plain: 'Plain' });
});

test('rejects oversized responses and missing metadata', async context => {
  const request = context.mock.method(globalThis, 'fetch', async () => new Response('x'.repeat(131073)));
  assert.deepEqual(await fetchLyrics('Title', '', null), null);
  assert.equal(request.mock.callCount(), 0);
  await assert.rejects(fetchLyrics('Title', 'Artist', null), /size limit/);
});

test('a missing track differs from a transient server failure', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
  assert.deepEqual(await fetchLyrics('Title', 'Artist', null), null);
  fetch.mock.mockImplementation(async () => new Response(null, { status: 500 }));
  await assert.rejects(fetchLyrics('Title', 'Artist', null), /unavailable/);
});

test('falls back to a normalized exact artist and title, preferring the matching album', async context => {
  context.mock.method(globalThis, 'fetch', async (url: URL) => {
    if (url.pathname === '/api/get') {
      assert.ok([null, 'Album'].includes(url.searchParams.get('album_name')));
      return new Response(null, { status: 404 });
    }
    assert.equal(url.pathname, '/api/search');
    return Response.json([
      { trackName: 'Song', artistName: 'Artist & Co', duration: 100, syncedLyrics: '[00:01]Other version' },
      { trackName: ' SONG ', artistName: 'ARTIST  & CO', albumName: 'album', duration: 102, syncedLyrics: '[00:02]Match' },
      { trackName: 'Song', artistName: 'Unrelated', albumName: 'Album', duration: 100, syncedLyrics: '[00:03]Wrong artist' },
    ]);
  });
  assert.deepEqual(await fetchLyrics('Song', 'Artist & Co', 100000, 'Album'), { timed: [{ timeMs: 2000, text: 'Match' }], plain: '' });
});

test('a matching plain-only result is kept without requesting another provider lookup', async context => {
  const request = context.mock.method(globalThis, 'fetch', async () => Response.json({
    trackName: 'Drag Me', artistName: 'From Ashes to New', duration: 186.237,
    syncedLyrics: null, plainLyrics: 'Fixture line one\nFixture line two',
  }));
  const result: unknown = await fetchLyrics('Drag Me', 'From Ashes to New', 186237);
  assert.deepEqual(result, { timed: [], plain: 'Fixture line one\nFixture line two' });
  assert.equal(request.mock.callCount(), 1);
});

test('finds a track published under a different album without falling back to search', async context => {
  const calls: string[] = [];
  context.mock.method(globalThis, 'fetch', async (url: URL) => {
    calls.push(url.pathname + '?' + url.searchParams.toString());
    return url.searchParams.has('album_name')
      ? new Response(null, { status: 404 })
      : Response.json({ plainLyrics: 'Fixture text' });
  });
  assert.deepEqual(await fetchLyrics('Drag Me', 'From Ashes to New', 186237, 'Reflections'), {
    timed: [], plain: 'Fixture text',
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => call.startsWith('/api/get?')));
  assert.match(calls[0]!, /album_name=Reflections/);
  assert.doesNotMatch(calls[1]!, /album_name=/);
});
test('finds a duet despite reversed credits and different separators', async context => {
  context.mock.method(globalThis, 'fetch', async (url: URL) => {
    if (url.pathname === '/api/get' || url.searchParams.has('artist_name')) {
      return new Response(null, { status: 404 });
    }
    return Response.json([
      { trackName: 'Song-Title', artistName: '029. Second и First', duration: 234, plainLyrics: 'Match' },
      { trackName: 'Song Title', artistName: 'First & Other', duration: 232, plainLyrics: 'Wrong artist' },
      { trackName: 'Song Title', artistName: 'Second & First', duration: 250, plainLyrics: 'Wrong version' },
    ]);
  });
  assert.deepEqual(await fetchLyrics('Song Title', 'First, Second', 232000), { timed: [], plain: 'Match' });
});

test('imports plain lyrics from a direct LRCLIB track link', async context => {
  const request = context.mock.method(globalThis, 'fetch', async (url: URL) => {
    assert.equal(url.href, 'https://lrclib.net/api/get/39930812');
    return Response.json({ plainLyrics: 'Fixture text' });
  });
  assert.equal(await fetchLyricsLink('https://example.com/tracks/39930812'), null);
  assert.deepEqual(await fetchLyricsLink('https://lrclib.net/tracks/39930812'), { timed: [], plain: 'Fixture text' });
  assert.equal(request.mock.callCount(), 1);
});
