import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { setLocale } from '../i18n/index.ts';

export interface Preferences {
  revision: number;
  locale: string;
  theme: 'system' | 'light' | 'dark';
  compactMode: 'auto' | 'eyes' | 'strip';
  display: string;
}

let current: Preferences = { revision: -1, locale: 'en', theme: 'dark', compactMode: 'auto', display: 'primary' };
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
export const preferences = () => current;

function applyTheme(): void {
  document.documentElement.dataset.theme = current.theme === 'system'
    ? (systemTheme.matches ? 'dark' : 'light') : current.theme;
}
systemTheme.addEventListener('change', applyTheme);

export function applyPreferences(next: Preferences): void {
  if (next.revision < current.revision) return;
  current = next;
  setLocale(next.locale);
  applyTheme();
}

export async function initializePreferences(changed: () => void): Promise<void> {
  let revision = 0;
  const apply = (next: Preferences) => { applyPreferences(next); changed(); };
  const unlisten = await listen<Preferences>('pivo:preferences', event => {
    revision++;
    apply(event.payload);
  });
  addEventListener('pagehide', unlisten, { once: true });
  const requested = revision;
  const initial = await invoke<Preferences>('pivo_get_preferences');
  if (revision === requested) apply(initial);
}
