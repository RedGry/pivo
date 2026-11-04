import { widgets as media } from './media/index.ts';
import { widgets as personal } from './personal/index.ts';
import { widgets as shelf } from './shelf/index.ts';
import { t } from '../i18n/index.ts';
import type { TranslationKey } from '../i18n/catalog.ts';

export const widgets = [...media, ...personal, ...shelf];
export const widgetTitle = (id: string) => t(('widgets.' + id) as TranslationKey);
export const widgetEnabled = (id: string) => localStorage.getItem('pivo.widget.enabled.' + id) !== 'false';
export function setWidgetEnabled(id: string, enabled: boolean): void {
  localStorage.setItem('pivo.widget.enabled.' + id, String(enabled));
}
