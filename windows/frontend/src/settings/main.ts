import { occasionPieces, renderOccasionOutfit } from '../presentation/occasion-outfits.ts';
import { mountHolidayScene } from './holiday-scene.ts';
import { settleHolidayAppearance } from '../presentation/holiday-appearance.ts';
import { renderHolidayNavigation } from './holiday-nav.ts';
import type { HolidayTheme } from '../presentation/holidays.ts';
import { mountMascot } from '../presentation/mascot.ts';
import { holidays, holidayThemes } from '../presentation/holidays.ts';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { locale, locales, t } from '../i18n/index.ts';
import { applyPreferences, initializePreferences, mascotClothes, mascotProps, preferences, propSkins, type Preferences } from '../preferences/index.ts';
import { updateText, type UpdateStatus } from '../presentation/update.ts';
import appIconUrl from '../../../icons/icon.ico?url';
import packageInfo from '../../package.json' with { type: 'json' };
import './style.css';
import { mountPluginSettings } from '../plugins/settings.ts';
import { addWidgetSections } from '../widgets/settings.ts';

const mascotSize = document.querySelector<HTMLSelectElement>('#mascot-size')!;
const mascotMotion = document.querySelector<HTMLInputElement>('#mascot-motion')!;
const portrait = document.querySelector<HTMLElement>('#mascot-portrait')!;
mountMascot(portrait).setAttribute('viewBox', '8 9 112 96');
const clothingGrid = document.querySelector('#mascot-clothes')!;
const propGrid = document.querySelector('#mascot-props')!;
const propControls = [...mascotClothes, ...mascotProps].map(prop => {
  const clothing = prop === 'hat' || prop === 'scarf';
  const row = document.createElement('div');
  row.className = 'mascot-item-card';
  const preview = document.createElement('div');
  preview.className = 'mascot mascot-item-preview';
  if (clothing) preview.classList.add('mascot-clothing-preview');
  const svg = mountMascot(preview);
  svg.setAttribute('viewBox', '8 9 112 96');
  const item = svg.querySelector<SVGGElement>(clothing ? `.mascot-${prop}` : `[data-prop="${prop}"]`)!;
  item.classList.add('mascot-prop-equipped');
  const label = document.createElement('label');
  const select = document.createElement('select');
  select.id = `mascot-prop-${prop}`;
  label.htmlFor = select.id;
  label.dataset.i18n = `settings.prop.${prop}`;
  for (const skin of propSkins) {
    const option = new Option('', skin);
    option.dataset.i18n = `settings.skin.${prop}.${skin}`;
    select.add(option);
  }
  select.addEventListener('change', () => {
    void save('pivo_set_prop_skin', { prop, skin: select.value });
  });
  row.append(preview, label, select);
  if (clothing) {
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.id = `mascot-${prop}`;
    const visibility = document.createElement('label');
    const text = document.createElement('span');
    text.dataset.i18n = 'settings.mascotWear';
    visibility.className = 'mascot-wear';
    visibility.append(toggle, text);
    row.append(visibility);
    clothingGrid.append(row);
  } else {
    propGrid.append(row);
  }
  return { prop, select, preview, item, svg };
});
const mascotHat = document.querySelector<HTMLInputElement>('#mascot-hat')!;
const mascotScarf = document.querySelector<HTMLInputElement>('#mascot-scarf')!;
const holidayOutfit = document.querySelector<HTMLSelectElement>('#holiday-outfit')!;
const holidayAppearance = document.querySelector<HTMLSelectElement>('#holiday-appearance')!;
for (const select of [holidayOutfit, holidayAppearance]) {
  for (const mode of ['off', 'auto', ...holidayThemes]) {
    const option = new Option('', mode);
    option.dataset.i18n = `settings.holidayMode.${mode}`;
    select.add(option);
  }
  select.addEventListener('change', () => {
    void save('pivo_set_holidays', { outfit: holidayOutfit.value, appearance: holidayAppearance.value });
  });
}
const holidayOccasion = document.querySelector<HTMLSelectElement>('#holiday-occasion')!;
const holidayVariant = document.querySelector<HTMLSelectElement>('#holiday-variant')!;
const holidayPortrait = document.querySelector<HTMLElement>('#holiday-outfit-preview')!;
mountMascot(holidayPortrait).setAttribute('viewBox', '8 9 112 96');
for (const [occasion, theme, label] of [
  ...holidayThemes.map(theme => [theme, theme, `settings.holidayMode.${theme}`] as const),
  ...holidays.map(([id, theme]) => [id, theme, `holidays.${id}`] as const),
]) {
  const option = new Option('', occasion);
  option.dataset.i18n = label;
  option.dataset.theme = theme;
  holidayOccasion.add(option);
}
for (const variant of propSkins) {
  const option = new Option('', variant);
  option.dataset.i18n = `settings.holidayVariant.${variant}`;
  holidayVariant.add(option);
}
function renderHolidayOutfit(): void {
  holidayVariant.value = preferences().holidays.variants[holidayOccasion.value] ?? 'classic';
  for (const option of holidayOccasion.options) {
    if (option.value === option.dataset.theme) {
      option.textContent = t('settings.holidayThemeDefault', {
        theme: t(`settings.holidayMode.${option.value as HolidayTheme}`),
      });
    }
  }
  for (const option of holidayVariant.options) {
    const pieces = occasionPieces(holidayOccasion.value, option.value);
    if (pieces) {
      option.textContent = pieces.map(piece => t(`settings.garment.${piece}`)).join(' · ');
    } else {
      option.textContent = t(`settings.holidayVariant.${option.value as typeof propSkins[number]}`);
    }
  }
  renderOccasionOutfit(holidayPortrait, holidayOccasion.value, holidayVariant.value);
}
holidayOccasion.addEventListener('change', renderHolidayOutfit);
holidayVariant.addEventListener('change', () => {
  void save('pivo_set_holiday_variant', { occasion: holidayOccasion.value, variant: holidayVariant.value });
});
const language = document.querySelector<HTMLSelectElement>('#language')!;
const display = document.querySelector<HTMLSelectElement>('#display')!;
const displayLayout = document.querySelector<HTMLElement>('#display-layout')!;
const automatic = document.querySelector<HTMLInputElement>('#automatic-updates')!;
const check = document.querySelector<HTMLButtonElement>('#check-updates')!;
const error = document.querySelector<HTMLElement>('#error')!;
const themeInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="theme"]')];
const minimalStrip = document.querySelector<HTMLInputElement>('#minimal-strip')!;
const islandScale = document.querySelector<HTMLSelectElement>('#island-scale')!;
const compactInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="compact-mode"]')];
const mountWidget = addWidgetSections();
let activeSection = 'appearance';
let widgetLocale = locale();
let disposeWidget: (() => void) | undefined;
const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-section]')];
const appWindow = getCurrentWindow();
const maximize = document.querySelector<HTMLButtonElement>('#maximize')!;
let update: UpdateStatus | undefined;
let loading = true;
let saving = false;
let maximized = false;
interface Display { id: string; number: number; x: number; y: number; width: number; height: number; primary: boolean }
let displays: Display[] = [];
let displayOptionsKey = '';
let displayLayoutKey = '';

function renderDisplayLayout(requested: string, disabled: boolean): void {
  const key = JSON.stringify([locale(), displays]);
  if (key !== displayLayoutKey) {
    displayLayoutKey = key;
    const screens = displays.filter(screen => screen.width > 0 && screen.height > 0);
    displayLayout.hidden = screens.length === 0;
    if (screens.length === 0) {
      displayLayout.replaceChildren();
      return;
    }
    const left = Math.min(...screens.map(screen => screen.x));
    const top = Math.min(...screens.map(screen => screen.y));
    const width = Math.max(...screens.map(screen => screen.x + screen.width)) - left;
    const height = Math.max(...screens.map(screen => screen.y + screen.height)) - top;
    const layoutWidth = 420;
    const layoutHeight = 160;
    const padding = 10;
    const scale = Math.min((layoutWidth - padding * 2) / width, (layoutHeight - padding * 2) / height);
    const originX = (layoutWidth - width * scale) / 2;
    const originY = (layoutHeight - height * scale) / 2;
    displayLayout.replaceChildren(...screens.map(screen => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.displayId = screen.id;
      const name = t('settings.displayNumber', { number: screen.number });
      const resolution = `${screen.width} × ${screen.height}`;
      button.title = `${name} · ${resolution}${screen.primary ? ` · ${t('settings.primary')}` : ''}`;
      button.setAttribute('aria-label', button.title);
      button.style.left = `${(originX + (screen.x - left) * scale) * 100 / layoutWidth}%`;
      button.style.top = `${(originY + (screen.y - top) * scale) * 100 / layoutHeight}%`;
      button.style.width = `${screen.width * scale * 100 / layoutWidth}%`;
      button.style.height = `${screen.height * scale * 100 / layoutHeight}%`;
      const number = document.createElement('strong');
      number.textContent = String(screen.number);
      const detail = document.createElement('small');
      detail.textContent = resolution;
      button.append(number, detail);
      button.addEventListener('click', () => {
        if (!loading && !saving) void save('pivo_set_display', { display: screen.id });
      });
      return button;
    }));
  }
  const selected = displays.find(screen => screen.id === requested) ?? displays.find(screen => screen.primary) ?? displays[0];
  for (const button of displayLayout.querySelectorAll<HTMLButtonElement>('button')) {
    button.classList.toggle('is-current', button.dataset.displayId === selected?.id);
    button.setAttribute('aria-pressed', String(button.dataset.displayId === requested));
    button.setAttribute('aria-disabled', String(disabled));
  }
}
const pluginSettings = mountPluginSettings(document.querySelector<HTMLElement>('#plugin-manager')!, detail =>
  failed(typeof detail === 'string' ? detail : t('plugins.actionFailed'), detail));
addEventListener('pagehide', () => { disposeWidget?.(); pluginSettings.dispose(); }, { once: true });

for (const image of document.querySelectorAll<HTMLImageElement>('.about-icon, .title-icon')) image.src = appIconUrl;
for (const item of locales) language.add(new Option(item.name, item.id));

function selectSection(section: string): void {
  if (section !== activeSection) {
    disposeWidget?.();
    activeSection = section;
    widgetLocale = locale();
    disposeWidget = mountWidget(section);
  }
  for (const tab of tabs) {
    const selected = tab.dataset.section === section;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.querySelector<HTMLElement>('#page-' + tab.dataset.section)!.hidden = !selected;
    if (selected) tab.scrollIntoView({ block: 'nearest' });
  }
}
let requestedTab = activeSection;
let sectionTransition: ViewTransition | undefined;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let nativeReducedMotion = false;
const motionReduced = () => nativeReducedMotion || reducedMotion.matches;
function applyMotionPreference(): void {
  const reduced = motionReduced();
  document.documentElement.toggleAttribute('data-reduced-motion', reduced);
  if (reduced) {
    sectionTransition?.skipTransition();
    settleHolidayAppearance();
    holidaySceneMotion.settle();
  }
}
reducedMotion.addEventListener('change', applyMotionPreference);

function navigateSection(section: string): void {
  requestedTab = section;
  if (sectionTransition) return;
  if (section === activeSection) return;
  if (motionReduced() || !document.startViewTransition) {
    selectSection(section);
    return;
  }
  const transition = document.startViewTransition(() => selectSection(requestedTab));
  sectionTransition = transition;
  const finish = () => {
    sectionTransition = undefined;
    navigateSection(requestedTab);
  };
  void transition.finished.then(finish, finish);
}

for (const tab of tabs) tab.addEventListener('click', () => navigateSection(tab.dataset.section!));
for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-about-link]')) {
  link.addEventListener('click', event => {
    event.preventDefault();
    void invoke('pivo_open_about_link', { destination: link.dataset.aboutLink })
      .catch(detail => failed(t('settings.actionFailed'), detail));
  });
}
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
  navigateSection(tabs[next]!.dataset.section!);
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
const holidayScene = document.querySelector<HTMLElement>('.settings-holiday-scene')!;
const holidaySceneMotion = mountHolidayScene(holidayScene, motionReduced);
addEventListener('pagehide', () => holidaySceneMotion.dispose(), { once: true });

function render(): void {
  const theme = document.documentElement.dataset.holidayTheme as HolidayTheme | undefined;
  holidaySceneMotion.render(theme);
  renderHolidayNavigation(theme);
  pluginSettings.render();
  if (widgetLocale !== locale()) {
    widgetLocale = locale();
    disposeWidget?.();
    disposeWidget = mountWidget(activeSection);
  }
  document.title = `PivO — ${t('settings.title')}`;
  language.value = locale();
  document.querySelector<HTMLElement>('#language-flag')!.dataset.flag =
    locales.find(item => item.id === language.value)?.flag ?? '';
  const prefs = preferences();
  const optionsKey = JSON.stringify([locale(), displays, prefs.display]);
  if (optionsKey !== displayOptionsKey) {
    displayOptionsKey = optionsKey;
    const primary = displays.find(item => item.primary) ?? displays[0];
    const primaryLabel = t('settings.displayPrimary');
    const primaryName = primary ? t('settings.displayNumber', { number: primary.number }) : '';
    const options = [new Option(primaryName ? `${primaryLabel} · ${primaryName}` : primaryLabel, 'primary')];
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
  renderDisplayLayout(prefs.display, loading || saving);
  portrait.dataset.size = prefs.mascotSize;
  for (const { preview, svg, prop } of propControls) {
    preview.dataset.hat = String(prefs.mascotHat || prop === 'hat');
    preview.dataset.scarf = String(prefs.mascotScarf || prop === 'scarf');
    for (const cloth of mascotClothes) {
      svg.querySelector<SVGGElement>(`.mascot-${cloth}`)!.dataset.skin = prefs.propSkins[cloth] ?? 'classic';
    }
  }
  for (const cloth of mascotClothes) {
    portrait.querySelector<SVGGElement>(`.mascot-${cloth}`)!.dataset.skin = prefs.propSkins[cloth] ?? 'classic';
  }
  portrait.dataset.hat = String(prefs.mascotHat);
  portrait.dataset.scarf = String(prefs.mascotScarf);
  for (const { prop, select, item } of propControls) {
    select.value = prefs.propSkins[prop] ?? 'classic';
    item.dataset.skin = select.value;
    select.disabled = loading || saving;
  }
  mascotHat.checked = prefs.mascotHat;
  mascotScarf.checked = prefs.mascotScarf;
  mascotSize.value = prefs.mascotSize;
  mascotMotion.checked = prefs.mascotMotion;
  holidayOutfit.value = prefs.holidays.outfit;
  holidayAppearance.value = prefs.holidays.appearance;
  renderHolidayOutfit();
  const { holidayOccasion: activeOccasion, holidayVariant: activeVariant } = document.documentElement.dataset;
  renderOccasionOutfit(portrait, activeOccasion, activeVariant);
  for (const { preview, prop } of propControls) {
    if (prop !== 'hat' && prop !== 'scarf') renderOccasionOutfit(preview, activeOccasion, activeVariant);
  }
  for (const input of themeInputs) input.checked = input.value === prefs.theme;
  minimalStrip.checked = prefs.minimalStrip;
  islandScale.value = String(prefs.islandScale);
  for (const input of compactInputs) input.checked = input.value === prefs.compactMode;
  for (const control of [language, display, mascotSize, mascotMotion, mascotHat, mascotScarf, holidayOutfit, holidayAppearance, holidayVariant, islandScale, minimalStrip, ...themeInputs, ...compactInputs]) control.disabled = loading || saving;
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
async function save(command: 'pivo_set_locale' | 'pivo_set_theme' | 'pivo_set_minimal_strip' | 'pivo_set_island_scale' | 'pivo_set_compact_mode' | 'pivo_set_display' | 'pivo_set_mascot' | 'pivo_set_prop_skin' | 'pivo_set_holidays' | 'pivo_set_holiday_variant', values: Record<string, string | boolean>): Promise<void> {
  if (saving) { render(); return; }
  saving = true;
  error.hidden = true;
  render();
  try { applyPreferences(await invoke<Preferences>(command, values)); }
  catch (detail) { failed(t('settings.saveFailed'), detail); }
  finally { saving = false; render(); }
}
for (const control of [mascotSize, mascotMotion, mascotHat, mascotScarf]) control.addEventListener('change', () => {
  void save('pivo_set_mascot', { size: mascotSize.value, motion: mascotMotion.checked, hat: mascotHat.checked, scarf: mascotScarf.checked });
});
language.addEventListener('change', () => { void save('pivo_set_locale', { locale: language.value }); });
display.addEventListener('change', () => { void save('pivo_set_display', { display: display.value }); });
for (const input of themeInputs) input.addEventListener('change', () => {
  if (input.checked) void save('pivo_set_theme', { theme: input.value });
});
minimalStrip.addEventListener('change', () => void save('pivo_set_minimal_strip', { enabled: minimalStrip.checked }));
islandScale.addEventListener('change', () => void save('pivo_set_island_scale', { islandScale: islandScale.value }));
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
  applyMotionPreference();
  const unlistenMotion = await listen<{ reducedMotion: boolean }>('pivo:state', ({ payload }) => {
    if (nativeReducedMotion === payload.reducedMotion) return;
    nativeReducedMotion = payload.reducedMotion;
    applyMotionPreference();
  });
  addEventListener('pagehide', unlistenMotion, { once: true });
  if (location.hash === '#about') selectSection('about');
  const unlistenSection = await appWindow.listen<string>('pivo:settings-section', () => {
    void invoke<string | null>('pivo_settings_section').then(section => {
      if (section && tabs.some(tab => tab.dataset.section === section)) navigateSection(section);
    }).catch(detail => console.error('Unable to open settings section:', detail));
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
