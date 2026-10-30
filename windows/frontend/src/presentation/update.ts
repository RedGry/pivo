import { locale, t } from '../i18n/index.ts';
import type { TranslationKey } from '../i18n/catalog.ts';

export interface UpdateStatus {
  revision: number;
  automatic: boolean;
  installed: boolean;
  busy: boolean;
  version: string | null;
  notes: string;
  message: string;
  detail: string;
  progress: number | null;
  deferred: boolean;
}

export function updateText(update: UpdateStatus): string {
  const progress = update.progress === null ? ''
    : ` ${new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(update.progress / 100)}`;
  return t(update.message as TranslationKey, { version: update.version ?? '' })
    + progress;
}
