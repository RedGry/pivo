import { lyricSeekTarget, renderLyricRows, replaceLyricText, settleLyricText } from '../widgets/media/lyric-rows.ts';
import { calendarHolidayIcon } from '../presentation/calendar-holiday-icons.ts';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { locale, t } from '../i18n/index.ts';
import { artworkAccent } from '../presentation/artwork.ts';
import { pluginProgress, secondsLeft, timerAction, timerFor } from './model.ts';
import { loadPlugins, savePlugins, subscribePlugins } from './store.ts';
import { widgets, widgetEnabled, widgetTitle } from '../widgets/index.ts';
import type { IslandPreview, Widget } from '../widgets/types.ts';
import { lyricsEnabled, mediaView, mediaAction, requestLyrics, seekMedia, setShowLyrics } from '../widgets/media/index.ts';
import { toggleTaskDone } from '../widgets/personal/index.ts';
import './style.css';
import '../widgets/media/lyrics.css';

const selectionKey = 'pivo.widget.selected';
const marks: Record<string, string> = { music: '♫', tasks: '✓', calendar: '▦', pomodoro: '◷', water: '◉', shelf: '▤', hud: '◫' };
const pageSlots = 7;

const icons: Record<string, string> = {
  back: 'M14 5l-7 7 7 7',
  forward: 'M10 5l7 7-7 7',
  previous: 'M5 5v14m14-14L8 12l11 7z',
  next: 'M19 5v14M5 5l11 7-11 7z',
  play: 'M8 5l12 7-12 7z',
  pause: 'M8 5v14m8-14v14',
  lyrics: 'M4 6h16M4 12h16M4 18h10',
  settings: 'M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  open: 'M13 5h6v6m0-6-9 9m7 0v5H5V7h5',
  add: 'M12 5v14M5 12h14',
  edit: 'M4 20l4-1L19 8l-3-3L5 16l-1 4Zm10-13l3 3',
  water: 'M12 3c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12z',
  undo: 'M4 10l5-5m-5 5 5 5m-5-5h10a5 5 0 1 1 0 10',
  remove: 'M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 3v7m4-7v7',
  break: 'M4 8h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zm13 1h2a2 2 0 0 1 0 4h-2',
};

function setText(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function setAttribute(element: Element, name: string, value: string | null): void {
  if (element.getAttribute(name) === value) return;
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function setHidden(element: HTMLElement, hidden: HTMLElement['hidden']): void {
  if (element.hidden !== hidden) element.hidden = hidden;
}

function setIcon(element: HTMLElement, name: string, label: string): void {
  setAttribute(element, 'title', label);
  setAttribute(element, 'aria-label', label);
  if (element.dataset.icon === name) return;
  element.dataset.icon = name;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', icons[name]!);
  svg.append(path);
  element.replaceChildren(svg);
}

function playbackTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

function previewNodes(preview: IslandPreview): HTMLElement[] {
  if (preview.kind === 'intake') {
    const chart = document.createElement('div');
    chart.className = 'intake-chart';
    chart.dataset.empty = String(preview.servings.length === 0);
    chart.setAttribute('aria-hidden', 'true');
    const amounts = preview.servings.reduce<number[]>((totals, serving) => {
      totals.push((totals.at(-1) ?? 0) + serving);
      return totals;
    }, []);
    const progress = document.createElement('progress');
    progress.max = Math.max(1, preview.goal);
    progress.value = Math.min(progress.max, amounts.at(-1) ?? 0);
    progress.setAttribute('aria-label', t('personal.waterProgress', { total: amounts.at(-1) ?? 0, goal: preview.goal }));
    const percentage = document.createElement('small');
    percentage.className = 'intake-percent';
    percentage.textContent = new Intl.NumberFormat(locale(), { style: 'percent' }).format(progress.value / progress.max);
    const recent = amounts.slice(-10);
    for (let index = 0; index < 10; index++) {
      const amount = recent[index] ?? 0;
      const column = document.createElement('span');
      const bar = document.createElement('i');
      bar.style.height = Math.min(100, amount / Math.max(1, preview.goal) * 100) + '%';
      column.append(bar);
      chart.append(column);
    }
    return [percentage, progress, chart];
  }
  if (preview.kind === 'week') {
    return preview.days.map(day => {
      const cell = document.createElement('span');
      cell.className = 'widget-day';
      cell.dataset.today = String(day.today);
      if (day.holiday) {
        cell.classList.add('has-holiday');
        cell.title = day.holiday;
        cell.setAttribute('aria-label', `${day.date} · ${day.holiday}`);
      }
      const label = document.createElement('small');
      label.textContent = day.label;
      const date = document.createElement('strong');
      date.textContent = String(day.date);
      for (const glyph of day.holidayIcons?.slice(0, 2) ?? []) {
        const icon = document.createElement('i');
        icon.className = 'widget-holiday-icon';
        icon.innerHTML = calendarHolidayIcon(glyph);
        date.append(icon);
      }
      cell.append(label, date);
      return cell;
    });
  }
  if (preview.kind === 'todo') {
    const count = document.createElement('strong');
    count.className = 'todo-count';
    count.textContent = `${preview.done}/${preview.total}`;
    const rows = document.createElement('div');
    rows.className = 'todo-rows';
    for (const [index, item] of preview.items.entries()) {
      const row = document.createElement('span');
      row.dataset.done = String(item.done);
      row.dataset.nativeAction = String(22 + index);
      row.title = item.title;
      const mark = document.createElement('i');
      mark.className = 'todo-mark';
      mark.setAttribute('aria-hidden', 'true');
      const title = document.createElement('span');
      title.className = 'todo-title';
      title.textContent = item.title;
      row.append(mark, title);
      rows.append(row);
    }
    rows.dataset.empty = String(preview.total === 0);
    if (preview.total === 0) {
      const empty = document.createElement('span');
      empty.textContent = t('personal.noTasks');
      rows.append(empty);
    }
    return [count, rows];
  }
  return preview.items.map(item => {
    const line = document.createElement('span');
    line.textContent = item;
    return line;
  });
}

export function mountPluginIsland(container: HTMLElement, onProgress?: (value: number | null) => void, pageChanged?: () => void, onLyricsWidth?: (open: boolean, complete?: () => void) => void) {
  const backdrop = document.createElement('div');
  backdrop.className = 'music-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  backdrop.hidden = true;
  container.parentElement?.prepend(backdrop);
  let taskRows: string[] = [];
  let visible = false;
  let progressVisible = false;
  let mediaVisible = false;
  let disposed = false;
  let controlsKey = '';
  let revision = 0;
  let lyricTargets: (number | undefined)[] = [];
  let mask = 0;
  let music = false;
  let lyrics = false;
  let closingLyrics = false;
  let sentRevision = 0;
  let sentPages: (string | undefined)[] = [];
  let sending = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let selected = localStorage.getItem(selectionKey) ?? 'pomodoro';
  let subscribed: Widget | undefined;
  let stopWidget: (() => void) | undefined;
  const title = document.createElement('h2');
  title.className = 'plugin-title';
  const titleIcon = document.createElement('span');
  titleIcon.setAttribute('aria-hidden', 'true');
  const titleName = document.createElement('span');
  title.append(titleIcon, titleName);
  let renderedIcon: string | undefined;
  const value = document.createElement('div');
  const detail = document.createElement('div');
  const preview = document.createElement('div');
  preview.className = 'widget-preview';
  const card = document.createElement('div');
  card.className = 'widget-body';
  card.append(title, value, detail, preview);
  const artwork = document.createElement('img');
  artwork.className = 'track-artwork';
  artwork.alt = '';
  const sample = document.createElement('canvas');
  sample.width = sample.height = 32;
  const artworkContext = sample.getContext('2d');
  let artworkTrack: string | undefined;
  let flipArtwork = false;
  function playArtworkFlip(): void {
    if (flipArtwork && visible && !document.hidden
      && container.closest('.panel')?.getAttribute('data-reduced-motion') !== 'true') {
      artwork.getAnimations().forEach(animation => animation.cancel());
      artwork.animate([
        { transform: 'perspective(180px) rotateY(-90deg)' },
        { transform: 'perspective(180px) rotateY(0deg)' },
      ], { duration: 300, easing: 'ease-out' });
    }
    flipArtwork = false;
  }
  artwork.addEventListener('load', () => {
    if (!artwork.getAttribute('src')) return;
    if (artworkContext) {
      const size = sample.width;
      artworkContext.clearRect(0, 0, size, size);
      artworkContext.drawImage(artwork, 0, 0, size, size);
      const accent = artworkAccent(artworkContext.getImageData(0, 0, size, size).data);
      if (accent) backdrop.style.setProperty('--track-accent', `rgb(${accent.join(' ')} / .8)`);
    }
    playArtworkFlip();
  });
  artwork.addEventListener('error', () => backdrop.style.removeProperty('--track-accent'));
  const playback = document.createElement('span');
  playback.className = 'track-playback';
  playback.setAttribute('aria-hidden', 'true');
  playback.append(...Array.from({ length: 3 }, () => document.createElement('i')));
  const artist = document.createElement('div');
  artist.className = 'track-artist';
  const timeline = document.createElement('div');
  timeline.className = 'track-timeline';
  const elapsed = document.createElement('span');
  const remaining = document.createElement('span');
  const seek = document.createElement('span');
  seek.className = 'track-seek';
  seek.dataset.nativeAction = '17';
  const progress = document.createElement('progress');
  progress.max = 1;
  seek.append(progress);
  timeline.append(elapsed, seek, remaining);
  value.after(artist);
  const timerDial = document.createElement('div');
  timerDial.className = 'timer-dial';
  timerDial.setAttribute('aria-hidden', 'true');
  timerDial.innerHTML = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27"/><circle class="timer-arc" cx="32" cy="32" r="27" pathLength="100"/><path d="M43 32a11 11 0 1 1-22 0 11 11 0 0 1 22 0ZM32 25v7l5 3"/></svg>';
  card.append(artwork, playback, timeline, timerDial);
  const lyricsPanel = document.createElement('section');
  const plainLyrics = document.createElement('div');
  plainLyrics.className = 'track-lyrics-plain';
  plainLyrics.hidden = true;
  lyricsPanel.className = 'track-lyrics';
  const approximateLabel = document.createElement('small');
  approximateLabel.hidden = true;
  lyricsPanel.append(approximateLabel);
  const lyricLines = Array.from({ length: 3 }, (_, index) => {
    const line = document.createElement('p');
    if (index === 1) line.className = 'track-lyrics-current';
    lyricsPanel.append(line);
    return line;
  });
  const renderLyrics = renderLyricRows(lyricLines);
  const pageBar = document.createElement('div');
  pageBar.className = 'widget-pages';
  const pageDots = Array.from({ length: pageSlots }, (_, index) => {
    const dot = document.createElement('span');
    dot.dataset.nativeAction = String(10 + index);
    pageBar.append(dot);
    return dot;
  });
  const controls = document.createElement('div');
  controls.className = 'plugin-controls';
  // The native proxies own input. DOM labels follow their availability.
  const buttons = Array.from({ length: 4 }, (_, index) => {
    const button = document.createElement('span');
    button.dataset.nativeAction = String(6 + index);
    controls.append(button);
    return button;
  });
  const pageArrows = ['back', 'forward'].map((icon, index) => {
    const arrow = document.createElement('span');
    arrow.className = 'music-page-arrow';
    arrow.dataset.nativeAction = String(18 + index);
    setIcon(arrow, icon, t(index === 0 ? 'plugins.previous' : 'plugins.next'));
    controls.append(arrow);
    return arrow;
  });
  value.className = 'plugin-value';
  detail.className = 'plugin-detail';
  lyricsPanel.append(plainLyrics);
  container.replaceChildren(card, controls, pageBar, lyricsPanel);

  function pages(pomodoroEnabled: boolean): string[] {
    const available = widgets.filter(widget => widgetEnabled(widget.id)).map(widget => widget.id);
    if (pomodoroEnabled) {
      const afterCalendar = available.findIndex(id => ['water', 'shelf', 'hud'].includes(id));
      available.splice(afterCalendar < 0 ? available.length : afterCalendar, 0, 'pomodoro');
    }
    return available;
  }

  function operation(widget: Widget | undefined, action: 'primary' | 'secondary') {
    const enabled = action === 'primary' ? widget?.primaryEnabled : widget?.secondaryEnabled;
    return enabled?.() === false ? undefined : widget?.[action];
  }

  function synchronizeControls(): void {
    if (disposed || sending || closingLyrics || sentRevision === revision) return;
    const requested = revision;
    const requestedPages = pageDots.map(dot => dot.dataset.page);
    sending = true;
    void invoke('pivo_plugin_controls', {
      mask, revision: requested, music, lyrics,
      shelf: container.dataset.pluginId === 'shelf', shelfEnabled: widgetEnabled('shelf'),
    }).then(() => {
      sentRevision = requested;
      sentPages = requestedPages;
      sending = false;
      synchronizeControls();
    }).catch(error => {
      sending = false;
      console.error('Unable to update widget controls:', error);
    });
  }

  function render(): void {
    clearTimeout(timeout);
    if (disposed) return;
    const entry = loadPlugins().entries.find(item => item.enabled);
    const available = pages(Boolean(entry));
    const id = available.includes(selected) ? selected : available[0];
    const widget = widgets.find(item => item.id === id);
    music = id === 'music';
    const media = music || (!visible && mediaVisible) ? mediaView() : null;
    const track = music ? media : null;
    setHidden(backdrop, container.hidden || (!music && !media));
    if (!backdrop.hidden) backdrop.toggleAttribute('data-compact-only', !music);
    const showLyrics = !container.hidden && music && lyricsEnabled();
    const changedLyrics = lyrics !== showLyrics;
    lyrics = showLyrics;
    if (changedLyrics && lyrics && closingLyrics) {
      closingLyrics = false;
      onLyricsWidth?.(true);
    } else if (changedLyrics && !lyrics && visible && onLyricsWidth) {
      closingLyrics = true;
      onLyricsWidth(false, () => {
        closingLyrics = false;
        setHidden(lyricsPanel, !lyrics);
        queueMicrotask(synchronizeControls);
      });
    }
    if (music && visible && !container.hidden && !document.hidden) requestLyrics();
    setHidden(lyricsPanel, !lyrics && !closingLyrics);
    const lyricMotion = visible && !container.hidden && !document.hidden
      && !matchMedia('(prefers-reduced-motion: reduce)').matches
      && container.closest('.panel')?.getAttribute('data-reduced-motion') !== 'true';
    if (lyrics) {
      const alignmentLabel = track?.approximate ? 'media.approximateLyrics' : track?.alignmentStatus;
      setHidden(approximateLabel, !alignmentLabel);
      setText(approximateLabel, alignmentLabel ? t(alignmentLabel) : '');
      setAttribute(lyricsPanel, 'aria-label', t('media.lyricsPanel'));
      const text = track?.plainLyrics ?? '';
      const plainChanged = plainLyrics.textContent !== text;
      replaceLyricText(plainLyrics, text, lyricMotion);
      setHidden(plainLyrics, !text);
      lyricsPanel.classList.toggle('is-plain', !plainLyrics.hidden);
      if (plainChanged) plainLyrics.scrollTop = 0;
    const message = !track?.lyrics ? t(track?.lyricsStatus === 'loading' || track?.lyricsStatus === 'idle'
      ? 'media.lyricsLoading'
      : track?.lyricsStatus === 'disabled' ? 'media.lyricsLookupOff'
        : track?.lyricsStatus === 'error' ? 'media.lyricsServiceUnavailable'
          : track ? 'media.lyricsUnavailable' : 'media.noSession') : '';
    renderLyrics(track?.trackKey, track?.lyrics ?? null, message, Boolean(plainLyrics.hidden),
      lyricMotion);
    } else {
      renderLyrics.dispose();
      settleLyricText(plainLyrics);
    }
    const nextSubscription = document.hidden ? undefined
      : visible ? widget : mediaVisible ? widgets.find(item => item.id === 'music') : undefined;
    if (subscribed !== nextSubscription) {
      stopWidget?.();
      subscribed = nextSubscription;
      stopWidget = nextSubscription?.subscribe?.(render);
    }
    const now = Date.now();
    const pomodoro = entry ? timerFor(entry) : undefined;
    const secondsRemaining = pomodoro ? secondsLeft(pomodoro, now) : 0;
    const pomodoroRunning = pomodoro?.deadline != null && secondsRemaining > 0;
    const timer = id === 'pomodoro' ? pomodoro : undefined;
    const seconds = timer ? secondsRemaining : 0;
    onProgress?.(progressVisible && pomodoroRunning && entry ? pluginProgress(entry, now) : null);
    setText(titleName, id ? widgetTitle(id) : 'PivO');
    if (renderedIcon !== id) {
      renderedIcon = id;
      titleIcon.textContent = id ? marks[id] ?? '' : '';
    }
    setHidden(titleIcon, !id);
    value.classList.toggle('information', !timer);
    setText(value, track ? track.title || widget?.summary() || '' : timer
      ? Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0')
      : widget?.summary() ?? t('plugins.none'));
    setText(detail, track ? track.error : timer
      ? t(seconds === 0 ? 'plugins.finished' : timer.mode === 'focus' ? 'plugins.focus' : 'plugins.shortBreak')
      : id === 'shelf' ? t('shelf.dropHint') : widget?.detail?.() ?? '');
    setHidden(timerDial, !timer);
    if (timer && entry) {
      const progress = pluginProgress(entry, now) ?? 0;
      const level = String((1 - progress) * 100);
      if (timerDial.style.getPropertyValue('--timer-progress') !== level) timerDial.style.setProperty('--timer-progress', level);
    }
    const previewData = widget?.islandPreview?.();
    taskRows = previewData?.kind === 'todo' ? previewData.items.map(item => item.id) : [];
    const showPreview = previewData && (previewData.kind !== 'list' || previewData.items.length > 0);
    setAttribute(preview, 'data-kind', showPreview ? previewData.kind : '');
    preview.replaceChildren(...(showPreview ? previewNodes(previewData) : []));
    setHidden(value, Boolean(showPreview && (previewData.kind === 'list' || previewData.kind === 'status' || previewData.kind === 'todo')));
    setHidden(detail, track ? !track.error : Boolean(!detail.textContent || (showPreview && previewData.kind === 'week')));
    setHidden(title, Boolean(track));
    setHidden(artwork, !track?.artwork);
    const changedTrack = Boolean(artworkTrack && track?.trackKey && artworkTrack !== track.trackKey);
    artworkTrack = track?.trackKey;
    flipArtwork = Boolean(track) && (changedTrack || flipArtwork);
    if (artwork.getAttribute('src') !== (media?.artwork ?? null)) {
      artwork.getAnimations().forEach(animation => animation.cancel());
      backdrop.style.removeProperty('--track-accent');
      if (media?.artwork) artwork.src = media.artwork;
    } else if (changedTrack && !artwork.hidden && artwork.complete && artwork.naturalWidth) {
      playArtworkFlip();
    }
    setHidden(playback, !visible || document.hidden || !track?.playing);
    card.classList.toggle('is-playing', !playback.hidden);
    if (!media?.artwork) setAttribute(artwork, 'src', null);
    card.classList.toggle('has-artwork', Boolean(track?.artwork));
    card.classList.toggle('has-track', Boolean(track));
    setHidden(artist, !track?.artist);
    setText(artist, track?.artist ?? '');
    setAttribute(value, 'title', value.textContent);
    setAttribute(artist, 'title', artist.textContent);
    setAttribute(detail, 'title', detail.textContent);
    const position = track?.positionMs ?? null;
    const duration = track?.durationMs ?? null;
    const hasTimeline = position !== null && Number.isFinite(position)
      && duration !== null && Number.isFinite(duration) && duration > 0;
    const canSeek = Boolean(hasTimeline && track?.canSeek);
    lyricTargets = canSeek && lyrics && plainLyrics.hidden && duration && track?.lyrics
      ? track.lyrics.map(cue => cue?.text ? cue.timeMs / duration : undefined)
      : [];
    setHidden(timeline, !hasTimeline);
    seek.classList.toggle('seek-enabled', canSeek);
    setAttribute(seek, 'title', canSeek ? t('media.seek') : '');
    setAttribute(progress, 'aria-label', t('media.progress'));
    if (hasTimeline) {
      setText(elapsed, playbackTime(position));
      setText(remaining, '−' + playbackTime(duration - position));
      const fraction = Math.max(0, Math.min(1, position / duration));
      if (progress.value !== fraction) progress.value = fraction;
    }
    setHidden(pageBar, available.length < 2);
    pageDots.forEach((dot, index) => {
      const page = available[index];
      setHidden(dot, !page);
      setText(dot, page ? marks[page] ?? '•' : '');
      setAttribute(dot, 'data-page', page ?? '');
      const label = page ? widgetTitle(page) : '';
      setAttribute(dot, 'title', label);
      setAttribute(dot, 'aria-label', label);
      setAttribute(dot, 'aria-current', page && page === id ? 'page' : null);
    });
    const primary = operation(widget, 'primary');
    const secondary = operation(widget, 'secondary');
    const running = Boolean(timer?.deadline != null && seconds > 0);
    const primaryIcon = timer ? (running ? 'pause' : 'play')
      : music ? (track?.playing ? 'pause' : 'play')
      : id === 'tasks' ? 'add' : primary && id === 'water' ? 'water' : 'open';
    const secondaryIcon = timer ? (timer.mode === 'focus' ? 'break' : 'play')
      : music ? 'lyrics'
      : id === 'tasks' ? 'edit' : !music && secondary ? (id === 'shelf' ? 'remove' : 'undo') : 'settings';
    const primaryLabel = timer ? t(running ? 'plugins.pause' : 'plugins.start')
      : music ? t(track?.playing ? 'media.pause' : 'media.play')
      : id === 'tasks' ? t('personal.add') : (primary ? widget?.primaryLabel?.() : undefined) ?? t('widgets.open');
    const secondaryLabel = timer ? t(timer.mode === 'focus' ? 'plugins.shortBreak' : 'plugins.focus')
      : music ? t(lyrics ? 'media.hideLyrics' : 'media.showLyrics')
      : id === 'tasks' ? t('personal.editTask') : (!music && secondary ? widget?.secondaryLabel?.() : undefined) ?? t('settings.title');
    setIcon(buttons[0]!, music ? 'previous' : 'back', t(music ? 'media.previous' : 'plugins.previous'));
    setIcon(buttons[1]!, music ? 'next' : 'forward', t(music ? 'media.next' : 'plugins.next'));
    setIcon(buttons[2]!, primaryIcon, primaryLabel);
    setIcon(buttons[3]!, secondaryIcon, secondaryLabel);
    setAttribute(buttons[3]!, 'aria-pressed', music ? String(lyrics) : null);
    const musicPaging = music && available.length > 1;
    pageArrows.forEach((arrow, index) => {
      setHidden(arrow, !musicPaging);
      setIcon(arrow, index === 0 ? 'back' : 'forward', t(index === 0 ? 'plugins.previous' : 'plugins.next'));
    });
    mask = (((1 << taskRows.length) - 1) << 14) | (musicPaging ? 3 << 12 : 0) | (available.length > 1 ? ((1 << available.length) - 1) << 4 : 0)
      | (music
        ? (track?.canPrevious ? 1 : 0) | (track?.canNext ? 2 : 0) | (track?.canToggle ? 4 : 0) | 8 | (canSeek ? 1 << 11 : 0)
        : (available.length > 1 ? 3 : 0) | (id ? 4 : 0) | (timer || primary || secondary || (id === 'tasks' && taskRows.length) ? 8 : 0));
    buttons.forEach((button, index) => {
      const enabled = Boolean(mask & (1 << index));
      setHidden(button, !enabled && !music);
      setAttribute(button, 'aria-disabled', String(!enabled));
    });
    const key = JSON.stringify([available, id, mask, lyrics, primaryLabel, secondaryLabel,
      taskRows, widget?.actionKey?.(), timer?.deadline, timer?.mode, track?.trackKey, lyricTargets]);
    if (controlsKey !== key) {
      controlsKey = key;
      revision = (revision + 1) >>> 0;
    }
    setAttribute(card, 'data-widget', id ?? '');
    if (container.dataset.pluginId !== (id ?? '')) {
      container.dataset.pluginId = id ?? '';
      pageChanged?.();
    }
    synchronizeControls();
    if (visible && lyrics && !document.hidden && track?.lyricDelay !== undefined) {
      timeout = setTimeout(render, track.lyricDelay);
    } else if ((visible || progressVisible) && !document.hidden && pomodoroRunning) {
      timeout = setTimeout(render, 1000 - Date.now() % 1000 + 5);
    }
  }

  type NativeAction = { action: string; revision: number; fraction?: number; steps?: number;
    press?: [number, number]; release?: [number, number] };
  async function action(event: NativeAction): Promise<void> {
    if (!visible || disposed || container.hidden) return;
    render();
    const { action } = event;
    const directPage = /^page-([0-6])$/.exec(action);
    const state = loadPlugins();
    const entry = state.entries.find(item => item.enabled);
    const available = pages(Boolean(entry));
    if (event.revision !== revision) {
      // The native width and control revision stay in place until Lyrics finishes closing.
      // Only an unchanged direct page slot can safely reverse that transition.
      const slot = directPage ? Number(directPage[1]) : -1;
      if (!closingLyrics || event.revision !== sentRevision || !available[slot]
        || available[slot] !== sentPages[slot]) return;
    }
    const id = available.includes(selected) ? selected : available[0];
    if (!id) return;
    const wheel = action === 'page-wheel' && Number.isSafeInteger(event.steps) ? event.steps! : 0;
    const pageStep = action === 'page-previous' || (id !== 'music' && action === 'previous') ? -1
      : action === 'page-next' || (id !== 'music' && action === 'next') ? 1 : 0;
    if (directPage || wheel || pageStep) {
      const index = directPage
        ? Number(directPage[1])
        : (available.indexOf(id) + (wheel || pageStep) % available.length + available.length) % available.length;
      const nextPage = available[index];
      if (!nextPage || nextPage === id) return;
      const animate = container.closest('.panel')?.getAttribute('data-reduced-motion') !== 'true';
      const direction = Math.sign(wheel || pageStep || index - available.indexOf(id));
      const currentStyle = animate ? getComputedStyle(card) : undefined;
      const currentTransform = currentStyle?.transform ?? 'none';
      const currentOpacity = currentStyle?.opacity ?? '1';
      const returning = animate
        ? Array.from(container.querySelectorAll<HTMLElement>('.outgoing-widget'))
          .find(element => element.dataset.widget === nextPage)
        : undefined;
      const returningStyle = returning ? getComputedStyle(returning) : undefined;
      const returningTransform = returningStyle?.transform;
      const returningOpacity = returningStyle?.opacity;
      if (returning) {
        returning.getAnimations().forEach(animation => animation.cancel());
        returning.remove();
      }
      card.getAnimations().forEach(animation => animation.cancel());
      const outgoing = animate ? card.cloneNode(true) as HTMLElement : undefined;
      if (outgoing) {
        outgoing.classList.add('outgoing-widget');
        outgoing.setAttribute('aria-hidden', 'true');
        outgoing.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
        card.after(outgoing);
      }
      selected = nextPage;
      localStorage.setItem(selectionKey, selected);
      render();
      if (outgoing) {
        const timing = { duration: 300, easing: 'cubic-bezier(.22,.7,.25,1)' };
        const offset = direction * 32;
        card.animate([{ transform: returningTransform ?? 'translateX(' + offset + 'px)', opacity: returningOpacity ?? 0 },
          { transform: 'none', opacity: 1 }], timing);
        const exit = outgoing.animate([{ transform: currentTransform, opacity: currentOpacity },
          { transform: 'translateX(' + -offset + 'px)', opacity: 0 }], timing);
        void exit.finished.then(() => outgoing.remove(), () => outgoing.remove());
      }
      return;
    }
    if (id === 'music') {
      if (action === 'previous' && (mask & 1)) await mediaAction('previous');
      else if (action === 'next' && (mask & 2)) await mediaAction('next');
      else if (action === 'primary' && (mask & 4)) await mediaAction('toggle');
      else if (action === 'lyrics-wheel' && !lyricsPanel.hidden) {
        (plainLyrics.hidden ? lyricsPanel : plainLyrics).scrollTop += (event.steps ?? 0) * 30;
      }
      else if (action === 'secondary') {
        setShowLyrics(!lyrics);
      }
      else if (action === 'seek' && (mask & (1 << 11)) && Number.isFinite(event.fraction)) await seekMedia(event.fraction!);
      else if (action === 'lyric-seek' && event.press && event.release) {
        const animating = [lyricsPanel, ...lyricLines].some(element =>
          element.getAnimations().some(animation => animation.pending || animation.playState === 'running'));
        if (!animating) {
          const target = lyricSeekTarget(event.press, event.release, lyricsPanel.getBoundingClientRect(),
            lyricLines.map((line, index) => ({ bounds: line.getBoundingClientRect(), target: lyricTargets[index] })));
          if (target !== undefined) await seekMedia(target);
        }
      }
      render();
      return;
    }
    if (id === 'tasks') {
      const row = /^task-([01])$/.exec(action);
      if (row) {
        const task = taskRows[Number(row[1])];
        if (task) toggleTaskDone(task);
      } else if (action === 'primary' || action === 'secondary') {
        await invoke('pivo_open_widget', { widget: id });
      }
      return;
    }
    if (action !== 'primary' && action !== 'secondary') return;
    if (id === 'pomodoro' && entry) {
      entry.timer = timerAction(entry, action, Date.now());
      savePlugins(state);
      return;
    }
    const widget = widgets.find(item => item.id === id);
    const perform = operation(widget, action);
    if (perform) await perform();
    else await invoke('pivo_open_widget', { widget: id });
    render();
  }

  const unsubscribe = subscribePlugins(render);
  const storage = () => render();
  addEventListener('storage', storage);
  let unlisten: (() => void) | undefined;
  void listen<NativeAction>('pivo:plugin-action', event => {
    void action(event.payload).catch(error => console.error('Widget action failed:', error));
  }).then(stop => {
    if (disposed) stop(); else unlisten = stop;
  }).catch(error => console.error('Unable to listen for widget input:', error));
  let unlistenDrag: (() => void) | undefined;
  void listen('pivo:shelf-drag-enter', () => {
    if (disposed || !visible || selected === 'shelf' || !pages(false).includes('shelf')) return;
    selected = 'shelf';
    localStorage.setItem(selectionKey, selected);
    render();
  }).then(stop => {
    if (disposed) stop(); else unlistenDrag = stop;
  }).catch(error => console.error('Unable to listen for Shelf drags:', error));
  render();
  function finishPageMotion(): void {
    renderLyrics.dispose();
    settleLyricText(plainLyrics);
    card.getAnimations().forEach(animation => animation.cancel());
    artwork.getAnimations().forEach(animation => animation.cancel());
    container.querySelectorAll('.outgoing-widget').forEach(element => {
      element.getAnimations().forEach(animation => animation.cancel());
      element.remove();
    });
  }

  return {
    setVisible(next: boolean, showProgress = next, showMedia = showProgress) {
      visible = next;
      progressVisible = showProgress;
      mediaVisible = showMedia;
      if (!next || container.closest('.panel')?.getAttribute('data-reduced-motion') === 'true') {
        finishPageMotion();
      }
      render();
    },
    refreshLocale: render,
    dispose() {
      finishPageMotion();
      backdrop.remove();
      disposed = true;
      clearTimeout(timeout);
      stopWidget?.();
      unsubscribe();
      removeEventListener('storage', storage);
      unlisten?.();
      unlistenDrag?.();
    },
  };
}
