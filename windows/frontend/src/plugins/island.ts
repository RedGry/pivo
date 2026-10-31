import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { locale, t } from '../i18n/index.ts';
import { informationText, localized, pluginProgress, secondsLeft, timerAction, timerActionCancels, timerFor } from './model.ts';
import { loadPlugins, savePlugins, subscribePlugins } from './store.ts';
import { createPluginIcon } from './icon-view.ts';
import './style.css';

export function mountPluginIsland(
  container: HTMLElement,
  onProgress?: (value: number | null) => void,
  onTimerCancelled?: () => void,
  onTimerStarted?: () => void,
  onTimerCompleted?: () => void,
  onTimerPaused?: () => void,
  onBreakStarted?: () => void,
  onFocusRunning?: (running: boolean) => void,
): {
  setVisible(visible: boolean, progressVisible?: boolean): void; refreshLocale(): void; dispose(): void;
} {
  let visible = false;
  let progressVisible = false;
  let disposed = false;
  let nativeEnabled: boolean | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let connected = false;
  let reportedFocus: boolean | undefined;
  const observedCountdowns = new Map<string, number>();
  const title = document.createElement('h2');
  title.className = 'plugin-title';
  const titleIcon = document.createElement('span');
  const titleName = document.createElement('span');
  title.append(titleIcon, titleName);
  let renderedIcon = '';
  const value = document.createElement('div');
  const detail = document.createElement('div');
  const controls = document.createElement('div');
  controls.className = 'plugin-controls';
  // Native controls capture input; this DOM is presentation only.
  const buttons = Array.from({ length: 4 }, () => { const item = document.createElement('span'); controls.append(item); return item; });
  for (const [index, points] of [[0, '8,2 4,6 8,10'], [3, '4,2 8,6 4,10']] as const) {
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 12 12');
    arrow.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points);
    arrow.append(line);
    buttons[index]!.append(arrow);
  }
  value.className = 'plugin-value';
  detail.className = 'plugin-detail';
  container.classList.add('plugin-island');
  container.replaceChildren(title, value, detail, controls);
  function render(): void {
    clearTimeout(timeout);
    if (disposed) return;
    const state = loadPlugins();
    const entries = state.entries.filter(item => item.enabled);
    const entry = entries.find(item => item.manifest.id === state.selected) ?? entries[0];
    const enabled = Boolean(entry);
    const focusTimer = entry?.manifest.kind === 'timer' ? timerFor(entry) : undefined;
    const focusRunning = Boolean(focusTimer?.mode === 'focus' && focusTimer.deadline !== null && secondsLeft(focusTimer, Date.now()) > 0);
    // Start reporting on the first visibility update, after composition has finished.
    if (connected && focusRunning !== reportedFocus) {
      reportedFocus = focusRunning;
      onFocusRunning?.(focusRunning);
    }
    onProgress?.(entry ? pluginProgress(entry, Date.now()) : null);
    if (nativeEnabled !== enabled) {
      nativeEnabled = enabled;
      void invoke('pivo_plugin_controls', { enabled }).catch(error => {
        nativeEnabled = undefined;
        console.error('Unable to update plugin controls:', error);
      });
    }
    controls.hidden = !enabled;
    titleName.textContent = entry ? localized(entry.manifest.name, locale()) : 'PivO';
    titleIcon.hidden = !entry;
    const icon = entry?.manifest.icon;
    const iconKey = `${entry?.manifest.kind ?? 'information'}:${icon?.type ?? ''}:${icon?.type === 'png' ? icon.data : icon?.value ?? ''}`;
    if (iconKey !== renderedIcon) {
      titleIcon.replaceChildren(createPluginIcon(icon, entry?.manifest.kind ?? 'information'));
      renderedIcon = iconKey;
    }
    buttons[0]!.title = t('plugins.previous');
    buttons[3]!.title = t('plugins.next');
    buttons[1]!.textContent = t('plugins.next');
    buttons[2]!.textContent = t('plugins.reset');
    value.classList.toggle('information', entry?.manifest.kind !== 'timer');
    if (entry?.manifest.kind === 'timer') {
      const timer = timerFor(entry);
      const seconds = secondsLeft(timer, Date.now());
      if (timer.deadline === null) observedCountdowns.delete(entry.manifest.id);
      else if (seconds > 0) observedCountdowns.set(entry.manifest.id, timer.deadline);
      else if (observedCountdowns.get(entry.manifest.id) === timer.deadline) {
        observedCountdowns.delete(entry.manifest.id);
        onTimerCompleted?.();
      }
      value.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
      detail.textContent = seconds === 0 ? t('plugins.finished') : t(timer.mode === 'focus' ? 'plugins.focus' : 'plugins.shortBreak');
      buttons[1]!.textContent = t(timer.deadline !== null && seconds > 0 ? 'plugins.pause' : 'plugins.start');
      buttons[2]!.textContent = t(timer.mode === 'focus' ? 'plugins.shortBreak' : 'plugins.focus');
      if ((visible || progressVisible) && !document.hidden && timer.deadline !== null && seconds > 0) timeout = setTimeout(render, 1000 - Date.now() % 1000 + 5);
    } else {
      value.textContent = entry ? informationText(entry, locale()) : t('plugins.none');
      detail.textContent = '';
    }
    container.dataset.pluginId = entry?.manifest.id ?? '';
  }
  function action(action: string): void {
    if (!visible || disposed || container.hidden) return;
    const state = loadPlugins();
    const entries = state.entries.filter(item => item.enabled);
    const index = Math.max(0, entries.findIndex(item => item.manifest.id === state.selected));
    const entry = entries[index];
    if (!entry) return;
    const now = Date.now();
    const cancelled = timerActionCancels(entry, action, now);
    const before = entry.manifest.kind === 'timer' ? timerFor(entry) : undefined;
    let started = false;
    let breakStarted = false;
    let paused = false;
    if (action === 'previous' || action === 'next' || (action === 'primary' && entry.manifest.kind === 'information')) {
      state.selected = entries[(index + (action === 'previous' ? -1 : 1) + entries.length) % entries.length]!.manifest.id;
    } else if (entry.manifest.kind === 'timer' && (action === 'primary' || action === 'secondary')) {
      entry.timer = timerAction(entry, action, now);
      started = action === 'primary' && entry.timer.mode === 'focus' && entry.timer.deadline !== null;
      breakStarted = action === 'primary' && entry.timer.mode === 'break' && entry.timer.deadline !== null;
      paused = action === 'primary' && before?.deadline !== null && entry.timer.deadline === null;
    } else if (action === 'secondary') state.selected = entries[0]!.manifest.id;
    else return;
    try {
      savePlugins(state);
      if (cancelled) onTimerCancelled?.();
      if (started) onTimerStarted?.();
      if (paused) onTimerPaused?.();
      if (breakStarted) onBreakStarted?.();
    } catch (error) { console.error('Unable to save plugin action:', error); }
  }
  const unsubscribe = subscribePlugins(render);
  let unlisten: (() => void) | undefined;
  void listen<string>('pivo:plugin-action', event => action(event.payload)).then(stop => {
    if (disposed) stop(); else unlisten = stop;
  }).catch(error => console.error('Unable to listen for plugin input:', error));
  render();
  return {
    setVisible(next, showProgress = next) { connected = true; visible = next; progressVisible = showProgress; render(); },
    refreshLocale: render,
    dispose() { disposed = true; clearTimeout(timeout); unsubscribe(); unlisten?.(); },
  };
}
