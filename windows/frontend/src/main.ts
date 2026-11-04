import { renderOccasionOutfit } from './presentation/occasion-outfits.ts';
import { settleHolidayAppearance } from './presentation/holiday-appearance.ts';
import { mountMascot } from './presentation/mascot.ts';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { PanelMotion } from './motion/panel.ts';
import { AmbientMotion } from './motion/ambient.ts';
import { mountExpressions } from './motion/expressions.ts';
import { mediaView, requestLyrics, widgets as mediaWidgets } from './widgets/media/index.ts';
import { currentLyricText } from './widgets/media/lyric-rows.ts';
import { mountPluginIsland } from './plugins/island.ts';
import { mountNotices, publishNotice } from './widgets/notice.ts';
import { startPersonalReminders } from './widgets/personal/index.ts';
import { startHudNotices, subscribeHeaderStatus } from './widgets/hud/index.ts';
import { gazeOffset, islandContentOpacity, islandFrame, remainingProgress } from './presentation/island.ts';
import { actionsVisible } from './presentation/controls.ts';
import { clockRefreshDelay } from './presentation/clock.ts';
import { updateText, type UpdateStatus } from './presentation/update.ts';
import { locale, t } from './i18n/index.ts';
import { expandedGesture, playMascotAction, playWidgetReaction } from './motion/widgets.ts';
import { initializePreferences, mascotClothes, mascotProps, preferences } from './preferences/index.ts';
import './style.css';

interface CompanionState {
  expanded: boolean;
  presentation: 'strip' | 'eyes' | 'expanded';
  reducedMotion: boolean;
  visible: boolean;
  manuallyHidden?: boolean;
  transitionId: number;
  uiScale: number;
  canvasScale?: number;
  expandedWidth?: number;
}

function applyUpdate(update: UpdateStatus): void {
  updateState = update;
  cancelUpdateReady();
  const show = !update.deferred && update.message !== 'updates.idle' && update.message !== 'updates.upToDate';
  document.querySelector<HTMLElement>('.updates')!.hidden = !show;
  const primary = show && !update.detail && (update.busy || Boolean(update.version));
  pluginContainer.hidden = primary;
  pluginIsland.setVisible(!document.hidden && state.visible && state.expanded && !primary, progressVisible(), state.visible && !document.hidden);
  document.querySelector<HTMLElement>('.updates')!.classList.toggle('quiet', !primary);
  document.querySelector<HTMLElement>('.update-message')!.textContent = updateText(update);
  // Release notes are untrusted text, never HTML or executable Markdown.
  document.querySelector<HTMLElement>('.update-notes')!.textContent = update.notes.slice(0, 1000);
  document.querySelector<HTMLElement>('.update-notes')!.hidden = !primary;
  document.querySelector<HTMLElement>('.update-actions')!.hidden = !(primary && update.installed && update.version && !update.busy && !update.deferred);
  refreshActionVisibility();
  scheduleUpdateReady();
}

const panel = document.querySelector<HTMLElement>('.panel')!;
const mascotBody = document.querySelector<HTMLElement>('.mascot')!;
mountMascot(mascotBody);
const compactEyes = document.querySelector<HTMLElement>('.eyes')!;
const stripEyes = document.querySelector<HTMLElement>('.mini-eyes')!;
const clocks = [...document.querySelectorAll<HTMLTimeElement>('.clock')];
const date = document.querySelector<HTMLTimeElement>('.header-date')!;
const gaze = document.querySelector<HTMLElement>('.gaze')!;
const pluginContainer = document.querySelector<HTMLElement>('.plugin-island')!;
const statusRings = [...document.querySelectorAll<SVGSVGElement>('.status-ring')];
let pomodoroProgress: number | null = null;
let chargeProgress: number | null = null;

function renderStatusRing(): void {
  const progress = pomodoroProgress ?? chargeProgress;
  for (const ring of statusRings) {
    ring.toggleAttribute('hidden', progress === null);
    if (progress === null) continue;
    ring.dataset.kind = pomodoroProgress === null ? 'charging' : 'pomodoro';
    const arc = ring.querySelector<SVGCircleElement>('.ring-progress')!;
    arc.setAttribute('stroke-dashoffset', String(100 - progress * 100));
    arc.style.visibility = progress > 0 ? 'visible' : 'hidden';
  }
}

function renderPluginProgress(value: number | null): void {
  pomodoroProgress = remainingProgress(value);
  renderStatusRing();
}
const pluginIsland = mountPluginIsland(pluginContainer, renderPluginProgress, () => queueMicrotask(refreshWidgetReaction), requestLyricsWidth);
let noticesReady = false;
let stopHeaderStatus: (() => void) | undefined;
const headerVolume = document.querySelector<HTMLElement>('.header-volume')!;
const headerBattery = document.querySelector<HTMLElement>('.header-battery')!;
const batteryLevel = headerBattery.querySelector('.battery-level')!;
const controlTooltip = document.querySelector<HTMLElement>('.control-tooltip')!;
let tooltipTimer: ReturnType<typeof setTimeout> | undefined;

function showControlFeedback([hovered, pressed]: [number | null, number | null]): void {
  clearTimeout(tooltipTimer);
  controlTooltip.hidden = true;
  let target: HTMLElement | undefined;
  for (const control of panel.querySelectorAll<HTMLElement>('[data-native-action]')) {
    const action = Number(control.dataset.nativeAction);
    control.classList.toggle('is-hovered', hovered === action);
    control.classList.toggle('is-pressed', pressed === action);
    if (hovered === action) target = control;
  }
  if (!target?.title || pressed !== null || !state.expanded) return;
  const anchor = target;
  tooltipTimer = setTimeout(() => {
    if (!anchor.isConnected || !state.expanded) return;
    const bounds = panel.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    const x = (box.left + box.width / 2 - bounds.left) / state.uiScale;
    const y = (box.top - bounds.top) / state.uiScale;
    controlTooltip.style.left = `${Math.max(76, Math.min(404, x))}px`;
    controlTooltip.style.top = `${y < 32 ? y + 25 : y - 20}px`;
    controlTooltip.textContent = anchor.title;
    controlTooltip.hidden = false;
  }, 420);
}
let stopWidgetNotices: (() => void) | undefined;
const motion = new PanelMotion('island');
const tuckMotion = new PanelMotion('island');
const lyricsWidthMotion = new PanelMotion('island');
const noticeWidthMotion = new PanelMotion('island');
const minimalStripMotion = new PanelMotion('island');
let minimalStrip = false;
let nativeMinimalStrip = false;
let compactTargetFrame = 0;
let noticeVisible = false;
const stopNotices = mountNotices(document.querySelector<HTMLElement>('.widget-notice')!, visible => {
  noticeVisible = visible;
  noticeWidthMotion.setExpanded(visible, performance.now(), state.visible && !state.reducedMotion && !preference.matches);
  refreshMinimalStrip(!stripLyric.hidden);
  if (state.visible && !frameRequest) frameRequest = requestAnimationFrame(render);
});
let finishLyricsClose: (() => void) | undefined;

function requestLyricsWidth(open: boolean, complete?: () => void): void {
  finishLyricsClose = complete;
  if (!state.visible || !state.expanded || panel.dataset.reducedMotion === 'true' || (state.expandedWidth ?? 480) <= 480) {
    finishLyricsClose = undefined;
    complete?.();
    return;
  }
  lyricsWidthMotion.setExpanded(open, performance.now(), true);
  if (!frameRequest) frameRequest = requestAnimationFrame(render);
}
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let state: CompanionState = { expanded: false, presentation: 'strip', reducedMotion: false, visible: false, transitionId: 0, uiScale: 1, expandedWidth: 480 };
let updateState: UpdateStatus | undefined;
let updateRequest = 0;
let acknowledgedUpdate = '';
let frameRequest = 0;
let revealRequest = 0;
let acknowledgedTransition: number | undefined;
let nativeTransitionReady: number | undefined;
let nativeUpdateReady: string | undefined;
let clockTimer: ReturnType<typeof setTimeout> | undefined;
let gazeTimer: ReturnType<typeof setTimeout> | undefined;
let stopPlayback: (() => void) | undefined;
const ambient = new AmbientMotion({
  now: () => performance.now(),
  set: (callback, delay) => setTimeout(callback, delay),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout> | undefined),
}, mountExpressions(
  compactEyes,
  document.querySelector<HTMLElement>('.attention-hand')!,
  stripEyes,
));

function centerGaze(): void {
  clearTimeout(gazeTimer);
  gaze.style.setProperty('--gaze-duration', '200ms');
  gaze.style.setProperty('--gaze-x', '0px');
  gaze.style.setProperty('--gaze-y', '0px');
}

const stripLyric = document.querySelector<HTMLElement>('.strip-lyric')!;
const stripLyricText = stripLyric.querySelector('span')!;
const eyesLyric = document.querySelector<HTMLElement>('.eyes-lyric')!;
const eyesLyricText = eyesLyric.querySelector('span')!;
const eyesLyricMotion = new PanelMotion('island');
let stripWidth = 148;
let stripHeight = 34;
let stripTargetWidth = 148;
let stripTargetHeight = 34;
let stripSizeAt = 0;
let stripLyricTimer: ReturnType<typeof setTimeout> | undefined;

function settleCompactLyric(row: HTMLElement, text: HTMLElement): void {
  text.getAnimations().forEach(animation => animation.cancel());
  row.querySelectorAll('.outgoing-strip-line').forEach(element => {
    element.getAnimations().forEach(animation => animation.cancel());
    element.remove();
  });
}

function paintCompactLyric(row: HTMLElement, text: HTMLElement, line: string, reduced: boolean): void {
  if (row.hidden !== !line || (line && text.textContent !== line)) {
    if (line) {
      if (!row.hidden && !reduced) {
        const previous = text.cloneNode(true) as HTMLElement;
        const { opacity, transform } = getComputedStyle(text);
        const distance = Math.max(12, text.offsetHeight);
        previous.classList.add('outgoing-strip-line');
        row.append(previous);
        const timing = { duration: 300, easing: 'cubic-bezier(.22,.7,.35,1)' };
        const exit = previous.animate([
          { opacity, transform },
          { opacity: 0, transform: `translateY(-${distance}px)` },
        ], timing);
        void exit.finished.then(() => previous.remove(), () => previous.remove());
        text.getAnimations().forEach(animation => animation.cancel());
        text.animate([
          { opacity: 0, transform: `translateY(${distance}px)` },
          { opacity: 1, transform: 'translateY(0)' },
        ], timing);
      }
      text.textContent = line;
    }
    row.hidden = !line;
  }
  if (reduced) {
    settleCompactLyric(row, text);
  }
}

function refreshMinimalStrip(hasLyrics: boolean): void {
  const prefs = preferences();
  const next = state.visible && state.presentation === 'strip' && prefs.compactMode === 'auto'
    && prefs.minimalStrip && !hasLyrics && !noticeVisible;
  const now = performance.now();
  minimalStripMotion.setExpanded(next, now, state.visible && !state.reducedMotion && !preference.matches);
  if (minimalStrip !== next) {
    minimalStrip = next;
    if (next) {
      if (compactTargetFrame) cancelAnimationFrame(compactTargetFrame);
      compactTargetFrame = 0;
      nativeMinimalStrip = true;
      void invoke('pivo_compact_target', { minimal: true }).catch(console.error);
    }
    if (state.visible && !frameRequest) frameRequest = requestAnimationFrame(render);
  }
}

function refreshPlayback(): void {
  clearTimeout(stripLyricTimer);
  stripLyricTimer = undefined;
  const active = state.visible && !document.hidden;
  const track = active ? mediaView() : null;
  if (track) requestLyrics(false);
  const playing = String(Boolean(track?.playing));
  if (panel.dataset.playing !== playing) panel.dataset.playing = playing;
  const reduced = state.reducedMotion || preference.matches;
  if (!active) {
    settleCompactLyric(stripLyric, stripLyricText);
    settleCompactLyric(eyesLyric, eyesLyricText);
    if (reduced) eyesLyricMotion.setExpanded(!eyesLyric.hidden, performance.now(), false);
    return;
  }
  const line = currentLyricText(track?.lyrics);
  const stripLine = state.presentation === 'strip' ? line : '';
  const eyesLine = state.presentation === 'eyes' ? line : '';
  const eyesChanged = eyesLyric.hidden !== !eyesLine;
  paintCompactLyric(stripLyric, stripLyricText, stripLine, reduced);
  paintCompactLyric(eyesLyric, eyesLyricText, eyesLine, reduced);
  refreshMinimalStrip(Boolean(stripLine));
  eyesLyricMotion.setExpanded(Boolean(eyesLine), performance.now(), !reduced);
  const lyricText = eyesLine ? eyesLyricText : stripLyricText;
  stripTargetWidth = stripLine || eyesLine ? Math.min(480, Math.max(300, lyricText.scrollWidth + 112)) : 148;
  stripTargetHeight = stripLine || eyesLine ? Math.max(34, lyricText.offsetHeight + 20) : 34;
  if (!frameRequest && (eyesChanged || stripWidth !== stripTargetWidth || stripHeight !== stripTargetHeight)) {
    stripSizeAt = performance.now();
    frameRequest = requestAnimationFrame(render);
  }
  if (state.presentation !== 'expanded' && track?.lyricDelay !== undefined) {
    stripLyricTimer = setTimeout(refreshPlayback, Math.max(16, track.lyricDelay));
  }
}

let reactedWidget = '';
let previousExpandedWidget: string | undefined;
let greetingTimer: ReturnType<typeof setTimeout> | undefined;
let pendingCompactReaction = '';
let widgetReaction: Animation[] = [];
let mascotAction: Animation[] = [];

function stopWidgetReaction(): void {
  for (const animation of widgetReaction) animation.cancel();
  widgetReaction = [];
}

function stopMascotAction(): void {
  clearTimeout(greetingTimer);
  for (const animation of mascotAction) animation.cancel();
  mascotAction = [];
}

function act(action: string): void {
  clearTimeout(greetingTimer);
  mascotAction = playMascotAction(mascotBody, action, mascotAction);
}

const mascotItems = mascotProps.map(prop => ({
  prop,
  element: mascotBody.querySelector<SVGGElement>(`[data-prop="${prop}"]`)!,
}));
const mascotOutfit = mascotClothes.map(prop => ({
  prop,
  element: mascotBody.querySelector<SVGGElement>(`.mascot-${prop}`)!,
}));
const mascotTarget = mascotBody.querySelector<SVGPathElement>('.mascot-target')!;
let mascotHovered = false;

function observeMascotPointer(x: number, y: number, clicked: boolean): void {
  if (panel.dataset.actionsReady !== 'true' || !mascotMotionEnabled()) {
    mascotHovered = false;
    return;
  }
  const { size, centerY } = mascotSizes[preferences().mascotSize];
  const point = new DOMPoint(
    (x - 76 + .4988 * size) * 128 / size,
    (y - centerY + .5571 * size) * 128 / size,
  );
  const hovered = mascotTarget.isPointInFill(point);
  if (clicked && hovered) act('hop');
  else if (hovered !== mascotHovered) act(hovered ? 'curious' : 'blink');
  mascotHovered = hovered;
}
// Center the visible artwork above the page-control row.
const mascotSizes = {
  small: { size: 92, centerY: 75 },
  medium: { size: 112, centerY: 75 },
  large: { size: 126, centerY: 75 },
} as const;

function mascotMotionEnabled(): boolean {
  return preferences().mascotMotion && state.visible && !document.hidden && !state.reducedMotion && !preference.matches;
}

function refreshWidgetReaction(): void {
  const ready = state.visible && state.expanded && panel.dataset.actionsReady === 'true';
  // Equipped props fade with the mascot. Only gestures wait for input readiness.
  const widget = state.visible && !pluginContainer.hidden ? pluginContainer.dataset.pluginId : undefined;
  for (const { prop, element } of mascotItems) {
    element.classList.toggle('mascot-prop-equipped', widget === prop && element.hasAttribute('data-stays'));
  }
  if (!mascotMotionEnabled()) {
    stopWidgetReaction();
    stopMascotAction();
    reactedWidget = '';
    pendingCompactReaction = '';
    return;
  }
  if (state.expanded) {
    if (!ready) return;
    const currentPage = widget ?? 'greeting';
    if (currentPage === reactedWidget) return;
    const action = expandedGesture(previousExpandedWidget, widget);
    reactedWidget = currentPage;
    if (widget) previousExpandedWidget = widget;
    stopWidgetReaction();
    act(action);
    if (action !== 'greeting') {
      greetingTimer = setTimeout(() => {
        if (state.expanded && panel.dataset.actionsReady === 'true'
          && mascotMotionEnabled() && reactedWidget === currentPage) act('greeting');
      }, 12_000);
    }
  } else if (pendingCompactReaction) {
    const now = performance.now();
    if (motion.frame(now).moving || tuckMotion.frame(now).moving) return;
    stopMascotAction();
    widgetReaction = playWidgetReaction(state.presentation === 'strip' ? stripEyes : compactEyes, pendingCompactReaction, widgetReaction);
    pendingCompactReaction = '';
  }
}

function refreshAmbient(): void {
  const { holidayOccasion, holidayVariant } = document.documentElement.dataset;
  renderOccasionOutfit(mascotBody, holidayOccasion, holidayVariant);
  const enabled = mascotMotionEnabled();
  panel.dataset.mascotMotion = String(enabled);
  mascotBody.dataset.hat = String(preferences().mascotHat);
  mascotBody.dataset.scarf = String(preferences().mascotScarf);
  for (const { prop, element } of [...mascotItems, ...mascotOutfit]) {
    element.dataset.skin = preferences().propSkins[prop] ?? 'classic';
  }
  refreshWidgetReaction();
  ambient.setMode(enabled && state.presentation !== 'expanded' ? state.presentation : null);
  if (!enabled || state.presentation !== 'eyes') centerGaze();
  if (state.visible && !document.hidden) {
    stopPlayback ??= mediaWidgets.find(widget => widget.id === 'music')?.subscribe?.(refreshPlayback);
  } else {
    stopPlayback?.();
    stopPlayback = undefined;
  }
  refreshPlayback();
}
tuckMotion.setExpanded(true, 0, false);

function cancelUpdateReady(): void {
  if (updateRequest) cancelAnimationFrame(updateRequest);
  updateRequest = 0;
}

function refreshActionVisibility(reveal = motion.frame(performance.now()).reveal): void {
  const ready = state.visible && state.expanded
    && actionsVisible(reveal, nativeTransitionReady === state.transitionId);
  panel.dataset.actionsReady = String(ready);
  if (!ready) mascotHovered = false;
  refreshWidgetReaction();
  panel.dataset.updateReady = String(ready && updateState !== undefined
    && nativeUpdateReady === `${updateState.revision}:${state.transitionId}`);
}

function progressVisible(): boolean {
  return !document.hidden && state.visible && state.presentation !== 'eyes';
}

function scheduleUpdateReady(): void {
  const update = updateState;
  if (!update || !update.installed || !update.version || update.busy || update.deferred || update.detail
    || !state.visible || !state.expanded || panel.dataset.settled !== 'true'
    || nativeTransitionReady !== state.transitionId || updateRequest) return;
  const transitionId = state.transitionId;
  const revision = update.revision;
  const key = `${revision}:${transitionId}`;
  if (acknowledgedUpdate === key) return;
  const current = () => updateState?.revision === revision && !updateState.detail && state.visible && state.expanded
    && state.transitionId === transitionId && panel.dataset.settled === 'true';
  updateRequest = requestAnimationFrame(() => {
    updateRequest = 0;
    if (!current()) return;
    updateRequest = requestAnimationFrame(() => {
      updateRequest = 0;
      if (!current()) return;
      acknowledgedUpdate = key;
      void invoke<boolean>('pivo_update_revealed', { revision, transitionId }).then(ready => {
        if (current() && ready) nativeUpdateReady = key;
        refreshActionVisibility();
      }).catch(error => {
        if (acknowledgedUpdate === key) acknowledgedUpdate = '';
        console.error('Unable to enable update controls:', error);
      });
    });
  });
}

function render(now: number): void {
  frameRequest = 0;
  const expansion = motion.frame(now);
  const tuck = tuckMotion.frame(now);
  const r = expansion.reveal;
  const lyricsWidth = lyricsWidthMotion.frame(now);
  const eyesText = eyesLyricMotion.frame(now);
  const noticeWidth = noticeWidthMotion.frame(now);
  const mini = minimalStripMotion.frame(now);
  const stripOutOfView = state.presentation !== 'strip' && eyesText.reveal === 0 && (tuck.reveal === 0 || r === 1);
  const resize = state.reducedMotion || preference.matches || stripOutOfView
    ? 1 : 1 - Math.exp(-Math.max(0, now - stripSizeAt) / 100);
  stripSizeAt = now;
  stripWidth += (stripTargetWidth - stripWidth) * resize;
  stripHeight += (stripTargetHeight - stripHeight) * resize;
  if (Math.abs(stripTargetWidth - stripWidth) < 0.25) stripWidth = stripTargetWidth;
  if (Math.abs(stripTargetHeight - stripHeight) < 0.25) stripHeight = stripTargetHeight;
  const moving = expansion.moving || tuck.moving || lyricsWidth.moving || noticeWidth.moving || eyesText.moving || mini.moving
    || stripWidth !== stripTargetWidth || stripHeight !== stripTargetHeight;
  const expandedWidth = 480 + ((state.expandedWidth ?? 480) - 480) * lyricsWidth.reveal;
  const noticeMinimum = 148 + 172 * noticeWidth.reveal;
  const minimumWidth = Math.max(noticeMinimum, 148 + (stripWidth - 148) * eyesText.reveal);
  const minimumHeight = 34 + (stripHeight - 34 + 18) * eyesText.reveal;
  const shape = islandFrame(r, tuck.reveal, expandedWidth, stripWidth, stripHeight, minimumWidth, minimumHeight, mini.reveal, motion.openingSettle(now));
  const { size: expandedMascotSize, centerY: expandedCenterY } = mascotSizes[preferences().mascotSize];
  const imageSize = 145 + (expandedMascotSize - 145) * r;
  const { compactWidth } = shape;
  const centerX = compactWidth / 2 * (1 - r) + 76 * r;
  const centerY = 17 + (expandedCenterY - 17) * r;
  const contentOpacity = islandContentOpacity(r);
  const stripOpacity = contentOpacity.compact * tuck.reveal * Math.max(0, 1 - 2 * mini.reveal);
  const canvasOffset = 240 * ((state.canvasScale ?? state.uiScale) - state.uiScale);
  const nominalWidth = compactWidth + (expandedWidth - compactWidth) * r;
  const panelLeft = canvasOffset + ((480 - compactWidth) * (1 - r) - (shape.width - nominalWidth)) * state.uiScale / 2;
  panel.style.cssText = `--ui-scale:${state.uiScale};--panel-left:${panelLeft}px;--lyrics-reveal:${lyricsWidth.reveal};--expanded-width:${expandedWidth}px;--width:${shape.width}px;--height:${shape.height}px;--lift:${shape.lift}px;`
    + `--image-size:${imageSize}px;--image-x:${centerX - 0.4988 * imageSize}px;`
    + `--image-y:${centerY - 0.5571 * imageSize}px;--reveal:${r};--eye-opacity:${shape.eyeOpacity};`
    + `--eye-x:${centerX}px;--eye-y:${centerY}px;--eye-width:${8 + (73 / 1254 * expandedMascotSize - 8) * r}px;`
    + `--eye-height:${13 + (117 / 1254 * expandedMascotSize - 13) * r}px;`
    + `--eye-spacing:${16 + (138.7 / 1254 * expandedMascotSize - 16) * r}px;`
    + `--strip-opacity:${stripOpacity};--eyes-lyric-opacity:${contentOpacity.compact * (1 - tuck.reveal) * eyesText.reveal};--notice-content-opacity:${Math.max(r, Math.min(1, Math.max(0, (shape.width - 266) / 42)))};`
    + `--content:${contentOpacity.expanded};clip-path:path("${shape.path}");`;
  if (nativeMinimalStrip && !minimalStrip && mini.reveal === 0 && !compactTargetFrame) {
    // Let the full compact silhouette paint before widening its native input target.
    compactTargetFrame = requestAnimationFrame(() => {
      compactTargetFrame = requestAnimationFrame(() => {
        compactTargetFrame = 0;
        if (minimalStrip || minimalStripMotion.frame(performance.now()).reveal !== 0) return;
        nativeMinimalStrip = false;
        void invoke('pivo_compact_target', { minimal: false }).catch(console.error);
      });
    });
  }
  panel.dataset.settled = String(!moving && r === 1);
  panel.toggleAttribute('data-strip-painted', state.visible && stripOpacity > 0);
  panel.toggleAttribute('data-header-painted', state.visible && contentOpacity.expanded > 0);
  refreshActionVisibility(r);
  if (moving && (state.visible || state.manuallyHidden)) {
    frameRequest = requestAnimationFrame(render);
  } else if (!moving && state.visible
    && acknowledgedTransition !== state.transitionId && !revealRequest) {
    const transitionId = state.transitionId;
    const presentation = state.presentation;
    // Two callbacks also allow a paint when reduced motion reached the endpoint outside rAF.
    revealRequest = requestAnimationFrame(() => {
      if (!state.visible || state.presentation !== presentation || state.transitionId !== transitionId) {
        revealRequest = 0;
        return;
      }
      revealRequest = requestAnimationFrame(() => {
        revealRequest = 0;
        if (!state.visible || state.presentation !== presentation || state.transitionId !== transitionId) return;
        acknowledgedTransition = transitionId;
        void invoke<boolean>('pivo_presented', { transitionId, presentation }).then(ready => {
          if (ready && state.visible && state.transitionId === transitionId && state.presentation === presentation) {
            nativeTransitionReady = transitionId;
          }
          refreshActionVisibility();
          scheduleUpdateReady();
        }).catch(error => {
          if (acknowledgedTransition === transitionId) acknowledgedTransition = undefined;
          console.error('Unable to enable panel controls:', error);
        });
      });
    });
  }
  if (!lyricsWidth.moving && finishLyricsClose) {
    const finish = finishLyricsClose;
    finishLyricsClose = undefined;
    finish();
  }
  scheduleUpdateReady();
}

function refreshClock(): void {
  clearTimeout(clockTimer);
  const now = new Date();
  const time = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  for (const clock of clocks) {
    clock.textContent = time;
    clock.dateTime = now.toISOString();
  }
  date.textContent = new Intl.DateTimeFormat(locale(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).format(now);
  date.dateTime = now.toISOString();
  const delay = clockRefreshDelay(now, state.visible, document.hidden, state.presentation);
  if (delay !== undefined) clockTimer = setTimeout(refreshClock, delay);
}

function applyState(next: CompanionState): void {
  cancelUpdateReady();
  const wasVisible = state.visible;
  const wasManuallyHidden = state.manuallyHidden;
  const wasExpanded = state.expanded;
  if (!next.visible || next.transitionId !== state.transitionId) {
    nativeTransitionReady = undefined;
    nativeUpdateReady = undefined;
  }
  if (state.expanded !== next.expanded) {
    stopWidgetReaction();
    stopMascotAction();
    reactedWidget = '';
    pendingCompactReaction = !next.expanded ? pluginContainer.dataset.pluginId ?? '' : '';
  }
  state = next;
  if (!next.visible || !next.expanded) showControlFeedback([null, null]);
  const reduced = next.reducedMotion || preference.matches;
  panel.dataset.expanded = String(next.expanded);
  panel.dataset.visible = String(next.visible);
  panel.toggleAttribute('data-manually-hidden', Boolean(next.manuallyHidden));
  panel.dataset.reducedMotion = String(reduced);
  if (reduced) settleHolidayAppearance();
  if (revealRequest) cancelAnimationFrame(revealRequest);
  revealRequest = 0;
  const now = performance.now();
  const animate = !reduced && (wasVisible || Boolean(wasManuallyHidden))
    && (next.visible || Boolean(next.manuallyHidden));
  noticeWidthMotion.setExpanded(noticeVisible, now, animate);
  const wide = (next.expandedWidth ?? 480) > 480;
  lyricsWidthMotion.setExpanded(wide && !finishLyricsClose, now, animate && wasExpanded && next.expanded && wide);
  motion.setExpanded(next.expanded, now, animate);
  tuckMotion.setExpanded((!next.visible && !next.manuallyHidden) || next.presentation === 'strip', now, animate);
  if (animate) {
    if (!frameRequest) frameRequest = requestAnimationFrame(render);
  } else {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    render(now);
  }
  refreshClock();
  refreshAmbient();
  refreshWidgetNotices();
  pluginIsland.setVisible(!document.hidden && next.visible && next.expanded && !pluginContainer.hidden, progressVisible(), next.visible && !document.hidden);
}

function refreshWidgetNotices(): void {
  if (noticesReady && progressVisible()) {
    stopHeaderStatus ??= subscribeHeaderStatus(status => {
      chargeProgress = status?.charging ? (status.battery ?? 100) / 100 : null;
      renderStatusRing();
      headerVolume.hidden = status?.volume == null;
      headerBattery.hidden = status?.battery == null;
      if (status?.volume != null) {
        headerVolume.dataset.muted = String(Boolean(status.muted));
        headerVolume.setAttribute('aria-label', `${t('hud.volume')}: ${status.muted ? t('hud.muted') : t('hud.percent', { value: status.volume })}`);
      }
      if (status?.battery != null) {
        batteryLevel.setAttribute('width', String(status.battery / 10));
        headerBattery.setAttribute('aria-label', `${t('hud.battery')}: ${t(status.pluggedIn ? 'hud.pluggedPercent' : 'hud.percent', { value: status.battery })}`);
      }
    });
  } else {
    stopHeaderStatus?.();
    stopHeaderStatus = undefined;
    chargeProgress = null;
    renderStatusRing();
  }
  if (noticesReady && state.visible && !document.hidden) {
    if (!stopWidgetNotices) {
      const stopReminders = startPersonalReminders(publishNotice);
      const stopHud = startHudNotices();
      stopWidgetNotices = () => { stopReminders(); stopHud(); };
    }
  } else {
    stopWidgetNotices?.();
    stopWidgetNotices = undefined;
  }
}

preference.addEventListener('change', () => applyState(state));
document.addEventListener('visibilitychange', () => {
  refreshClock();
  refreshAmbient();
  refreshWidgetNotices();
  pluginIsland.setVisible(!document.hidden && state.visible && state.expanded && !pluginContainer.hidden, progressVisible(), state.visible && !document.hidden);
});
window.addEventListener('pagehide', () => {
  if (compactTargetFrame) cancelAnimationFrame(compactTargetFrame);
  clearTimeout(stripLyricTimer);
  stripLyricTimer = undefined;
  settleCompactLyric(stripLyric, stripLyricText);
  settleCompactLyric(eyesLyric, eyesLyricText);
  stopMascotAction();
  clearTimeout(tooltipTimer);
  ambient.setMode(null);
  stopWidgetReaction();
  clearTimeout(gazeTimer);
  stopPlayback?.();
  stopPlayback = undefined;
  panel.dataset.playing = 'false';
  pluginIsland.dispose();
  stopNotices();
  noticesReady = false;
  refreshWidgetNotices();
  clearTimeout(clockTimer);
});

async function start(): Promise<void> {
  await initializePreferences(() => {
    applyState(state);
    pluginIsland.refreshLocale();
    if (updateState) applyUpdate(updateState);
  });
  let receivedState = false;
  await listen<[number, number, boolean]>('pivo:mascot-pointer', event => observeMascotPointer(...event.payload));
  await listen<[number | null, number | null]>('pivo:control-feedback', event => showControlFeedback(event.payload));
  await listen<boolean>('pivo:page-bar-hover', event => {
    panel.dataset.widgetPagesHover = String(event.payload);
  });
  await listen<[number, number]>('pivo:gaze', event => {
    if (state.presentation !== 'eyes' || !mascotMotionEnabled()) return;
    ambient.activity();
    const x = gazeOffset(event.payload[0]);
    const y = gazeOffset(event.payload[1]);
    gaze.style.setProperty('--gaze-duration', '140ms');
    gaze.style.setProperty('--gaze-x', `${x}px`);
    gaze.style.setProperty('--gaze-y', `${y * (y > 0 ? .45 : .8)}px`);
    clearTimeout(gazeTimer);
    gazeTimer = setTimeout(centerGaze, 850);
  });
  await listen<CompanionState>('pivo:state', event => {
    receivedState = true;
    applyState(event.payload);
  });
  let receivedUpdate = false;
  await listen<UpdateStatus>('pivo:update', event => {
    receivedUpdate = true;
    applyUpdate(event.payload);
  });
  const update = await invoke<UpdateStatus>('pivo_update_status');
  if (!receivedUpdate) applyUpdate(update);
  const initial = await invoke<CompanionState>('pivo_ready');
  if (!receivedState) applyState(initial);
  noticesReady = true;
  refreshWidgetNotices();
}

render(0);
void start().catch(error => {
  console.error('Unable to start PivO:', error);
});
