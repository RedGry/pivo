import assert from 'node:assert/strict';
import test from 'node:test';
import { countryHolidays, eventsOn } from './calendar-holidays.ts';
import { calendarHolidayIcon } from '../../presentation/calendar-holiday-icons.ts';
import { holidays } from '../../presentation/holidays.ts';
import { moveTask } from './task-reorder.ts';

test('country filtering separates local calendars and retains shared dates', () => {
  assert.deepEqual(countryHolidays(new Date(2026, 10, 26), 'us').map(([id]) => id), ['thanksgiving']);
  assert.deepEqual(countryHolidays(new Date(2026, 10, 26), 'ru'), []);
  assert.deepEqual(countryHolidays(new Date(2026, 0, 1), 'ru').map(([id]) => id), ['newYear']);
  assert.deepEqual(countryHolidays(new Date(2026, 0, 1), 'custom-country'), []);
});

test('custom country holidays recur independently of one-time events', () => {
  const holiday = { id: 'a', date: '2026-11-03', title: 'Holiday', country: 'custom-country', icon: 'gift' } as const;
  const appointment = { id: 'b', date: '2026-11-03', title: 'Appointment' };
  assert.deepEqual(eventsOn([holiday, appointment], '2027-11-03', 'custom-country'), [holiday]);
  assert.deepEqual(eventsOn([holiday, appointment], '2026-11-03', 'ru'), [appointment]);
});

test('each built-in holiday has its own glyph', () => {
  assert.equal(new Set(holidays.map(([id]) => calendarHolidayIcon(id))).size, holidays.length);
});

test('drag reorder moves tasks in either direction without modifying their values', () => {
  const items = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, done: index % 2 === 0 }));
  assert.deepEqual(moveTask(items, 'a', 2).map(item => item.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveTask(items, 'd', 0).map(item => item.id), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveTask(items, 'missing', 0), items);
  assert.deepEqual(items.map(item => item.id), ['a', 'b', 'c', 'd']);
});

test('holiday dates use colored icons even when the text is monochrome', () => {
  const strokes = new Set(holidays.map(([id]) => /stroke="(#[0-9a-f]+)"/i.exec(calendarHolidayIcon(id))?.[1]));
  assert.equal(strokes.size, holidays.length);
  assert.match(calendarHolidayIcon('halloween'), /stroke="#ffa366"/);
  assert.match(calendarHolidayIcon('halloween', true), /stroke="currentColor"/);
});