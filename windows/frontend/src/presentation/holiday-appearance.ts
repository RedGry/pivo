import { winterGarland } from './winter-garland.ts';
import { holidayArtwork } from './holiday-artwork.ts';
import { holidayTheme, holidaysOn, type HolidayMode } from './holidays.ts';

let garlandObserver: ResizeObserver | undefined;
const garlandWidths = new WeakMap<HTMLElement, number>();

function renderGarland(host: HTMLElement): void {
  const width = host.clientWidth || 480;
  if (garlandWidths.get(host) === width) return;
  host.innerHTML = winterGarland(width);
  garlandWidths.set(host, width);
}

export function settleHolidayAppearance(): void {
  for (const artwork of document.querySelectorAll<SVGElement>('[data-holiday-art] svg')) {
    artwork.getAnimations().forEach(animation => animation.cancel());
    if (artwork.classList.contains('outgoing-holiday-art')) artwork.remove();
  }
}

function replaceArtwork(host: HTMLElement, markup: string, wasVisible: boolean): void {
  const previous = wasVisible
    && typeof matchMedia === 'function'
    && !matchMedia('(prefers-reduced-motion: reduce)').matches
    && !document.documentElement.hasAttribute('data-reduced-motion')
    && host.closest('.panel')?.getAttribute('data-reduced-motion') !== 'true'
    ? host.querySelector('svg:not(.outgoing-holiday-art)') : null;
  if (!previous) {
    host.innerHTML = markup;
    return;
  }
  const opacity = getComputedStyle(previous).opacity;
  previous.getAnimations().forEach(animation => animation.cancel());
  previous.classList.add('outgoing-holiday-art');
  host.insertAdjacentHTML('afterbegin', markup);
  const exit = previous.animate([{ opacity }, { opacity: 0 }], 300);
  void exit.finished.then(() => previous.remove(), () => previous.remove());
  host.firstElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], 300);
}

export function applyHolidayAppearance(outfit: HolidayMode, appearance: HolidayMode, now = new Date(), variants: Partial<Record<string, string>> = {}): void {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settleHolidayAppearance();
  }
  const { dataset } = document.documentElement;
  const clothes = holidayTheme(outfit, now);
  const theme = holidayTheme(appearance, now);
  if (clothes) {
    dataset.holidayOutfit = clothes;
    const occasion = outfit === 'auto' ? holidaysOn(now)[0]?.[0] : clothes;
    dataset.holidayOccasion = occasion ?? clothes;
    dataset.holidayVariant = (occasion && variants[occasion]) || variants[clothes] || 'classic';
  }
  else {
    delete dataset.holidayOutfit;
    delete dataset.holidayVariant;
    delete dataset.holidayOccasion;
  }
  if (dataset.holidayTheme === theme) return;
  if (theme) dataset.holidayTheme = theme;
  else delete dataset.holidayTheme;
  garlandObserver?.disconnect();
  const garlands: HTMLElement[] = [];
  for (const host of document.querySelectorAll<HTMLElement>('[data-holiday-art]')) {
    const wasVisible = !host.hidden;
    const kind = host.dataset.holidayArt;
    const garland = theme === 'winter' && kind === 'garland';
    host.hidden = !theme || (kind === 'garland' && !garland) || (kind === 'ornament' && theme === 'winter');
    if (theme && !host.hidden) host.dataset.artTheme = theme;
    if (garland) {
      renderGarland(host);
      garlands.push(host);
    } else if (theme && !host.hidden) {
      replaceArtwork(host, holidayArtwork(theme, kind === 'icon' ? 'icon' : 'ornament'), wasVisible);
    }
  }
  if (garlands.length && typeof ResizeObserver !== 'undefined') {
    garlandObserver ??= new ResizeObserver(entries => {
      for (const { target } of entries) {
        if ((target as HTMLElement).clientWidth > 0) renderGarland(target as HTMLElement);
      }
    });
    for (const host of garlands) garlandObserver.observe(host);
  }
}

export function watchLocalDay(change: () => void): void {
  let timer = 0;
  let day = new Date().toDateString();
  function refresh() {
    clearTimeout(timer);
    const now = new Date();
    const key = now.toDateString();
    if (day !== key) {
      day = key;
      change();
    }
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = window.setTimeout(refresh, midnight.getTime() - now.getTime());
  }
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('pagehide', () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('focus', refresh);
  }, { once: true });
  refresh();
}
