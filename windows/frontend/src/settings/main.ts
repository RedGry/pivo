import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { locale, locales, t } from '../i18n/index.ts';
import { applyPreferences, initializePreferences, preferences, type Preferences } from '../preferences/index.ts';
import { updateText, type UpdateStatus } from '../presentation/update.ts';
import mascotUrl from '../../../../assets/mascot.png';
import packageInfo from '../../package.json' with { type: 'json' };
import './style.css';
import { mountPluginOrder, mountPluginSettings } from '../plugins/settings.ts';

const language = document.querySelector<HTMLSelectElement>('#language')!;
const display = document.querySelector<HTMLSelectElement>('#display')!;
const automatic = document.querySelector<HTMLInputElement>('#automatic-updates')!;
const obsession = document.querySelector<HTMLInputElement>('#obsession')!;
const obsessionActivity = document.querySelector<HTMLSelectElement>('#obsession-activity')!;
const check = document.querySelector<HTMLButtonElement>('#check-updates')!;
const error = document.querySelector<HTMLElement>('#error')!;
const themeInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="theme"]')];
const compactInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="compact-mode"]')];
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-section]')];
const appWindow = getCurrentWindow();
const maximize = document.querySelector<HTMLButtonElement>('#maximize')!;
let update: UpdateStatus | undefined;
let loading = true;
let saving = false;
let maximized = false;
interface Display { id: string; number: number; width: number; height: number; primary: boolean }
let displays: Display[] = [];
let displayOptionsKey = '';
const pluginSettings = mountPluginSettings(document.querySelector<HTMLElement>('#plugin-manager')!, detail =>
  failed(typeof detail === 'string' ? detail : t('plugins.actionFailed'), detail));
addEventListener('pagehide', () => pluginSettings.dispose(), { once: true });
const pluginOrder = mountPluginOrder(document.querySelector<HTMLElement>('#plugin-order')!, detail =>
  failed(typeof detail === 'string' ? detail : t('plugins.actionFailed'), detail));
addEventListener('pagehide', () => pluginOrder.dispose(), { once: true });

for (const image of document.querySelectorAll<HTMLImageElement>('.companion, .title-icon')) image.src = mascotUrl;
for (const item of locales) language.add(new Option(item.name, item.id));

function selectSection(section: string): void {
  for (const tab of tabs) {
    const selected = tab.dataset.section === section;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.querySelector<HTMLElement>('#page-' + tab.dataset.section)!.hidden = !selected;
  }
}
for (const tab of tabs) tab.addEventListener('click', () => selectSection(tab.dataset.section!));
document.querySelector('nav')!.addEventListener('keydown', event => {
  if (!(event instanceof KeyboardEvent)) return;
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0) return;
  let next: number;
  if (event.key === 'ArrowDown') next = (current + 1) % tabs.length;
  else if (event.key === 'ArrowUp') next = (current + tabs.length - 1) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  tabs[next]!.focus();
  selectSection(tabs[next]!.dataset.section!);
});

function renderCaption(): void {
  const key = maximized ? 'controls.restore' : 'controls.maximize';
  maximize.dataset.i18nAria = key;
  maximize.dataset.i18nTitle = key;
  maximize.setAttribute('aria-label', t(key));
  maximize.title = t(key);
  maximize.querySelector('path')!.setAttribute('d', maximized
    ? 'M5.5 3.5h7v7M3.5 5.5h7v7h-7z' : 'M3.5 3.5h9v9h-9z');
}
function render(): void {
  pluginSettings.render();
  pluginOrder.render();
  document.title = `PivO — ${t('settings.title')}`;
  language.value = locale();
  const prefs = preferences();
  const optionsKey = JSON.stringify([locale(), displays, prefs.display]);
  if (optionsKey !== displayOptionsKey) {
    displayOptionsKey = optionsKey;
    const options = [new Option(t('settings.displayPrimary'), 'primary')];
    for (const item of displays) options.push(new Option(
      `${t('settings.displayNumber', { number: item.number })} · ${item.width} × ${item.height}${item.primary ? ` · ${t('settings.primary')}` : ''}`, item.id,
    ));
    if (prefs.display !== 'primary' && !displays.some(item => item.id === prefs.display)) {
      const unavailable = new Option(t('settings.displayUnavailable'), prefs.display);
      unavailable.disabled = true;
      options.push(unavailable);
    }
    display.replaceChildren(...options);
  }
  display.value = prefs.display;
  obsession.checked = prefs.obsession;
  obsessionActivity.value = prefs.obsessionActivity;
  for (const input of themeInputs) input.checked = input.value === prefs.theme;
  for (const input of compactInputs) input.checked = input.value === prefs.compactMode;
  for (const control of [language, display, obsession, obsessionActivity, ...themeInputs, ...compactInputs]) control.disabled = loading || saving;
  document.querySelector<HTMLElement>('#version')!.textContent = t('settings.version', { version: packageInfo.version });
  document.querySelector<HTMLElement>('#sidebar-version')!.textContent = packageInfo.version;
  renderCaption();
  if (update) {
    automatic.checked = update.automatic;
    automatic.disabled = loading || saving;
    check.disabled = update.busy || loading || saving;
    document.querySelector<HTMLElement>('#update-message')!.textContent = updateText(update);
    document.querySelector<HTMLElement>('#update-details')!.hidden = !update.detail;
    document.querySelector<HTMLElement>('#update-detail')!.textContent = update.detail;
  }
}
function failed(message: string, detail: unknown): void {
  error.textContent = message;
  error.hidden = false;
  console.error('Settings action failed:', detail);
}
async function save(command: 'pivo_set_locale' | 'pivo_set_theme' | 'pivo_set_compact_mode' | 'pivo_set_display' | 'pivo_set_obsession' | 'pivo_set_obsession_activity', values: Record<string, string | boolean>): Promise<void> {
  if (saving) { render(); return; }
  saving = true;
  error.hidden = true;
  render();
  try { applyPreferences(await invoke<Preferences>(command, values)); }
  catch (detail) { failed(t('settings.saveFailed'), detail); }
  finally { saving = false; render(); }
}
language.addEventListener('change', () => { void save('pivo_set_locale', { locale: language.value }); });
display.addEventListener('change', () => { void save('pivo_set_display', { display: display.value }); });
obsession.addEventListener('change', () => { void save('pivo_set_obsession', { enabled: obsession.checked }); });
obsessionActivity.addEventListener('change', () => { void save('pivo_set_obsession_activity', { activity: obsessionActivity.value }); });
for (const input of themeInputs) input.addEventListener('change', () => {
  if (input.checked) void save('pivo_set_theme', { theme: input.value });
});
for (const input of compactInputs) input.addEventListener('change', () => {
  if (input.checked) void save('pivo_set_compact_mode', { compactMode: input.value });
});
automatic.addEventListener('change', () => {
  if (saving) { render(); return; }
  const enabled = automatic.checked;
  saving = true;
  error.hidden = true;
  render();
  void invoke('pivo_set_automatic_updates', { enabled })
    .catch(detail => failed(t('settings.saveFailed'), detail))
    .finally(() => { saving = false; render(); });
});
check.addEventListener('click', () => {
  error.hidden = true;
  void invoke('pivo_check_updates').catch(detail => failed(t('updates.checkFailed'), detail));
});
for (const [id, action] of [
  ['minimize', () => appWindow.minimize()],
  ['maximize', () => appWindow.toggleMaximize()],
  ['close-settings', () => appWindow.close()],
] as const) document.querySelector<HTMLButtonElement>('#' + id)!.addEventListener('click', () => {
  void action().catch(detail => failed(t('settings.actionFailed'), detail));
});
async function refreshCaption(): Promise<void> {
  maximized = await appWindow.isMaximized();
  renderCaption();
}
async function start(): Promise<void> {
  if (location.hash === '#about') selectSection('about');
  const unlistenSection = await appWindow.listen<string>('pivo:settings-section', event => {
    void invoke('pivo_settings_section').catch(detail => console.error('Unable to acknowledge settings section:', detail));
    if (tabs.some(tab => tab.dataset.section === event.payload)) selectSection(event.payload);
  });
  addEventListener('pagehide', unlistenSection, { once: true });
  const requestedSection = await invoke<string | null>('pivo_settings_section');
  if (tabs.some(tab => tab.dataset.section === requestedSection)) selectSection(requestedSection!);
  await initializePreferences(render);
  let receivedDisplays = false;
  const unlistenDisplays = await listen<Display[]>('pivo:displays', event => {
    receivedDisplays = true;
    displays = event.payload;
    render();
  });
  addEventListener('pagehide', unlistenDisplays, { once: true });
  const initialDisplays = await invoke<Display[]>('pivo_get_displays');
  if (!receivedDisplays) displays = initialDisplays;
  let received = false;
  const unlisten = await listen<UpdateStatus>('pivo:update', event => {
    received = true;
    update = event.payload;
    render();
  });
  addEventListener('pagehide', unlisten, { once: true });
  const initial = await invoke<UpdateStatus>('pivo_update_status');
  if (!received) update = initial;
  const unlistenResize = await appWindow.onResized(() => {
    void refreshCaption().catch(detail => console.error('Unable to update caption controls:', detail));
  });
  addEventListener('pagehide', unlistenResize, { once: true });
  await refreshCaption();
  loading = false;
  render();
}
render();
void start().catch(detail => failed(t('settings.loadFailed'), detail));
