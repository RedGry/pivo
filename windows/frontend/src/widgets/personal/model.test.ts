import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarDays, dayKey, nextTask, snoozeTask, totalWater, waterForDay, waterSlot } from './model.ts';

test('calendar aligns weeks and includes adjacent dates across the year boundary', () => {
  const date = new Date(2026, 0, 1);
  const month = calendarDays(date, true, false);
  assert.equal(dayKey(month[0]), '2025-12-29');
  assert.equal(month.length, 42);
  assert.equal(dayKey(calendarDays(date, false, true)[0]), '2025-12-28');
});

test('completed tasks are skipped and overdue tasks snooze from now', () => {
  const task = { id: 'a', title: 'A', due: 10, done: false };
  const future = { id: 'b', title: 'B', due: 200, done: false };
  assert.equal(nextTask([{ ...task, done: true }, future]), future);
  assert.equal(snoozeTask(task, 100, 5).due, 300100);
  assert.equal(snoozeTask(future, 100, 5).due, 300200);
});

test('water keeps recorded serving amounts until the local day changes', () => {
  const state = { goal: 2000, serving: 300, day: '2026-11-02', servings: [250, 300] };
  assert.equal(totalWater(waterForDay(state, '2026-11-02')), 550);
  assert.deepEqual(waterForDay(state, '2026-11-03'), { ...state, day: '2026-11-03', servings: [] });
});

test('water reminders schedule one slot at a time during active hours', () => {
  const state = { goal: 1000, serving: 250, day: '2026-11-02', servings: [], reminders: true, from: '08:00', until: '12:00' };
  const first = new Date(2026, 10, 2, 8, 0);
  const second = new Date(2026, 10, 2, 9, 0);
  assert.deepEqual(waterSlot(state, new Date(2026, 10, 2, 7, 0)), { current: null, next: first.getTime() });
  assert.deepEqual(waterSlot(state, first), { current: 0, next: second.getTime() });
  assert.deepEqual(waterSlot({ ...state, notifiedSlot: 1 }, first), { current: null, next: second.getTime() });
  assert.equal(waterSlot({ ...state, servings: [1000] }, second), null);
  assert.equal(waterSlot(state, new Date(2026, 10, 2, 12, 1)), null);
});
