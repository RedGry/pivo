import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { locale, t } from '../../i18n/index.ts';
import { publishNotice } from '../notice.ts';
import './style.css';

interface Snapshot {
  volume: number | null;
  muted: boolean | null;
  brightness: number | null;
  capsLock: boolean | null;
  language: string | null;
  battery: number | null;
  pluggedIn: boolean | null;
  charging: boolean;
  wifi: boolean | null;
  headset: boolean | null;
}

const items = ['volume', 'brightness', 'capsLock', 'language', 'battery', 'wifi', 'headset'] as const;
type Item = typeof items[number];
const preferenceKey = 'pivo.hud.alerts.v2';
const listeners = new Map<() => void, boolean>();
let snapshot: Snapshot | null = null;
let monitorNotices = false;
let alerts = readAlerts();
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;
let refreshQueued = false;
let latestVolume: { volume: number; muted: boolean } | undefined;
let latestPower: Pick<Snapshot, 'battery' | 'pluggedIn' | 'charging'> | undefined;

const nativeListeners = [
  listen('pivo:hud-changed', () => schedule()),
  listen<[number | null, boolean | null, boolean]>('pivo:power', ({ payload: [battery, pluggedIn, charging] }) => {
    if (!needed()) return;
    latestPower = { battery, pluggedIn, charging };
    if (snapshot) commit({ ...snapshot, ...latestPower });
    else schedule();
  }),
  listen<[number, boolean]>('pivo:volume', ({ payload: [volume, muted] }) => {
    if (!needed()) return;
    latestVolume = { volume, muted };
    if (snapshot) commit({ ...snapshot, ...latestVolume });
    else schedule();
  }),
];
window.addEventListener('pagehide', () => {
  for (const listener of nativeListeners) void listener.then(stop => stop(), console.error);
}, { once: true });

function readAlerts(): Set<Item> {
  try {
    const saved = localStorage.getItem(preferenceKey);
    const legacy = saved === null ? localStorage.getItem('pivo.hud.alerts') : null;
    if (saved === null && legacy === null) return new Set(['language', 'capsLock']);
    const stored: unknown = JSON.parse(saved ?? legacy!);
    const enabled = new Set(items.filter(item => Array.isArray(stored) && stored.includes(item)));
    if (saved === null) enabled.add('capsLock');
    return enabled;
  } catch {
    return new Set();
  }
}

function needed(): boolean {
  return !document.hidden && (listeners.size > 0 || (monitorNotices && alerts.size > 0));
}

function languageName(tag: string): string {
  try { return new Intl.DisplayNames([locale()], { type: 'language' }).of(tag.replaceAll('_', '-')) ?? tag; }
  catch { return tag; }
}

function schedule(eventOrImmediate: Event | boolean = true): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  if (!needed()) {
    snapshot = null;
    latestVolume = undefined;
    latestPower = undefined;
    refreshQueued = false;
  } else if (inFlight) {
    refreshQueued ||= eventOrImmediate !== false;
  } else if (eventOrImmediate === false) {
    timer = setTimeout(() => void poll(), 2000);
  } else {
    void poll();
  }
}

function value(item: Item, state = snapshot): string {
  const reading = state?.[item];
  if (reading == null) return t('hud.unavailable');
  switch (item) {
    case 'volume':
      return state?.muted ? t('hud.muted') : t('hud.percent', { value: Number(reading) });
    case 'brightness':
      return t('hud.percent', { value: Number(reading) });
    case 'capsLock':
      return t(reading ? 'hud.on' : 'hud.off');
    case 'language':
      return languageName(String(reading));
    case 'battery':
      return t(state?.pluggedIn ? 'hud.pluggedPercent' : 'hud.percent', { value: Number(reading) });
    case 'wifi':
    case 'headset':
      return t(reading ? 'hud.connected' : 'hud.disconnected');
  }
}

function changed(item: Item, old: Snapshot, next: Snapshot): boolean {
  if (old[item] === null || next[item] === null) return false;
  if (item === 'battery') {
    return old.pluggedIn !== next.pluggedIn || (Number(old.battery) > 20 && Number(next.battery) <= 20);
  }
  return old[item] !== next[item] || (item === 'volume' && old.muted !== next.muted);
}

function commit(next: Snapshot): void {
  const old = snapshot;
  snapshot = next;
  for (const listener of listeners.keys()) listener();
  if (!monitorNotices || !old) return;
  const entries = items.filter(item => item !== 'language' && item !== 'capsLock' && alerts.has(item) && changed(item, old, next)).map(item => ({
    kind: item,
    text: t('hud.notice', { indicator: t(`hud.${item}`), value: value(item, next) }),
    level: item === 'volume' && next.muted ? 0
      : typeof next[item] === 'number' ? Number(next[item]) : undefined,
  }));
  if (entries.length) publishNotice(...entries);
}

async function poll(): Promise<void> {
  timer = undefined;
  if (!needed() || inFlight) return;
  inFlight = true;
  const volumeAtStart = latestVolume;
  const powerAtStart = latestPower;
  try {
    const next = await invoke<Snapshot>('pivo_hud_snapshot', {
      readBrightness: [...listeners.values()].includes(true) || alerts.has('brightness'),
    });
    if (!needed()) return;
    commit({
      ...next,
      ...(volumeAtStart !== latestVolume ? latestVolume : undefined),
      ...(powerAtStart !== latestPower ? latestPower : undefined),
    });
  } catch {
    if (snapshot === null) for (const listener of listeners.keys()) listener();
  } finally {
    inFlight = false;
    const immediate = refreshQueued;
    refreshQueued = false;
    schedule(immediate);
  }
}

function subscribe(refresh: () => void, readBrightness = true): () => void {
  listeners.set(refresh, readBrightness);
  document.addEventListener('visibilitychange', schedule);
  schedule();
  return () => {
    listeners.delete(refresh);
    if (listeners.size === 0 && !monitorNotices) document.removeEventListener('visibilitychange', schedule);
    schedule();
  };
}

export function subscribeHeaderStatus(refresh: (status: Snapshot | null) => void): () => void {
  refresh(snapshot);
  return subscribe(() => refresh(snapshot), false);
}

export function startHudNotices(): () => void {
  monitorNotices = true;
  let keyboardTimer: ReturnType<typeof setTimeout> | undefined;
  let previousLanguage: string | null = null;
  let previousCaps: boolean | null = null;
  let keyboardGeneration = 0;
  let stopped = false;
  const keyboardActive = () => !stopped && !document.hidden && (alerts.has('language') || alerts.has('capsLock'));
  const pollKeyboard = async (generation: number): Promise<void> => {
    let delay = 350;
    try {
      const [caps, language] = await invoke<[boolean | null, string | null]>('pivo_keyboard_status');
      if (generation !== keyboardGeneration || !keyboardActive()) return;
      if (alerts.has('language') && language && previousLanguage && language !== previousLanguage) {
        publishNotice({
          kind: 'language',
          text: languageName(language),
          badge: language.split(/[-_]/)[0]?.toUpperCase(),
        });
      }
      if (alerts.has('capsLock') && caps !== null && previousCaps !== null && caps !== previousCaps) {
        publishNotice({ kind: 'capsLock', text: t('hud.capsLock'), badge: t(caps ? 'hud.on' : 'hud.off'), badgeActive: caps });
      }
      previousLanguage = language ?? previousLanguage;
      previousCaps = caps ?? previousCaps;
    } catch {
      delay = 2000;
    } finally {
      if (generation === keyboardGeneration && keyboardActive()) {
        keyboardTimer = setTimeout(() => void pollKeyboard(generation), delay);
      }
    }
  };
  const resetKeyboard = () => {
    clearTimeout(keyboardTimer);
    const generation = ++keyboardGeneration;
    previousLanguage = null;
    previousCaps = null;
    if (keyboardActive()) void pollKeyboard(generation);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === preferenceKey || event.key === null) {
      alerts = readAlerts();
      schedule();
      resetKeyboard();
    }
  };
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', schedule);
  document.addEventListener('visibilitychange', resetKeyboard);
  schedule();
  resetKeyboard();
  return () => {
    stopped = true;
    resetKeyboard();
    document.removeEventListener('visibilitychange', resetKeyboard);
    monitorNotices = false;
    window.removeEventListener('storage', onStorage);
    if (listeners.size === 0) document.removeEventListener('visibilitychange', schedule);
    schedule();
  };
}

export function mountHudSettings(container: HTMLElement): () => void {
  const table = document.createElement('div');
  table.className = 'hud-readings';
  const values = new Map<Item, HTMLElement>();
  const hint = document.createElement('p');
  hint.textContent = t('hud.alertHint');
  for (const item of items) {
    const row = document.createElement('label');
    const name = document.createElement('span');
    const reading = document.createElement('output');
    name.textContent = t(`hud.${item}`);
    reading.textContent = value(item);
    values.set(item, reading);
    row.append(name, reading);
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = alerts.has(item);
    enabled.setAttribute('aria-label', t('hud.alertFor', { indicator: name.textContent }));
    enabled.onchange = () => {
      const next = readAlerts();
      if (enabled.checked) next.add(item);
      else next.delete(item);
      try {
        localStorage.setItem(preferenceKey, JSON.stringify([...next]));
        alerts = next;
      } catch {
        enabled.checked = alerts.has(item);
      }
      schedule();
    };
    row.append(enabled);
    table.append(row);
  }
  container.replaceChildren(hint, table);
  return subscribe(() => {
    for (const [item, reading] of values) reading.textContent = value(item);
  });
}
