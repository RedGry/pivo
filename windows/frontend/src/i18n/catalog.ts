import english from '../../../../locales/en.json' with { type: 'json' };

export type TranslationKey = keyof typeof english.messages;
export interface Catalog {
  name: string;
  messages: Partial<Record<TranslationKey, string>>;
}

export function translate(
  catalogs: Record<string, Catalog>,
  locale: string,
  key: TranslationKey,
  parameters: Record<string, string | number> = {},
): string {
  const text = catalogs[locale]?.messages[key] ?? english.messages[key];
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    parameters[name] === undefined ? placeholder : String(parameters[name]));
}
