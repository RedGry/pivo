import { parseLyrics, type Lyric } from './lyrics.ts';

let retryAfter = 0;

export class LyricsCooldown extends Error {
  readonly retryAt: number;

  constructor(retryAt: number) {
    super('Lyrics service is cooling down');
    this.retryAt = retryAt;
  }
}

function normalized(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim();
}

function artistCredits(value: string): string[] {
  return normalized(value).replace(/^\d{1,3}\.\s+/, '')
    .split(/\s*(?:[,;]|\s+(?:&|и)\s+)\s*/).filter(Boolean).sort();
}

interface LyricsRecord {
  syncedLyrics?: unknown;
  plainLyrics?: unknown;
  trackName?: unknown;
  artistName?: unknown;
  albumName?: unknown;
  duration?: unknown;
}

export interface LyricsResult {
  timed: Lyric[];
  plain: string;
}

function lyricsFrom(record: LyricsRecord | null): LyricsResult {
  const lines = typeof record?.syncedLyrics === 'string' ? parseLyrics(record.syncedLyrics) : [];
  const timed = lines.some(line => line.text) ? lines : [];
  const plain = typeof record?.plainLyrics === 'string' ? record.plainLyrics.trim() : '';
  return { timed, plain };
}

export async function fetchLyrics(
  title: string, artist: string, durationMs: number | null, album = '', allowed = () => true, signal?: AbortSignal,
): Promise<LyricsResult | null> {
  if (!title.trim() || !artist.trim() || title.length > 256 || artist.length > 256) return null;
  const url = new URL('https://lrclib.net/api/get');
  url.searchParams.set('track_name', title.trim());
  url.searchParams.set('artist_name', artist.trim());
  const duration = durationMs !== null && durationMs >= 1000 && durationMs <= 3_600_000 ? durationMs / 1000 : null;
  if (duration !== null) url.searchParams.set('duration', String(Math.round(duration)));
  if (album.trim() && album.length <= 256) url.searchParams.set('album_name', album.trim());
  if (signal?.aborted || !allowed()) return null;
  const result = lyricsFrom(await fetchRecord<LyricsRecord>(url, 128 * 1024, signal));
  if (result.timed.length || result.plain) return result;
  if (url.searchParams.has('album_name')) {
    await new Promise(resolve => setTimeout(resolve, 250));
    if (signal?.aborted || !allowed()) return null;
    url.searchParams.delete('album_name');
    const withoutAlbum = lyricsFrom(await fetchRecord<LyricsRecord>(url, 128 * 1024, signal));
    if (withoutAlbum.timed.length || withoutAlbum.plain) return withoutAlbum;
  }

  const search = new URL('https://lrclib.net/api/search');
  search.searchParams.set('track_name', title.trim());
  const titleKey = normalized(title).replace(/\s*-\s*/g, ' ');
  const credits = artistCredits(artist);
  for (const artistQuery of credits.length > 1 && duration !== null ? [artist.trim(), ''] : [artist.trim()]) {
    if (artistQuery) search.searchParams.set('artist_name', artistQuery);
    else search.searchParams.delete('artist_name');
    await new Promise(resolve => setTimeout(resolve, 250));
    if (signal?.aborted || !allowed()) return null;
    const candidates = await fetchRecord<LyricsRecord[]>(search, 512 * 1024, signal);
    const matches = (Array.isArray(candidates) ? candidates : []).filter(record =>
      typeof record?.trackName === 'string' && normalized(record.trackName).replace(/\s*-\s*/g, ' ') === titleKey
      && typeof record.artistName === 'string'
      && artistCredits(record.artistName).join('\0') === credits.join('\0')
      && (duration === null || typeof record.duration === 'number' && Math.abs(record.duration - duration) <= 5)
      && (typeof record.syncedLyrics === 'string' && record.syncedLyrics.trim()
        || typeof record.plainLyrics === 'string' && record.plainLyrics.trim()));
    const sameAlbum = matches.filter(record => album.trim() && typeof record.albumName === 'string'
      && normalized(record.albumName) === normalized(album));
    const preferred = sameAlbum.length ? sameAlbum : matches;
    const first = preferred[0];
    if (first && preferred.every(record => record.syncedLyrics === first.syncedLyrics
      && (typeof first.syncedLyrics === 'string' && first.syncedLyrics.trim() || record.plainLyrics === first.plainLyrics))) {
      const result = lyricsFrom(first);
      if (result.timed.length || result.plain) return result;
    }
  }
  return null;
}

export async function fetchLyricsLink(value: string): Promise<LyricsResult | null> {
  const id = /^https:\/\/(?:www\.)?lrclib\.net\/tracks\/(\d{1,16})\/?$/.exec(value)?.[1];
  if (!id) return null;
  const record = await fetchRecord<LyricsRecord>(new URL(`https://lrclib.net/api/get/${id}`), 128 * 1024, undefined, false);
  const result = lyricsFrom(record);
  return result.timed.length || result.plain ? result : null;
}

async function fetchRecord<T>(url: URL, limit: number, signal?: AbortSignal, searchCooldown = true): Promise<T | null> {
  if (searchCooldown && Date.now() < retryAfter) {
    throw new LyricsCooldown(retryAfter);
  }
  const response = await fetch(url, {
    credentials: 'omit',
    redirect: 'error',
    headers: { 'Lrclib-Client': 'PivO v0.1.0 (https://github.com/RedGry/pivo)' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
  });
  if (searchCooldown && (response.status === 429 || response.status === 503)) {
    const header = response.headers.get('Retry-After')?.trim() ?? '';
    const now = Date.now();
    const deadline = /^\d+$/.test(header) ? now + Number(header) * 1000 : Date.parse(header);
    retryAfter = Math.max(now + 1000, Number.isFinite(deadline) ? deadline : now + 60_000);
    throw new LyricsCooldown(retryAfter);
  }
  if (response.status === 404) return null;
  if (!response.ok || !response.body) throw new Error('Lyrics service is unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error('Lyrics response exceeds size limit');
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(body + decoder.decode()) as T;
}
