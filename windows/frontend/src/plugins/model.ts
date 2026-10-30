import { configuration, parseSettings, type Setting, type Values } from './configuration.ts';
import { parsePluginIcon, type PluginIcon } from './icons.ts';

export type Localized = Record<string, string>;
export interface Manifest {
  schemaVersion: 1;
  id: string;
  name: Localized;
  description?: Localized;
  author?: string;
  icon?: PluginIcon;
  kind: 'timer' | 'information';
  seconds?: number;
  breakSeconds?: number;
  text?: Localized;
  settings?: Setting[];
}
export interface Timer { remaining: number; deadline: number | null; mode: 'focus' | 'break' }
export interface Entry { manifest: Manifest; enabled: boolean; timer?: Timer; values?: Values }
export interface PluginState { entries: Entry[]; selected: string }
export const builtin: Manifest = { schemaVersion: 1, id: 'pivo.pomodoro', name: { en: 'Pomodoro' }, author: 'PivO', icon: { type: 'emoji', value: '🍅' }, kind: 'timer', seconds: 1500, breakSeconds: 300,
  settings: [
    { key: 'focus', labelKey: 'plugins.focusMinutes', type: 'number', bind: 'seconds', unit: 'minutes', default: 25, min: 1, max: 180 },
    { key: 'break', labelKey: 'plugins.breakMinutes', type: 'number', bind: 'breakSeconds', unit: 'minutes', default: 5, min: 1, max: 60 },
  ],
};
export const initialState = (): PluginState => ({ entries: [{ manifest: builtin, enabled: true }], selected: builtin.id });
export function localized(value: Localized, language: string): string { return value[language] ?? value[language.split('-')[0]!] ?? value.en!; }
function strings(value: unknown): value is Localized {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.hasOwn(value, 'en') && Object.entries(value).length <= 40
    && Object.entries(value).every(([key, text]) => /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(key)
      && typeof text === 'string' && text.trim().length > 0 && text.length <= 500);
}
export function parseManifest(value: unknown): Manifest {
  if (!value || typeof value !== 'object') throw new Error('Invalid plugin manifest');
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 1 || typeof item.id !== 'string' || !/^[a-z][a-z0-9.-]{2,63}$/.test(item.id)
    || !strings(item.name) || !['timer', 'information'].includes(String(item.kind))) throw new Error('Invalid plugin manifest');
  const settings = item.settings === undefined ? undefined : parseSettings(item.settings, item.kind as Manifest['kind'], strings);
  if (item.description !== undefined && !strings(item.description)) throw new Error('Invalid plugin description');
  if (item.author !== undefined && (typeof item.author !== 'string' || !item.author.trim() || item.author.length > 80)) throw new Error('Invalid plugin author');
  const base = { schemaVersion: 1 as const, id: item.id, name: item.name, ...(settings ? { settings } : {}),
    ...(item.icon !== undefined ? { icon: parsePluginIcon(item.icon) } : {}),
    ...(item.description !== undefined ? { description: item.description as Localized } : {}),
    ...(item.author !== undefined ? { author: (item.author as string).trim() } : {}) };
  if (item.kind === 'information') {
    if (!strings(item.text)) throw new Error('Invalid plugin text');
    for (const text of settings === undefined ? [] : Object.values(item.text)) {
      for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
        if (!settings?.some(field => field.key === match[1])) throw new Error('Unknown text setting placeholder');
      }
    }
    return { ...base, kind: 'information', text: item.text };
  }
  const duration = (number: unknown): number => {
    if (!Number.isInteger(number) || (number as number) < 1 || (number as number) > 86400) throw new Error('Invalid timer duration');
    return number as number;
  };
  return { ...base, kind: 'timer', seconds: duration(item.seconds), breakSeconds: duration(item.breakSeconds) };
}
export function restore(raw: string | null): PluginState {
  if (!raw) return initialState();
  try {
    const data = JSON.parse(raw) as PluginState;
    if (!Array.isArray(data.entries) || data.entries.length > 30) return initialState();
    const ids = new Set<string>();
    const entries: Entry[] = data.entries.map(entry => {
      const manifest = entry.manifest?.id === builtin.id ? builtin : parseManifest(entry.manifest);
      if (ids.has(manifest.id)) throw new Error('Duplicate plugin');
      ids.add(manifest.id);
      const timer = entry.timer;
      const validTimer = timer && Number.isFinite(timer.remaining) && timer.remaining >= 0 && timer.remaining <= 86400
        && (timer.deadline === null || (Number.isFinite(timer.deadline) && timer.deadline > 0))
        && (timer.mode === 'focus' || timer.mode === 'break');
      return { manifest, enabled: entry.enabled === true, ...(entry.values ? { values: configuration(manifest.settings, entry.values) } : {}),
        ...(validTimer ? { timer: { remaining: timer.remaining, deadline: timer.deadline, mode: timer.mode } } : {}) };
    });
    if (!ids.has(builtin.id)) entries.push({ manifest: builtin, enabled: false });
    return { entries, selected: typeof data.selected === 'string' ? data.selected : builtin.id };
  } catch { return initialState(); }
}
export function secondsLeft(timer: Timer, now: number): number {
  return timer.deadline === null ? timer.remaining : Math.max(0, Math.ceil((timer.deadline - now) / 1000));
}
/** Reorder enabled pages while retaining disabled slots and all unrelated state. */
export function movePlugin(state: PluginState, id: string, delta: -1 | 1): void {
  const enabled = state.entries.map((entry, index) => entry.enabled ? index : -1).filter(index => index >= 0);
  const current = enabled.findIndex(index => state.entries[index]!.manifest.id === id);
  const source = enabled[current];
  const target = enabled[current + delta];
  if (source !== undefined && target !== undefined) [state.entries[source], state.entries[target]] = [state.entries[target]!, state.entries[source]!];
}
export function timerFor(entry: Entry): Timer {
  return entry.timer ?? { remaining: duration(entry, 'focus'), deadline: null, mode: 'focus' };
}
/** Elapsed fraction of the active timer mode; non-timer pages have no progress. */
export function pluginProgress(entry: Entry, now: number): number | null {
  if (entry.manifest.kind !== 'timer') return null;
  const timer = timerFor(entry);
  const total = duration(entry, timer.mode);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - secondsLeft(timer, now) / total));
}
function duration(entry: Entry, mode: Timer['mode']): number {
  const bind = mode === 'focus' ? 'seconds' : 'breakSeconds';
  const field = entry.manifest.settings?.find(field => field.type === 'number' && field.bind === bind);
  return field?.type === 'number' ? (configuration(entry.manifest.settings, entry.values)[field.key] as number) * (field.unit === 'minutes' ? 60 : 1)
    : entry.manifest[bind] ?? 0;
}
export function saveConfiguration(entry: Entry, raw: Values): void {
  const values = configuration(entry.manifest.settings, raw, true);
  const before = [duration(entry, 'focus'), duration(entry, 'break')];
  entry.values = values;
  if (entry.manifest.kind === 'timer' && (before[0] !== duration(entry, 'focus') || before[1] !== duration(entry, 'break'))) entry.timer = resetTimer(entry);
}
export function informationText(entry: Entry, language: string): string {
  const values = configuration(entry.manifest.settings, entry.values);
  return localized(entry.manifest.text!, language).replace(/\{([^{}]+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}
export function resetTimer(entry: Entry): Timer {
  const mode = timerFor(entry).mode;
  return { remaining: duration(entry, mode), deadline: null, mode };
}
export function timerAction(entry: Entry, action: 'primary' | 'secondary', now: number): Timer {
  const timer = timerFor(entry);
  if (action === 'secondary') {
    const mode = timer.mode === 'focus' ? 'break' : 'focus';
    return { remaining: duration(entry, mode), deadline: null, mode };
  }
  if (timer.deadline !== null && secondsLeft(timer, now) > 0) return { ...timer, remaining: secondsLeft(timer, now), deadline: null };
  const remaining = secondsLeft(timer, now) || duration(entry, timer.mode);
  return { ...timer, remaining, deadline: now + remaining * 1000 };
}

