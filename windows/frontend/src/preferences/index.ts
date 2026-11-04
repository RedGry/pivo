import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { setLocale } from '../i18n/index.ts';
import { applyHolidayAppearance, watchLocalDay } from '../presentation/holiday-appearance.ts';
import type { HolidayMode } from '../presentation/holidays.ts';

export const mascotProps = ['music', 'pomodoro', 'water', 'tasks', 'calendar', 'shelf', 'hud'] as const;
export const mascotClothes = ['hat', 'scarf'] as const;
export const propSkins = ['classic', 'alternate', 'signature'] as const;
type MascotProp = typeof mascotProps[number] | typeof mascotClothes[number];
export type PropSkin = typeof propSkins[number];

export interface Preferences {
  holidays: { outfit: HolidayMode; appearance: HolidayMode; variants: Partial<Record<string, PropSkin>> };
  propSkins: Partial<Record<MascotProp, PropSkin>>;
  revision: number;
  locale: string;
  theme: 'system' | 'light' | 'dark';
  minimalStrip: boolean;
  islandScale: number;
  compactMode: 'auto' | 'eyes' | 'strip';
  display: string;
  mascotHat: boolean;
  mascotScarf: boolean;
  mascotSize: 'small' | 'medium' | 'large';
  mascotMotion: boolean;
}

let current: Preferences = { revision: -1, locale: 'en', theme: 'dark', compactMode: 'auto', islandScale: 0, minimalStrip: false, display: 'primary', mascotSize: 'medium', mascotMotion: true, mascotHat: false, mascotScarf: false, propSkins: {}, holidays: { outfit: 'off', appearance: 'off', variants: {} } };
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
  applyHolidayAppearance(current.holidays.outfit, current.holidays.appearance, new Date(), current.holidays.variants);
}

export async function initializePreferences(changed: () => void): Promise<void> {
  watchLocalDay(() => {
    applyHolidayAppearance(current.holidays.outfit, current.holidays.appearance, new Date(), current.holidays.variants);
    changed();
  });
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
