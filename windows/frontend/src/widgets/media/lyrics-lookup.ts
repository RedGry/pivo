import { fetchLyrics, LyricsCooldown, type LyricsResult } from './provider.ts';

export interface LyricsTrack {
  trackKey: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
}

type State = { status: 'ready'; result: LyricsResult }
  | { status: 'missing'; retryAt: number }
  | { status: 'error' };

const retryDelays = [3_000, 15_000, 80_000];
const cooldownRetryLimit = 8;

export class LyricsLookup {
  private active: { track: string; controller: AbortController; retry?: ReturnType<typeof setTimeout> } | undefined;
  private selected: string | undefined;
  private cache = new Map<string, State>();

  private readonly fetch: typeof fetchLyrics;

  constructor(fetch = fetchLyrics) {
    this.fetch = fetch;
  }

  cancel(): void {
    clearTimeout(this.active?.retry);
    this.active?.controller.abort();
    this.active = undefined;
    if (this.selected !== undefined && this.cache.get(this.selected)?.status === 'error') {
      this.cache.delete(this.selected);
    }
    this.selected = undefined;
  }

  state(track: string): State | { status: 'loading' | 'idle' } {
    if (this.active?.track === track) return { status: 'loading' };
    return this.cache.get(track) ?? { status: 'idle' };
  }

  request(track: LyricsTrack, changed: () => void): void {
    if (this.active?.track === track.trackKey) return;
    if (this.selected !== track.trackKey) this.cancel();
    this.selected = track.trackKey;
    let { title, artist } = track;
    // YouTube VEVO sessions expose the channel as the artist and combine artist and title.
    const video = /^(.*?)\s+[-–—]\s+(.+)$/.exec(title);
    const channelKey = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (video && channelKey(artist) === channelKey(video[1]!) + 'vevo') {
      artist = video[1]!.trim();
      title = video[2]!.replace(/\s*[([](?:official\s+(?:music\s+)?video|official audio|clip officiel)[)\]]\s*$/i, '').trim();
    }
    if (!title.trim() || !artist.trim()) return;
    const cached = this.cache.get(track.trackKey);
    if (cached && (cached.status !== 'missing' || cached.retryAt > Date.now())) return;

    const request: NonNullable<LyricsLookup['active']> = { track: track.trackKey, controller: new AbortController() };
    this.active = request;
    const signal = request.controller.signal;
    const attempt = async (index: number): Promise<void> => {
      let state: State;
      try {
        const result = await this.fetch(title, artist, track.durationMs, track.album, () => !signal.aborted, signal);
        state = result ? { status: 'ready', result } : { status: 'missing', retryAt: Date.now() + 300_000 };
      } catch (error) {
        if (this.active !== request) return;
        const coolingDown = error instanceof LyricsCooldown;
        const delay = coolingDown && index < cooldownRetryLimit
          ? retryDelays[Math.min(index, retryDelays.length - 1)]
          : retryDelays[index];
        if (delay !== undefined) {
          const cooldown = coolingDown ? error.retryAt - Date.now() : 0;
          request.retry = setTimeout(() => void attempt(index + 1), Math.max(delay, cooldown));
          return;
        }
        state = { status: 'error' };
      }
      if (this.active !== request) return;
      this.active = undefined;
      this.cache.delete(request.track);
      if (this.cache.size >= 32) {
        const oldest = this.cache.keys().next().value;
        if (oldest !== undefined) this.cache.delete(oldest);
      }
      this.cache.set(request.track, state);
      changed();
    };
    void attempt(0);
  }
}
