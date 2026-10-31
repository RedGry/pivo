import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import mascotUrl from '../../../assets/mascot.png';
import { PanelMotion } from './motion/panel.ts';
import { AmbientMotion, type Gesture } from './motion/ambient.ts';
import { mountObsession } from './presentation/obsession.ts';
import { mountPluginIsland } from './plugins/island.ts';
import { gazeOffset, islandFrame, remainingProgress } from './presentation/island.ts';
import { actionsVisible } from './presentation/controls.ts';
import { clockRefreshDelay } from './presentation/clock.ts';
import { updateText, type UpdateStatus } from './presentation/update.ts';
import { locale, t } from './i18n/index.ts';
import { initializePreferences, preferences } from './preferences/index.ts';
import './style.css';

interface CompanionState {
  expanded: boolean;
  presentation: 'strip' | 'eyes' | 'expanded';
  reducedMotion: boolean;
  visible: boolean;
  transitionId: number;
}

function applyUpdate(update: UpdateStatus): void {
  updateState = update;
  cancelUpdateReady();
  const show = !update.deferred && update.message !== 'updates.idle';
  document.querySelector<HTMLElement>('.updates')!.hidden = !show;
  const primary = show && !update.detail && (update.busy || Boolean(update.version));
  pluginContainer.hidden = primary;
  pluginIsland.setVisible(!document.hidden && state.visible && state.expanded && !primary, progressVisible());
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
const mascot = document.querySelector<HTMLImageElement>('.mascot img')!;
const clocks = [...document.querySelectorAll<HTMLTimeElement>('.clock')];
const date = document.querySelector<HTMLTimeElement>('.header-date')!;
const gaze = document.querySelector<HTMLElement>('.gaze')!;
const pluginContainer = document.querySelector<HTMLElement>('.plugin-island')!;
const statusRings = [...document.querySelectorAll<SVGSVGElement>('.status-ring')];
function renderPluginProgress(value: number | null): void {
  const progress = remainingProgress(value);
  for (const ring of statusRings) {
    ring.toggleAttribute('hidden', progress === null);
    const arc = ring.querySelector<SVGPathElement>('.ring-progress')!;
    arc.setAttribute('stroke-dashoffset', String(100 - (progress ?? 0) * 100));
    arc.style.visibility = progress !== null && progress > 0 ? 'visible' : 'hidden';
  }
}
const motion = new PanelMotion();
const tuckMotion = new PanelMotion();
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let state: CompanionState = { expanded: false, presentation: 'strip', reducedMotion: false, visible: false, transitionId: 0 };
let updateState: UpdateStatus | undefined;
let updateRequest = 0;
let acknowledgedUpdate = '';
let frameRequest = 0;
let revealRequest = 0;
let acknowledgedTransition: number | undefined;
let nativeTransitionReady: number | undefined;
let nativeUpdateReady: string | undefined;
let clockTimer: ReturnType<typeof setTimeout> | undefined;
mascot.src = mascotUrl;
document.querySelector<HTMLImageElement>('.reminder img')!.src = mascotUrl;
let gestures: Animation[] = [];
function animateGesture(gesture: Gesture | null): void {
  for (const animation of gestures) animation.cancel();
  gestures = [];
  if (gesture && obsession.ownsEyes) return;
  const animate = (selector: string, frames: Keyframe[], duration: number) => {
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      gestures.push(element.animate(frames, { duration, easing: 'ease-in-out' }));
    }
  };
  if (gesture === 'blink') animate('.eyes i', [
    { transform: 'translate(-50%, -50%) scaleY(1)' },
    { transform: 'translate(-50%, -50%) scaleY(0.08)', offset: 0.45 },
    { transform: 'translate(-50%, -50%) scaleY(1)' },
  ], 180);
  if (gesture === 'curious') animate('.eyes', [
    { transform: 'translateX(0)' }, { transform: 'translateX(3px)', offset: 0.25 },
    { transform: 'translateX(3px)', offset: 0.7 }, { transform: 'translateX(0)' },
  ], 1400);
  if (gesture === 'peek') animate('.reminder', [
    { opacity: 0, transform: 'translateY(22px) rotate(0deg)' },
    { opacity: 1, transform: 'translateY(0) rotate(-9deg)', offset: 0.25 },
    { opacity: 1, transform: 'translateY(0) rotate(9deg)', offset: 0.5 },
    { opacity: 1, transform: 'translateY(0) rotate(-4deg)', offset: 0.75 },
    { opacity: 0, transform: 'translateY(22px) rotate(0deg)' },
  ], 2200);
}
const ambient = new AmbientMotion({
  set: (callback, delay) => setTimeout(callback, delay),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout> | undefined),
}, animateGesture);
const obsession = mountObsession(panel, mascot, t, syncAmbient);
const pluginIsland = mountPluginIsland(pluginContainer, renderPluginProgress,
  () => obsession.timerCancelled(), () => obsession.timerStarted(),
  () => obsession.timerCompleted(), () => obsession.timerPaused(), () => obsession.timerBreakStarted(),
  running => obsession.setFocusRunning(running));
function syncAmbient(): void {
  ambient.setMode(state.visible && !document.hidden && !state.reducedMotion && !preference.matches
    && !preferences().obsession && !obsession.ownsEyes
    && state.presentation !== 'expanded' ? state.presentation : null);
  if (!state.visible || document.hidden || state.presentation !== 'eyes' || state.reducedMotion || preference.matches
    || obsession.ownsEyes) {
    gaze.style.setProperty('--gaze-x', '0px');
    gaze.style.setProperty('--gaze-y', '0px');
  }
}
function refreshAmbient(): void {
  obsession.setActivity(preferences().obsessionActivity);
  obsession.setState({
    enabled: preferences().obsession,
    visible: state.visible && !document.hidden,
    reducedMotion: state.reducedMotion || preference.matches,
    presentation: state.presentation,
    transitionId: state.transitionId,
  });
  syncAmbient();
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
  const moving = expansion.moving || tuck.moving;
  const shape = islandFrame(r, tuck.reveal);
  const imageSize = 163 - 13 * r;
  const centerX = 90 + 23.75 * r;
  const centerY = 20 + 64 * r;
  const fade = Math.max(0, Math.min(1, (r - 0.6) / 0.4));
  panel.style.cssText = `--width:${shape.width}px;--height:${shape.height}px;--lift:${shape.lift}px;`
    + `--image-size:${imageSize}px;--image-x:${centerX - 0.4988 * imageSize}px;`
    + `--image-y:${centerY - 0.5571 * imageSize}px;--reveal:${r};--eye-opacity:${shape.eyeOpacity};`
    + `--eye-x:${centerX}px;--eye-y:${centerY}px;--eye-width:${9.5 + (73 / 1254 * 150 - 9.5) * r}px;`
    + `--eye-height:${15.5 + (117 / 1254 * 150 - 15.5) * r}px;`
    + `--eye-spacing:${18 + (138.7 / 1254 * 150 - 18) * r}px;`
    + `--strip-opacity:${(1 - r) * tuck.reveal};`
    + `--content:${fade * fade * (3 - 2 * fade)};`;
  panel.style.clipPath = `path("${shape.path}")`;
  panel.dataset.settled = String(!moving && r === 1);
  refreshActionVisibility(r);
  if (moving && state.visible) {
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
  obsession.clockChanged(String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0'));
  date.textContent = new Intl.DateTimeFormat(locale(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).format(now);
  date.dateTime = now.toISOString();
  const delay = clockRefreshDelay(now, state.visible, document.hidden, state.presentation);
  if (delay !== undefined) clockTimer = setTimeout(refreshClock, delay);
}

function applyState(next: CompanionState): void {
  cancelUpdateReady();
  const wasVisible = state.visible;
  if (!next.visible || next.transitionId !== state.transitionId) {
    nativeTransitionReady = undefined;
    nativeUpdateReady = undefined;
  }
  state = next;
  const reduced = next.reducedMotion || preference.matches;
  panel.dataset.expanded = String(next.expanded);
  panel.dataset.visible = String(next.visible);
  panel.dataset.reducedMotion = String(reduced);
  if (frameRequest) cancelAnimationFrame(frameRequest);
  if (revealRequest) cancelAnimationFrame(revealRequest);
  revealRequest = 0;
  const now = performance.now();
  const animate = !reduced && next.visible && wasVisible;
  motion.setExpanded(next.expanded, now, animate);
  tuckMotion.setExpanded(!next.visible || next.presentation === 'strip', now, animate);
  render(performance.now());
  refreshAmbient();
  refreshClock();
  pluginIsland.setVisible(!document.hidden && next.visible && next.expanded && !pluginContainer.hidden, progressVisible());
}

preference.addEventListener('change', () => applyState(state));
document.addEventListener('visibilitychange', () => {
  refreshAmbient();
  refreshClock();
  pluginIsland.setVisible(!document.hidden && state.visible && state.expanded && !pluginContainer.hidden, progressVisible());
});
window.addEventListener('pagehide', () => {
  obsession.dispose();
  ambient.setMode(null);
  pluginIsland.dispose();
  clearTimeout(clockTimer);
});

async function start(): Promise<void> {
  await mascot.decode();
  await initializePreferences(() => {
    refreshAmbient();
    refreshClock();
    pluginIsland.refreshLocale();
    obsession.refreshLocale();
    if (updateState) applyUpdate(updateState);
  });
  let receivedState = false;
  await listen<[number, number]>('pivo:gaze', event => {
    if (!state.visible || document.hidden || state.presentation !== 'eyes' || state.reducedMotion || preference.matches
      || obsession.ownsEyes) return;
    gaze.style.setProperty('--gaze-x', `${gazeOffset(event.payload[0])}px`);
    gaze.style.setProperty('--gaze-y', `${gazeOffset(event.payload[1])}px`);
  });
  await listen<{ target: 'mascot' | 'clock' | 'none'; x: number; y: number; transitionId: number }>('pivo:companion-pointer', event => {
    if (event.payload.transitionId !== state.transitionId) return;
    const pointer = event.payload;
    const origin = panel.getBoundingClientRect();
    const clock = document.querySelector<HTMLElement>('.header-status .clock')!.getBoundingClientRect();
    const overClock = pointer.x >= clock.left - origin.left && pointer.x < clock.right - origin.left
      && pointer.y >= clock.top - origin.top && pointer.y < clock.bottom - origin.top;
    obsession.pointer({ ...pointer, target: overClock ? 'clock' : pointer.target === 'clock' ? 'none' : pointer.target });
  });
  await listen('pivo:resume', () => obsession.resume());
  await listen<{ x: number; y: number; transitionId: number }>('pivo:companion-double-click', event => {
    if (event.payload.transitionId !== state.transitionId) return;
    obsession.doubleClick(event.payload);
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
}

render(0);
void start().catch(error => {
  console.error('Unable to start PivO:', error);
});
