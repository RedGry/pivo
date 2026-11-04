import type { CalendarHolidayIcon } from '../presentation/calendar-holiday-icons.ts';
export type IslandPreview =
  | { kind: 'intake'; servings: number[]; goal: number }
  | { kind: 'todo'; done: number; total: number; items: { id: string; title: string; done: boolean }[] }
  | { kind: 'list'; items: string[] }
  | { kind: 'week'; days: { label: string; date: number; today: boolean; holiday?: string; holidayIcons?: CalendarHolidayIcon[] }[] }
  | { kind: 'status'; items: string[] };

export interface Widget {
  id: string;
  mount(container: HTMLElement, refresh: () => void): () => void;
  summary(): string;
  detail?(): string;
  islandPreview?(): IslandPreview;
  subscribe?(refresh: () => void): () => void;
  primary?(): void | Promise<void>;
  secondary?(): void | Promise<void>;
  primaryLabel?(): string;
  secondaryLabel?(): string;
  primaryEnabled?(): boolean;
  secondaryEnabled?(): boolean;
  actionKey?(): string | undefined;
}
