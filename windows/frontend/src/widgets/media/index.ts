import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { t } from '../../i18n/index.ts';
import type { TranslationKey } from '../../i18n/catalog.ts';
import type { Widget } from '../types.ts';
import { seekConfirmed } from './seek.ts';
import { LyricsLookup } from './lyrics-lookup.ts';
import { alignVocalSegments, type VocalSegment } from './lyric-alignment.ts';
import { fetchLyricsLink } from './provider.ts';
import { playbackConfirmed, projectedPosition } from './playback.ts';
import { lyricAt, lyricCueWindow, nextLyricDelay, parseLyrics, type Lyric } from './lyrics.ts';

interface MediaSnapshot {
  source: string;
  title: string;
  artist: string;
  album: string;
  trackKey: string;
  artwork: string | null;
  positionMs: number | null;
  durationMs: number | null;
  playbackRate: number;
  sampledAtMs: number;
  playing: boolean;
  canToggle: boolean;
  canNext: boolean;
  canPrevious: boolean;
  canSeek: boolean;
}

type Action = 'toggle' | 'previous' | 'next';
const storageKey = 'pivo.media.lyrics.v1';
const showLyricsKey = 'pivo.media.show-lyrics';
const onlineLyricsKey = 'pivo.media.online-lyrics';
const approximateKey = 'pivo.media.approximate-lyrics';
let allowApproximate = false;
let alignment: { track: string; plain: string; lines: Lyric[]; pending: boolean } | undefined;
let extendedAlignmentTrack: string | undefined;
let alignmentWorkerBusy = false;
let showLyrics = true;
let allowOnlineLyrics = true;
const onlineLyrics = new LyricsLookup();
let current: MediaSnapshot | null = null;
let positionAnchor = 0;
interface PlaybackPreview {
  source: string;
  playing: boolean;
  acknowledgedAt: number | null;
}
let playbackPreview: PlaybackPreview | null = null;
interface SeekPreview {
  trackKey: string;
  positionMs: number;
  beforeSeek: number | null;
  acknowledgedAt: number | null;
}
let seekPreview: SeekPreview | null = null;
let seekQueue = Promise.resolve();
let unavailable = false;
let actionFailed = false;
let pending = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const observers = new Set<() => void>();
let lyrics: { track: string; lines: Lyric[]; plain?: string } | null = null;
try {
  const display = localStorage.getItem(showLyricsKey);
  showLyrics = display !== 'false';
  allowOnlineLyrics = localStorage.getItem(onlineLyricsKey) !== 'false';
  allowApproximate = localStorage.getItem(approximateKey) === 'true';
  lyrics = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
  if (typeof lyrics?.track !== 'string' || !Array.isArray(lyrics.lines)) lyrics = null;
} catch {
  // The player remains usable when storage is unavailable.
}

function legacyTrack(session: MediaSnapshot): string {
  return JSON.stringify([session.source, session.artist, session.title]);
}

function attachedLyrics(session: MediaSnapshot | null): typeof lyrics {
  return session && lyrics && (lyrics.track === session.trackKey || lyrics.track === legacyTrack(session))
    ? lyrics : null;
}

export function requestLyrics(allowAlignment = true): void {
  if (allowAlignment) requestApproximateLyrics();
  const session = current;
  if (!session || !allowOnlineLyrics || !showLyrics || attachedLyrics(session)) {
    onlineLyrics.cancel();
    return;
  }
  onlineLyrics.request(session, publish);
}

function lyricSources(session: MediaSnapshot) {
  const local = attachedLyrics(session);
  const lookup = onlineLyrics.state(session.trackKey);
  const online = allowOnlineLyrics && lookup.status === 'ready' ? lookup.result : null;
  return { lookup, timed: local?.lines ?? online?.timed ?? [], plain: (local ? local.plain : online?.plain) ?? '' };
}

function cancelApproximateLyrics(): void {
  const pending = alignment?.pending;
  alignment = undefined;
  if (pending) void invoke('pivo_cancel_lyric_alignment').catch(() => {});
}

function requestApproximateLyrics(): void {
  if (!current || !allowApproximate || !showLyrics || !isPlaying() || seekPreview) return;
  const { plain, timed } = lyricSources(current);
  if (!plain || timed.length || alignment || alignmentWorkerBusy) return;
  const job = { track: current.trackKey, plain, lines: [] as Lyric[], pending: true };
  alignment = job;
  alignmentWorkerBusy = true;
  const extended = extendedAlignmentTrack === job.track;
  extendedAlignmentTrack = undefined;
  void invoke<VocalSegment[]>('pivo_align_lyrics', { expectedTrack: job.track, extended })
    .then(segments => {
      if (alignment === job) job.lines = alignVocalSegments(plain, segments);
    }).catch(() => {}).finally(() => {
      alignmentWorkerBusy = false;
      if (alignment === job) job.pending = false;
      publish();
    });
}

function setLyrics(value: typeof lyrics): void {
  if (value) localStorage.setItem(storageKey, JSON.stringify(value));
  else localStorage.removeItem(storageKey);
  lyrics = value;
}

function summary(): string {
  if (unavailable) return t('media.unavailable');
  if (!current) return t('media.noSession');
  return [current.title, current.artist].filter(Boolean).join(' — ') || current.source;
}

function detail(): string {
  if (actionFailed) return t('media.actionFailed');
  const position = playbackPosition();
  return !showLyrics || position === null ? '' : lyricAt(attachedLyrics(current)?.lines ?? [], position);
}

function playbackPosition(): number | null {
  return seekPreview && seekPreview.trackKey === current?.trackKey
    ? seekPreview.positionMs
    : current ? projectedPosition(current.positionMs, isPlaying() ? performance.now() - positionAnchor : 0,
      current.playbackRate, current.durationMs) : null;
}

function isPlaying(): boolean {
  return playbackPreview && playbackPreview.source === current?.source
    ? playbackPreview.playing
    : current?.playing ?? false;
}

function publish(): void {
  if (alignment && (!allowApproximate || !showLyrics || !current || current.trackKey !== alignment.track
    || lyricSources(current).plain !== alignment.plain || lyricSources(current).timed.length
    || (alignment.pending && (!isPlaying() || seekPreview)))) cancelApproximateLyrics();
  for (const refresh of [...observers]) refresh();
}

let nativeRefreshQueued = false;
let artworkDirty = true;
let latestPlayback: { source: string; playing: boolean } | undefined;

function refreshFromNative(): void {
  if (!observers.size) return;
  if (pending) nativeRefreshQueued = true;
  else void sample();
}

const nativeMediaListeners = [
  listen('pivo:media-changed', refreshFromNative),
  listen('pivo:media-properties', () => {
    artworkDirty = true;
    refreshFromNative();
  }),
  listen<[string, boolean]>('pivo:media-playback', ({ payload: [source, playing] }) => {
    if (!observers.size) return;
    latestPlayback = { source, playing };
    if (current?.source === source && current.playing !== playing) {
      current = { ...current, positionMs: playbackPosition(), playing };
      positionAnchor = performance.now();
      publish();
    }
    refreshFromNative();
  }),
];
window.addEventListener('pagehide', () => {
  for (const listener of nativeMediaListeners) void listener.then(stop => stop(), console.error);
}, { once: true });

async function sample(): Promise<void> {
  if (pending || !observers.size) return;
  pending = true;
  clearTimeout(timer);
  try {
    const previous = current;
    const preview = seekPreview;
    const acknowledgedAt = preview?.acknowledgedAt;
    const playback = playbackPreview;
    const playbackAtStart = latestPlayback;
    const playbackAck = playback?.acknowledgedAt ?? null;
    const knownArtwork = !artworkDirty && previous?.artwork ? previous.trackKey : null;
    artworkDirty = false;
    const next = await invoke<MediaSnapshot | null>('pivo_media_snapshot', { knownArtwork });
    if (next && latestPlayback && latestPlayback !== playbackAtStart && next.source === latestPlayback.source) {
      next.playing = latestPlayback.playing;
    }
    if (seekPreview && next?.trackKey !== seekPreview.trackKey) seekPreview = null;
    if (playbackPreview && next?.source !== playbackPreview.source) playbackPreview = null;
    if (next && playback && playbackPreview === playback
      && playbackConfirmed(playback.playing, next.playing, playbackAck, performance.now())) playbackPreview = null;
    if (next && preview && seekPreview === preview
      && seekConfirmed(preview.positionMs, next.positionMs, preview.beforeSeek, acknowledgedAt ?? null, performance.now())) {
      seekPreview = null;
    }
    if (next && previous?.trackKey === next.trackKey) next.artwork ??= previous.artwork;
    else actionFailed = false;
    if (next?.playing) {
      next.positionMs = projectedPosition(next.positionMs, Date.now() - next.sampledAtMs, next.playbackRate, next.durationMs);
    }
    const previousPosition = playbackPosition();
    if (!seekPreview && next && next.trackKey === previous?.trackKey
      && previousPosition !== null && next.positionMs !== null
      && Math.abs(next.positionMs - previousPosition) > 2500
      && alignment?.track === next.trackKey && !alignment.lines.length) {
      cancelApproximateLyrics();
      extendedAlignmentTrack = next.trackKey;
    }
    positionAnchor = performance.now();
    current = next;
    unavailable = false;
  } catch {
    unavailable = true;
    current = null;
    seekPreview = null;
    playbackPreview = null;
  } finally {
    pending = false;
    const immediate = nativeRefreshQueued;
    nativeRefreshQueued = false;
    publish();
    if (observers.size) {
      if (immediate) void sample();
      else timer = setTimeout(() => void sample(), 1000);
    }
  }
}

function subscribe(refresh: () => void): () => void {
  observers.add(refresh);
  if (observers.size === 1) {
    artworkDirty = true;
    refreshFromNative();
  }
  return () => {
    observers.delete(refresh);
    if (!observers.size) clearTimeout(timer);
  };
}

export async function mediaAction(action: Action): Promise<void> {
  const session = current;
  if (!session) return;
  let preview: PlaybackPreview | null = null;
  if (action === 'toggle') {
    if (!session.canToggle || playbackPreview?.acknowledgedAt === null) return;
    preview = { source: session.source, playing: !isPlaying(), acknowledgedAt: null };
    session.positionMs = playbackPosition();
    positionAnchor = performance.now();
    playbackPreview = preview;
    actionFailed = false;
    publish();
  }
  let changed = false;
  try {
    changed = await invoke<boolean>('pivo_media_action', { action, source: session.source });
  } catch {
    // Report a rejected action and restore the most recent sampled state.
  }
  if (preview && playbackPreview === preview) {
    if (changed) preview.acknowledgedAt = performance.now();
    else playbackPreview = null;
  }
  if (current?.source === session.source) actionFailed = !changed;
  publish();
  await sample();
}

export function mediaView() {
  if (!current) return null;
  const { lookup, timed, plain: raw } = lyricSources(current);
  const positionMs = playbackPosition();
  const estimated = alignment?.track === current.trackKey && alignment.plain === raw && allowApproximate
    ? alignment.lines : [];
  const approximate = !timed.length && positionMs !== null && Boolean(lyricAt(estimated, positionMs));
  const lines = approximate ? estimated : timed;
  const synchronized = showLyrics && lines.length > 0 && positionMs !== null
    ? lyricCueWindow(lines, positionMs)
    : null;
  const plain = !synchronized && raw
    || (!synchronized && lines.length > 0 ? lines.map(line => line.text).join('\n').trim() : '');
  const canShowLyrics = Boolean(synchronized || plain);
  const lyricsStatus = canShowLyrics ? 'ready' : !allowOnlineLyrics ? 'disabled'
    : !current.title.trim() || !current.artist.trim() ? 'missing' : lookup.status;
  const alignmentStatus: TranslationKey | undefined = alignment?.track === current.trackKey && allowApproximate && !timed.length
    ? alignment.pending ? 'media.approximateAnalyzing'
      : alignment.lines.length ? 'media.approximateReplay' : 'media.approximateNoMatch'
    : undefined;
  return { ...current, playing: isPlaying(), positionMs, title: current.title || current.source,
    lyrics: synchronized, approximate, alignmentStatus,
    lyricDelay: showLyrics && positionMs !== null && isPlaying() && !seekPreview
      ? nextLyricDelay(timed.length ? timed : estimated, positionMs, current.playbackRate) : undefined, plainLyrics: showLyrics ? plain : '', lyricsStatus,
    error: actionFailed ? t('media.actionFailed') : '' };
}

export function lyricsEnabled(): boolean { return showLyrics; }

export function setShowLyrics(enabled: boolean): void {
  localStorage.setItem(showLyricsKey, String(enabled));
  showLyrics = enabled;
  if (!enabled) onlineLyrics.cancel();
  publish();
}

export async function seekMedia(fraction: number): Promise<void> {
  const session = current;
  if (!session?.canSeek || session.durationMs == null || !Number.isFinite(fraction)) return;
  const preview: SeekPreview = {
    trackKey: session.trackKey,
    positionMs: Math.min(1, Math.max(0, fraction)) * session.durationMs,
    beforeSeek: session.positionMs,
    acknowledgedAt: null,
  };
  seekPreview = preview;
  actionFailed = false;
  publish();
  seekQueue = seekQueue.then(async () => {
    if (seekPreview !== preview || current?.trackKey !== preview.trackKey) return;
    let changed = false;
    try {
      changed = await invoke<boolean>('pivo_media_seek', {
        source: session.source,
        expectedTrack: preview.trackKey,
        positionMs: preview.positionMs,
      });
    } catch {
      // Restore the reported position if the player rejects the seek.
    }
    if (seekPreview !== preview) return;
    if (changed) {
      preview.acknowledgedAt = performance.now();
      if (alignment?.track === preview.trackKey && !alignment.pending && !alignment.lines.length) {
        cancelApproximateLyrics();
        extendedAlignmentTrack = preview.trackKey;
      }
    } else seekPreview = null;
    actionFailed = !changed;
    publish();
    void sample();
  });
  await seekQueue;
}

function toggleLabel(): string {
  return t(isPlaying() ? 'media.pause' : 'media.play');
}

function mount(container: HTMLElement, refresh: () => void): () => void {
  const heading = document.createElement('h2');
  const trackLabel = document.createElement('p');
  const lyricLabel = document.createElement('p');
  const help = document.createElement('p');
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.lrc';
  file.hidden = true;
  const choose = document.createElement('button');
  choose.type = 'button';
  choose.onclick = () => file.click();
  const remove = document.createElement('button');
  const onlineToggle = document.createElement('input');
  onlineToggle.type = 'checkbox';
  onlineToggle.setAttribute('aria-describedby', 'online-lyrics-hint');
  const onlineText = document.createElement('span');
  const onlineLabel = document.createElement('label');
  onlineLabel.className = 'widget-toggle';
  onlineLabel.append(onlineText, onlineToggle);
  const approximateToggle = document.createElement('input');
  approximateToggle.type = 'checkbox';
  approximateToggle.setAttribute('aria-describedby', 'approximate-lyrics-hint');
  const approximateText = document.createElement('span');
  const approximateLabel = document.createElement('label');
  approximateLabel.className = 'widget-toggle';
  approximateLabel.append(approximateText, approximateToggle);
  const approximateHint = document.createElement('p');
  approximateHint.id = 'approximate-lyrics-hint';
  const onlineHint = document.createElement('p');
  onlineHint.id = 'online-lyrics-hint';
  const paste = document.createElement('textarea');
  paste.rows = 4;
  paste.maxLength = 64 * 1024;
  const pasteLabel = document.createElement('label');
  pasteLabel.className = 'media-paste-lyrics';
  const pasteTitle = document.createElement('span');
  pasteLabel.append(pasteTitle, paste);
  const pasteSave = document.createElement('button');
  pasteSave.type = 'button';
  pasteSave.onclick = async () => {
    const session = current;
    const plain = paste.value.trim();
    if (!session || !plain) return;
    try {
      const isLink = /^https?:\/\//i.test(plain);
      const linked = isLink && allowOnlineLyrics ? await fetchLyricsLink(plain) : null;
      if (current?.trackKey !== session.trackKey) return;
      if (isLink && !linked) {
        feedback.textContent = t('media.unavailable');
        return;
      }
      const lines = linked?.timed ?? parseLyrics(plain);
      const timed = lines.some(line => line.text);
      setLyrics({ track: session.trackKey, lines: timed ? lines : [], plain: timed ? undefined : linked?.plain ?? plain });
      paste.value = '';
      feedback.textContent = t('media.savedLyrics');
      render();
      refresh();
    } catch {
      feedback.textContent = t('media.unavailable');
    }
  };
  const feedback = document.createElement('p');
  feedback.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'widget-actions';
  const controls: [HTMLButtonElement, Action][] = [];
  for (const action of ['previous', 'toggle', 'next'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.onclick = () => void mediaAction(action);
    controls.push([button, action]);
    actions.append(button);
  }
  function render(): void {
    trackLabel.textContent = summary();
    lyricLabel.textContent = detail();
    help.textContent = t('media.lyricsHint');
    onlineText.textContent = t('media.onlineLyrics');
    onlineHint.textContent = t('media.onlineLyricsHint');
    onlineToggle.checked = allowOnlineLyrics;
    approximateText.textContent = t('media.approximateLyrics');
    approximateHint.textContent = t('media.approximateLyricsHint');
    approximateToggle.checked = allowApproximate;
    pasteTitle.textContent = t('media.pasteLyrics');
    pasteSave.textContent = t('media.savePastedLyrics');
    pasteSave.disabled = !current?.title;
    choose.textContent = t('media.chooseLyrics');
    choose.disabled = !current?.title;
    remove.textContent = t('media.removeLyrics');
    remove.disabled = !attachedLyrics(current);
    for (const [button, action] of controls) {
      button.textContent = action === 'toggle' ? toggleLabel() : t(action === 'previous' ? 'media.previous' : 'media.next');
      button.disabled = !(action === 'toggle' ? current?.canToggle : action === 'previous' ? current?.canPrevious : current?.canNext);
    }
  }
  let disposed = false;
  approximateToggle.onchange = () => {
    try {
      localStorage.setItem(approximateKey, String(approximateToggle.checked));
      allowApproximate = approximateToggle.checked;
      publish();
    } catch {
      approximateToggle.checked = allowApproximate;
      feedback.textContent = t('media.unavailable');
    }
  };
  onlineToggle.onchange = () => {
    try {
      localStorage.setItem(onlineLyricsKey, String(onlineToggle.checked));
      allowOnlineLyrics = onlineToggle.checked;
      if (!allowOnlineLyrics) onlineLyrics.cancel();
      publish();
    } catch {
      onlineToggle.checked = allowOnlineLyrics;
      feedback.textContent = t('media.unavailable');
    }
  };
  file.onchange = async () => {
    const session = current;
    const selected = file.files?.[0];
    file.value = '';
    if (!session?.title || !selected) return;
    try {
      const lines = selected.size <= 128 * 1024 ? parseLyrics(await selected.text()) : [];
      if (disposed) return;
      if (!lines.some(line => line.text)) {
        feedback.textContent = t('media.invalidLyrics');
        return;
      }
      setLyrics({ track: session.trackKey, lines });
      feedback.textContent = t('media.savedLyrics');
      render();
      refresh();
    } catch {
      feedback.textContent = t('media.unavailable');
    }
  };
  remove.type = 'button';
  remove.onclick = () => {
    try {
      setLyrics(null);
      feedback.textContent = '';
      render();
      refresh();
    } catch {
      feedback.textContent = t('media.unavailable');
    }
  };
  heading.textContent = t('media.lyrics');
  const playback = document.createElement('section');
  playback.className = 'setting-group media-playback';
  playback.append(trackLabel, actions, lyricLabel);
  const lyricsSettings = document.createElement('section');
  lyricsSettings.className = 'setting-group media-lyrics';
  const lyricActions = document.createElement('div');
  lyricActions.className = 'widget-actions';
  lyricActions.append(choose, pasteSave, remove);
  lyricsSettings.append(heading, onlineLabel, onlineHint, approximateLabel, approximateHint,
    help, file, pasteLabel, lyricActions, feedback);
  container.replaceChildren(playback, lyricsSettings);
  const unsubscribe = subscribe(render);
  render();
  return () => {
    disposed = true;
    unsubscribe();
    onlineToggle.onchange = null;
    approximateToggle.onchange = null;
    choose.onclick = null;
    pasteSave.onclick = null;
    file.onchange = null;
    remove.onclick = null;
    for (const [button] of controls) button.onclick = null;
  };
}

window.addEventListener('storage', event => {
  if (event.key === approximateKey) {
    allowApproximate = event.newValue === 'true';
    publish();
    return;
  }
  if (event.key === onlineLyricsKey) {
    allowOnlineLyrics = event.newValue !== 'false';
    if (!allowOnlineLyrics) onlineLyrics.cancel();
    publish();
    return;
  }
  if (event.key === showLyricsKey) {
    showLyrics = event.newValue !== 'false';
    if (!showLyrics) onlineLyrics.cancel();
    publish();
    return;
  }
  if (event.key !== storageKey) return;
  try {
    const value: typeof lyrics = JSON.parse(event.newValue ?? 'null');
    lyrics = typeof value?.track === 'string' && Array.isArray(value.lines) ? value : null;
    publish();
  } catch {
    // Keep the current lyrics when the replacement cannot be read.
  }
});

export const widgets: Widget[] = [{
  id: 'music',
  mount,
  summary: () => current?.title || summary(),
  detail: () => detail() || current?.artist || '',
  subscribe,
  primary: () => mediaAction('toggle'),
  secondary: () => mediaAction('next'),
  primaryLabel: toggleLabel,
  secondaryLabel: () => t('media.next'),
  primaryEnabled: () => Boolean(current?.canToggle),
  secondaryEnabled: () => Boolean(current?.canNext),
  actionKey: () => current?.trackKey,
}];
