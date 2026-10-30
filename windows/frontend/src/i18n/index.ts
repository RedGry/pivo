import { translate, type Catalog, type TranslationKey } from './catalog.ts';

const files = import.meta.glob<Catalog>('../../../../locales/*.json', { eager: true, import: 'default' });
const catalogs = Object.fromEntries(Object.entries(files).map(([path, catalog]) => [
  path.split('/').pop()!.replace(/\.json$/, ''), catalog,
]));
let current = 'en';

export const locales = Object.entries(catalogs).map(([id, catalog]) => ({ id, name: catalog.name }));
export const locale = () => current;
export const t = (key: TranslationKey, parameters?: Record<string, string | number>) =>
  translate(catalogs, current, key, parameters);

export function setLocale(id: string): void {
  current = Object.hasOwn(catalogs, id) ? id : 'en';
  document.documentElement.lang = current;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n as TranslationKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(element => {
    element.setAttribute('aria-label', t(element.dataset.i18nAria as TranslationKey));
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(element => {
    element.title = t(element.dataset.i18nTitle as TranslationKey);
  });
}

