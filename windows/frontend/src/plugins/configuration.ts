import type { Localized } from './model.ts';

interface SettingBase { key: string; label?: Localized; labelKey?: 'plugins.focusMinutes' | 'plugins.breakMinutes' }
export interface NumberSetting extends SettingBase { type: 'number'; bind: 'seconds' | 'breakSeconds'; unit: 'seconds' | 'minutes'; default: number; min: number; max: number }
export interface TextSetting extends SettingBase { type: 'text'; bind: 'text'; default: string; maxLength: number }
export type Setting = NumberSetting | TextSetting;
export type Values = Record<string, string | number>;
const validKey = (key: unknown): key is string => typeof key === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(key)
  && !['constructor', 'prototype', '__proto__'].includes(key);

export function parseSettings(raw: unknown, kind: 'timer' | 'information', localized: (value: unknown) => value is Localized): Setting[] {
  if (!Array.isArray(raw) || raw.length > 12) throw new Error('Invalid plugin settings');
  const keys = new Set<string>();
  const bindings = new Set<string>();
  return raw.map(value => {
    if (!value || typeof value !== 'object') throw new Error('Invalid plugin setting');
    const item = value as Record<string, unknown>;
    if (!validKey(item.key) || keys.has(item.key) || !localized(item.label) || Object.hasOwn(item, 'labelKey')) throw new Error('Invalid plugin setting label or key');
    keys.add(item.key);
    const base = { key: item.key, label: item.label };
    if (kind === 'information' && item.type === 'text' && item.bind === 'text') {
      if (!Number.isInteger(item.maxLength) || (item.maxLength as number) < 1 || (item.maxLength as number) > 500
        || typeof item.default !== 'string' || item.default.length > (item.maxLength as number)) throw new Error('Invalid text setting');
      return { ...base, type: 'text', bind: 'text', default: item.default, maxLength: item.maxLength as number };
    }
    if (kind !== 'timer' || item.type !== 'number' || !['seconds', 'breakSeconds'].includes(String(item.bind))
      || !['seconds', 'minutes'].includes(String(item.unit)) || bindings.has(String(item.bind))) throw new Error('Invalid setting binding');
    bindings.add(String(item.bind));
    const scale = item.unit === 'minutes' ? 60 : 1;
    if (![item.min, item.max, item.default].every(Number.isInteger) || (item.min as number) < 1
      || (item.max as number) * scale > 86400 || (item.min as number) > (item.default as number)
      || (item.default as number) > (item.max as number)) throw new Error('Invalid number setting');
    return { ...base, type: 'number', bind: item.bind as NumberSetting['bind'], unit: item.unit as NumberSetting['unit'],
      default: item.default as number, min: item.min as number, max: item.max as number };
  });
}

function validValue(field: Setting, value: unknown): value is string | number {
  return field.type === 'number' ? Number.isInteger(value) && (value as number) >= field.min && (value as number) <= field.max
    : typeof value === 'string' && value.length <= field.maxLength;
}
export function configuration(fields: Setting[] = [], raw?: unknown, strict = false): Values {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Values : {};
  if (strict && Object.keys(source).some(key => !fields.some(field => field.key === key))) throw new Error('Unknown setting');
  return Object.fromEntries(fields.map(field => {
    const value: unknown = Object.hasOwn(source, field.key) ? source[field.key] : field.default;
    if (!validValue(field, value) && strict) throw new Error('Invalid setting value');
    return [field.key, validValue(field, value) ? value : field.default];
  }));
}
