export function dayKey(date = new Date()): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-');
}

export function calendarDays(date: Date, monday: boolean, week: boolean): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), week ? date.getDate() : 1);
  first.setDate(first.getDate() - (first.getDay() + (monday ? 6 : 0)) % 7);
  return Array.from({ length: week ? 7 : 42 }, (_, index) =>
    new Date(first.getFullYear(), first.getMonth(), first.getDate() + index));
}

export interface Task { id: string; title: string; due: number | null; done: boolean }

export function nextTask(tasks: Task[]): Task | undefined {
  return tasks.filter(task => !task.done).sort((a, b) =>
    (a.due ?? Infinity) - (b.due ?? Infinity))[0];
}

export function snoozeTask(task: Task, now: number, minutes: number): Task {
  return { ...task, due: Math.max(task.due ?? now, now) + minutes * 60_000 };
}

export interface Water { goal: number; serving: number; day: string; servings: number[]; reminders?: boolean; from?: string; until?: string; notifiedSlot?: number }

export function waterForDay(state: Water, day: string): Water {
  if (state.day === day) return state;
  const { notifiedSlot: _, ...settings } = state;
  return { ...settings, day, servings: [] };
}

export function totalWater(state: Water): number {
  return state.servings.reduce((sum, amount) => sum + amount, 0);
}

export function waterSlot(state: Water, now: Date): { current: number | null; next: number } | null {
  if (!state.reminders || totalWater(state) >= state.goal) return null;
  const start = wallTime(now, state.from ?? '08:30');
  const end = wallTime(now, state.until ?? '17:00');
  const servings = Math.ceil(state.goal / state.serving);
  if (end <= start || servings < 1) return null;
  const interval = (end - start) / servings;
  const current = Math.min(servings - 1, Math.floor((now.getTime() - start) / interval));
  if (now.getTime() >= end) return null;
  return {
    current: current >= 0 && current > (state.notifiedSlot ?? -1) ? current : null,
    next: Math.ceil(start + Math.max(0, current + 1) * interval)
  };
}

function wallTime(day: Date, time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes).getTime();
}
