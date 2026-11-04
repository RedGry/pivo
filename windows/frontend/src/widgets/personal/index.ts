import { mountTaskReorder, moveTask } from './task-reorder.ts';
import { calendarHolidayIcon, customHolidayIcons, type CalendarHolidayIcon, type CustomHolidayIcon } from '../../presentation/calendar-holiday-icons.ts';
import { builtinHolidayCountries, countryHolidays, eventsOn, type CalendarEvent } from './calendar-holidays.ts';
import type { Notice } from '../notice.ts';
import { locale, t } from '../../i18n/index.ts';
import type { TranslationKey } from '../../i18n/catalog.ts';
import type { Widget } from '../types.ts';
import { calendarDays, dayKey, nextTask, snoozeTask, totalWater, waterForDay, waterSlot, type Task, type Water } from './model.ts';
import './style.css';

function storage<T>(name: string, initial: () => T) {
  const key = 'pivo.personal.' + name;
  return {
    read(): T {
      try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T ?? initial(); }
      catch { return initial(); }
    },
    write(value: T) {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new Event(key));
    },
    subscribe(refresh: () => void) {
      const changed = (event: StorageEvent) => { if (event.key === key || event.key === null) refresh(); };
      window.addEventListener('storage', changed);
      window.addEventListener(key, refresh);
      return () => {
        window.removeEventListener('storage', changed);
        window.removeEventListener(key, refresh);
      };
    }
  };
}

function button(label: string, action: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'primary-button';
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function field(label: TranslationKey, control: HTMLElement): HTMLLabelElement {
  const element = document.createElement('label');
  const name = document.createElement('span');
  name.textContent = t(label);
  element.append(name, control);
  return element;
}

function groupedFields(...fields: HTMLLabelElement[]): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'widget-rows';
  group.append(...fields);
  return group;
}

function numberField(label: TranslationKey, value: number, min: number, max: number, onChange: (value: number) => void, current = () => value) {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.required = true;
  input.addEventListener('change', () => {
    if (input.reportValidity()) onChange(input.valueAsNumber);
    else input.value = String(current());
  });
  return field(label, input);
}

function selection<T extends string>(label: TranslationKey, options: [T, string][], value: T, change: (value: T) => void) {
  const select = document.createElement('select');
  for (const [key, text] of options) select.add(new Option(text, key, false, value === key));
  select.addEventListener('change', () => change(select.value as T));
  return field(label, select);
}

function mounted(container: HTMLElement, render: () => void, subscribe: (change: () => void) => () => void, refresh: () => void) {
  container.classList.add('personal-widget');
  render();
  const unsubscribe = subscribe(() => { render(); refresh(); });
  return () => { unsubscribe(); container.classList.remove('personal-widget'); container.replaceChildren(); };
}

function personalMotion() {
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map<HTMLElement, { animation: Animation; finish: () => void }>();
  const reduced = () => media.matches || document.documentElement.hasAttribute('data-reduced-motion');
  const settle = () => {
    for (const [element, entry] of active) { active.delete(element); entry.animation.cancel(); entry.finish(); }
  };
  const changed = () => { if (reduced()) settle(); };
  media.addEventListener('change', changed);
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });
  return {
    cancel(element: HTMLElement) { active.get(element)?.animation.cancel(); active.delete(element); },
    play(element: HTMLElement, frames: Keyframe[], finish = () => {}) {
      active.get(element)?.animation.cancel();
      active.delete(element);
      if (reduced()) { finish(); return; }
      const animation = element.animate(frames, { duration: 300, easing: 'cubic-bezier(.2,0,.2,1)' });
      active.set(element, { animation, finish });
      void animation.finished.then(() => {
        if (active.get(element)?.animation !== animation) return;
        active.delete(element); finish();
      }, () => {});
    },
    dispose() { observer.disconnect(); media.removeEventListener('change', changed); settle(); },
  };
}

const tasks = storage('tasks', () => ({ items: [] as Task[], snooze: 10, reminders: false }));
function updateTask(id: string, update: (task: Task) => Task) {
  const state = tasks.read();
  tasks.write({ ...state, items: state.items.map(task => task.id === id ? update(task) : task) });
}
export function toggleTaskDone(id: string): void {
  updateTask(id, task => ({ ...task, done: !task.done }));
}
const tasksWidget: Widget = {
  id: 'tasks',
  subscribe: tasks.subscribe,
  summary: () => nextTask(tasks.read().items)?.title ?? t('personal.noTasks'),
  islandPreview: () => {
    const { items } = tasks.read();
    const open = items.filter(task => !task.done);

    return {
      kind: 'todo', done: items.length - open.length, total: items.length,
      items: items.slice(0, 2),
    };
  },
  detail: () => {
    const state = tasks.read();
    const task = nextTask(state.items);
    return task?.due != null && task.due <= Date.now()
      ? t('personal.overdue')
      : t('personal.openTasks', { count: state.items.filter(item => !item.done).length });
  },
  mount(container, refresh) {
    const form = document.createElement('form');
    form.className = 'task-editor';
    const title = document.createElement('input');
    title.required = true;
    title.maxLength = 160;
    const due = document.createElement('input');
    due.type = 'datetime-local';
    let editing: string | null = null;
    const add = document.createElement('button');
    add.className = 'primary-button';
    add.textContent = t('personal.add');
    add.type = 'submit';
    const cancel = button(t('personal.cancelEdit'), resetForm);
    function resetForm() {
      editing = null;
      form.reset();
      add.textContent = t('personal.add');
      if (cancel.contains(document.activeElement)) title.focus();
      cancel.hidden = true;
      cancel.inert = true;
    }
    cancel.hidden = true;
    cancel.inert = true;
    const formActions = document.createElement('div');
    formActions.className = 'personal-form-actions';
    formActions.append(add, cancel);
    form.append(field('personal.task', title), field('personal.due', due), formActions);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const name = title.value.trim();
      if (!name) return;
      const date = due.value ? new Date(due.value).getTime() : null;
      if (date !== null && !Number.isFinite(date)) return;
      if (editing !== null) {
        updateTask(editing, task => ({ ...task, title: name, due: date }));
      } else {
        const state = tasks.read();
        tasks.write({ ...state, items: [...state.items, { id: crypto.randomUUID(), title: name, due: date, done: false }] });
      }
      resetForm();
      title.focus();
    });
    const list = document.createElement('ul');
    list.className = 'task-list';
    const settings = document.createElement('div');
    settings.className = 'widget-rows';
    const initial = tasks.read();
    const reminders = toggle('personal.taskReminders', initial.reminders, reminders => tasks.write({ ...tasks.read(), reminders }));
    const snooze = numberField('personal.snoozeMinutes', initial.snooze, 1, 120,
      snooze => tasks.write({ ...tasks.read(), snooze }), () => tasks.read().snooze);
    settings.append(reminders, snooze);
    const motion = personalMotion();
    const rows = new Map<string, { row: HTMLLIElement; update: (task: Task) => void; present: boolean }>();
    let painted = false;
    container.replaceChildren(settings, list, form);
    const stopReorder = mountTaskReorder(list, (id, target) => {
      const state = tasks.read();
      tasks.write({ ...state, items: moveTask(state.items, id, target) });
    });
    return mounted(container, () => {
      const state = tasks.read();
      const reminderInput = reminders.querySelector('input')!;
      if (document.activeElement !== reminderInput) reminderInput.checked = state.reminders;
      const snoozeInput = snooze.querySelector('input')!;
      if (document.activeElement !== snoozeInput) snoozeInput.value = String(state.snooze);
      for (const [id, entry] of rows) {
        if (!entry.present || state.items.some(task => task.id === id)) continue;
        entry.present = false; entry.row.inert = true;
        const style = getComputedStyle(entry.row);
        motion.play(entry.row, [
          { height: `${entry.row.getBoundingClientRect().height}px`, opacity: style.opacity,
            paddingBlock: style.paddingBlock, borderWidth: style.borderWidth, marginBottom: style.marginBottom, overflow: 'hidden' },
          { height: '0px', opacity: 0, paddingBlock: '0px', borderWidth: '0px', marginBottom: '0px', overflow: 'hidden' },
        ], () => { entry.row.remove(); rows.delete(id); });
      }
      state.items.forEach((task, index) => {
        const existing = rows.get(task.id);
        if (existing) {
          existing.update(task);
          if (!existing.present) {
            existing.present = true; existing.row.inert = false;
            const height = existing.row.getBoundingClientRect().height;
            const style = getComputedStyle(existing.row);
            const from = { height: `${height}px`, opacity: style.opacity, paddingBlock: style.paddingBlock,
              borderWidth: style.borderWidth, marginBottom: style.marginBottom, overflow: 'hidden' };
            motion.cancel(existing.row);
            motion.play(existing.row, [from,
              { height: `${existing.row.getBoundingClientRect().height}px`, opacity: 1, overflow: 'hidden' }]);
          }
          const before = [...list.children].filter(row => !(row as HTMLElement).inert)[index];
          if (before !== existing.row) list.insertBefore(existing.row, before ?? null);
          return;
        }
        const row = document.createElement('li');
        const done = document.createElement('input');
        done.type = 'checkbox';
        done.checked = task.done;
        done.addEventListener('change', () => updateTask(task.id, value => ({ ...value, done: done.checked })));
        const label = document.createElement('label');
        const name = document.createElement('span');
        name.textContent = task.title;
        label.append(done, name);
        const date = document.createElement('small');
        if (task.due !== null) date.textContent = new Date(task.due).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' });
        const edit = button(t('personal.editTask'), () => {
          const latest = tasks.read().items.find(item => item.id === task.id);
          if (!latest) return;
          editing = task.id;
          title.value = latest.title;
          const date = latest.due === null ? null : new Date(latest.due);
          due.value = date === null ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
          add.textContent = t('plugins.saveSettings');
          cancel.hidden = false;
          cancel.inert = false;
          title.focus();
        });
        row.dataset.done = String(task.done);
        row.dataset.taskId = task.id;
        const drag = document.createElement('button');
        drag.type = 'button';
        drag.draggable = true;
        drag.className = 'task-drag-handle';
        drag.setAttribute('aria-label', t('personal.reorderTask', { title: task.title }));
        drag.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h.01M10 3h.01M6 8h.01M10 8h.01M6 13h.01M10 13h.01"/></svg>';
        const info = document.createElement('div');
        info.className = 'task-info';
        info.append(label);
        info.append(date);
        const actions = document.createElement('div');
        actions.className = 'task-actions';
        actions.append(edit);
        row.append(drag, info, actions);
        const snoozeAction = button(t('personal.snoozeShort'), () => {
          updateTask(task.id, value => snoozeTask(value, Date.now(), tasks.read().snooze));
        });
        actions.append(snoozeAction);
        actions.append(button(t('personal.remove'), () => {
          if (editing === task.id) resetForm();
          const current = tasks.read();
          tasks.write({ ...current, items: current.items.filter(item => item.id !== task.id) });
        }));
        const update = (value: Task) => {
          done.checked = value.done; name.textContent = value.title;
          date.textContent = value.due === null ? '' : new Date(value.due).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' });
          date.hidden = value.due === null; snoozeAction.hidden = value.done;
          row.dataset.done = String(value.done);
          drag.setAttribute('aria-label', t('personal.reorderTask', { title: value.title }));
        };
        update(task);
        rows.set(task.id, { row, update, present: true });
        const before = [...list.children].filter(row => !(row as HTMLElement).inert)[index];
        list.insertBefore(row, before ?? null);
        if (painted) motion.play(row, [{ opacity: 0, height: '0px', paddingBlock: '0px', borderWidth: '0px', marginBottom: '0px', overflow: 'hidden' },
          { opacity: 1, height: `${row.getBoundingClientRect().height}px`, overflow: 'hidden' }]);
      });
      painted = true;
    }, change => {
      const stop = tasks.subscribe(change);
      return () => { stop(); stopReorder(); motion.dispose(); };
    }, refresh);
  }
};

const calendar = storage('calendar', () => ({ start: 'monday' as 'monday' | 'sunday', view: 'month' as 'month' | 'week' }));
const calendarEvents = storage('calendar-events', () => [] as CalendarEvent[]);
const calendarCountries = storage('calendar-countries', () => ({
  filter: 'all', custom: [] as { id: string; name: string }[],
}));

function countryOptions(): [string, string][] {
  const names = new Intl.DisplayNames([locale()], { type: 'region' });
  return [
    ...builtinHolidayCountries.map((id): [string, string] => [
      id, id === 'world' ? t('personal.calendarWorld') : names.of(id.toUpperCase()) ?? id.toUpperCase(),
    ]),
    ...calendarCountries.read().custom.map(({ id, name }): [string, string] => [id, name]),
  ];
}

function calendarEntries(date: Date, country = calendarCountries.read().filter, events = calendarEvents.read()) {
  const holidays = countryHolidays(date, country).map(([id]) => ({ icon: id, title: t(`holidays.${id}`) }));
  const personal = eventsOn(events, dayKey(date), country);
  return { holidays, personal };
}

function holidayIcon(icon: CalendarHolidayIcon): HTMLElement {
  const element = document.createElement('span');
  element.className = 'calendar-holiday-icon';
  element.innerHTML = calendarHolidayIcon(icon);
  return element;
}

const calendarWidget: Widget = {
  id: 'calendar',
  subscribe: change => {
    const stopCalendar = calendar.subscribe(change);
    const stopEvents = calendarEvents.subscribe(change);
    const stopCountries = calendarCountries.subscribe(change);
    return () => { stopCalendar(); stopEvents(); stopCountries(); };
  },
  summary: () => new Date().toLocaleDateString(locale(), { month: 'long', day: 'numeric' }),
  detail: () => {
    const today = new Date();
    const { holidays, personal } = calendarEntries(today);
    return [...holidays, ...personal].map(entry => entry.title).join(', ')
      || today.toLocaleDateString(locale(), { weekday: 'long' });
  },
  islandPreview: () => {
    const today = new Date();
    const weekday = new Intl.DateTimeFormat(locale(), { weekday: 'narrow' });
    return {
      kind: 'week',
      days: calendarDays(today, calendar.read().start === 'monday', true).map(date => {
        const { holidays, personal } = calendarEntries(date);
        return {
          label: weekday.format(date),
          date: date.getDate(),
          today: dayKey(date) === dayKey(today),
          holiday: [...holidays, ...personal].map(entry => entry.title).join(', ') || undefined,
          holidayIcons: [...holidays.map(entry => entry.icon),
            ...personal.filter(entry => entry.country).map(entry => entry.icon ?? 'star' as const)],
        };
      }),
    };
  },
  mount(container, refresh) {
    let current = new Date();
    const motion = personalMotion();
    let previewHost: HTMLElement | undefined;
    let gridStage: HTMLElement;
    let visibleGrid: HTMLElement;
    let eventEditor: { title: HTMLInputElement; date: HTMLInputElement };
    let retainedControls: HTMLElement;
    let retainedCountrySettings: HTMLElement;
    let retainedEventForm: HTMLElement;
    let retainedSettings: HTMLElement;
    let retainedEvents: HTMLElement;
    function updateIconVisibility(field: HTMLElement, country: HTMLSelectElement) {
      const hidden = !country.value;
      if (hidden && field.contains(document.activeElement)) country.focus();
      field.hidden = hidden;
      field.inert = hidden;
    }
    function render() {
      const state = calendar.read();
      const week = state.view === 'week';
      const title = document.createElement('h2');
      title.textContent = current.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
      const controls = document.createElement('div');
      controls.className = 'personal-calendar-controls';
      function navigate(offset: number) {
        if (calendar.read().view === 'week') current.setDate(current.getDate() + offset * 7);
        else current = new Date(current.getFullYear(), current.getMonth() + offset, 1);
        render();
      }
      const previous = button('←', () => navigate(-1));
      const next = button('→', () => navigate(1));
      previous.classList.add('calendar-arrow');
      next.classList.add('calendar-arrow');
      previous.setAttribute('aria-label', t(week ? 'personal.previousWeek' : 'personal.previousMonth'));
      next.setAttribute('aria-label', t(week ? 'personal.nextWeek' : 'personal.nextMonth'));
      controls.append(previous, title, next, button(t('personal.today'), () => { current = new Date(); render(); }));
      const jump = document.createElement('input');
      jump.type = 'date';
      jump.value = dayKey(current);
      jump.addEventListener('change', () => {
        const date = new Date(`${jump.value}T12:00:00`);
        if (!Number.isFinite(date.getTime())) return;
        current = date;
        render();
      });
      controls.append(field('personal.calendarJump', jump));
      const grid = document.createElement('div');
      grid.className = 'personal-calendar-grid';
      const days = calendarDays(current, state.start === 'monday', week);
      for (const date of days.slice(0, 7)) {
        const weekday = document.createElement('b');
        weekday.textContent = date.toLocaleDateString(locale(), { weekday: 'short' });
        grid.append(weekday);
      }
      const today = dayKey();
      const dueByDay = new Map<string, string[]>();
      for (const task of tasks.read().items) {
        if (task.done || task.due === null) continue;
        const key = dayKey(new Date(task.due));
        dueByDay.set(key, [...(dueByDay.get(key) ?? []), task.title]);
      }
      const savedEvents = calendarEvents.read();
      const countryState = calendarCountries.read();
      const countries = countryOptions();
      const countrySettings = document.createElement('div');
      countrySettings.className = 'calendar-country-settings';
      const filter = selection('personal.calendarCountry', [['all', t('personal.calendarAllCountries')], ...countries],
        countryState.filter, filter => calendarCountries.write({ ...calendarCountries.read(), filter }));
      const countryForm = document.createElement('form');
      const countryName = document.createElement('input');
      countryName.required = true;
      countryName.maxLength = 64;
      const addCountry = document.createElement('button');
      addCountry.type = 'submit';
      addCountry.className = 'primary-button';
      addCountry.textContent = t('personal.calendarAddCountry');
      countryForm.append(field('personal.calendarCountryName', countryName), addCountry);
      countryForm.addEventListener('submit', event => {
        event.preventDefault();
        const name = countryName.value.trim();
        if (!name || countryOptions().some(([, label]) => label.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
        const id = crypto.randomUUID();
        const current = calendarCountries.read();
        calendarCountries.write({ filter: id, custom: [...current.custom, { id, name }] });
        countryName.value = '';
      });
      countrySettings.append(filter, countryForm);
      const eventForm = document.createElement('form');
      eventForm.className = 'calendar-event-form';
      const eventTitle = document.createElement('input');
      eventTitle.required = true;
      eventTitle.maxLength = 160;
      const eventDate = document.createElement('input');
      eventDate.type = 'date';
      eventDate.required = true;
      eventDate.value = dayKey(current);
      const create = document.createElement('button');
      create.type = 'submit';
      create.className = 'primary-button';
      create.textContent = t('personal.calendarAdd');
      const eventCountry = document.createElement('select');
      eventCountry.add(new Option(t('personal.calendarPersonal'), ''));
      for (const [id, name] of countries) eventCountry.add(new Option(name, id));
      eventCountry.value = countryState.filter === 'all' ? '' : countryState.filter;
      const eventIcon = document.createElement('select');
      for (const icon of customHolidayIcons) eventIcon.add(new Option(t(`personal.calendarIcon.${icon}`), icon));
      const iconField = field('personal.calendarIcon', eventIcon);
      iconField.className = 'calendar-icon-field';
      eventCountry.addEventListener('change', () => updateIconVisibility(iconField, eventCountry));
      updateIconVisibility(iconField, eventCountry);
      eventForm.append(field('personal.calendarEvent', eventTitle), field('personal.calendarDate', eventDate),
        field('personal.calendarEventCountry', eventCountry), iconField, create);
      eventForm.addEventListener('submit', event => {
        event.preventDefault();
        const title = eventTitle.value.trim();
        const date = new Date(`${eventDate.value}T12:00:00`);
        if (!title || !Number.isFinite(date.getTime())) return;
        current = date;
        calendarEvents.write([...calendarEvents.read(), {
          id: crypto.randomUUID(), date: dayKey(date), title,
          country: eventCountry.value || undefined,
          icon: eventCountry.value ? eventIcon.value as CustomHolidayIcon : undefined,
        }]);
        eventTitle.value = '';
      });
      const events = document.createElement('ul');
      events.className = 'personal-holiday-events';
      for (const date of days) {
        const day = document.createElement('button');
        day.type = 'button';
        day.className = 'calendar-day';
        day.dataset.date = dayKey(date);
        day.addEventListener('click', () => {
          eventEditor.date.value = dayKey(date);
          eventEditor.title.focus();
        });
        day.textContent = String(date.getDate());
        day.classList.toggle('other-month', date.getMonth() !== current.getMonth());
        day.title = date.toLocaleDateString(locale(), { dateStyle: 'full' });
        const key = dayKey(date);
        if (key === today) day.setAttribute('aria-current', 'date');
        day.classList.toggle('calendar-selected', key === dayKey(current));
        const titles = dueByDay.get(key);
        if (titles) {
          day.classList.add('has-tasks');
          day.title += ': ' + titles.join(', ');
          day.tabIndex = 0;
          day.setAttribute('aria-label', day.title);
        }
        const { holidays, personal: personalEvents } = calendarEntries(date, countryState.filter, savedEvents);
        const entries = [...holidays, ...personalEvents];
        if (entries.length) day.title += ' · ' + entries.map(entry => entry.title).join(', ');
        if (personalEvents.length) day.classList.add('has-event');
        const icons = [...holidays.map(entry => entry.icon),
          ...personalEvents.filter(entry => entry.country).map(entry => entry.icon ?? 'star' as const)];
        if (icons.length) {
          day.classList.add('has-holiday');
          day.append(...icons.slice(0, 2).map(holidayIcon));
        }
        if (week || date.getMonth() === current.getMonth()) {
          for (const entry of holidays) {
            const event = document.createElement('li');
            event.dataset.eventId = `${key}:${entry.icon}`;
            const label = document.createElement('strong');
            label.textContent = date.toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
            event.append(label, holidayIcon(entry.icon), entry.title);
            events.append(event);
          }
          for (const entry of personalEvents) {
            const event = document.createElement('li');
            event.dataset.eventId = entry.id;
            const label = document.createElement('strong');
            label.textContent = date.toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
            const name = document.createElement('span');
            name.textContent = entry.title;
            const remove = button(t('personal.remove'), () => {
              calendarEvents.write(calendarEvents.read().filter(item => item.id !== entry.id));
            });
            event.append(label);
            if (entry.country) event.append(holidayIcon(entry.icon ?? 'star'));
            event.append(name, remove);
            events.append(event);
          }
        }
        day.setAttribute('aria-label', day.title);
        grid.append(day);
      }
      const preview = document.createElement('section');
      preview.className = 'setting-group calendar-preview';
      preview.append(countrySettings, controls, grid, eventForm, events);
      const settings = groupedFields(
        selection('personal.weekStartsOn', [
          ['monday', new Date(2024, 0, 1).toLocaleDateString(locale(), { weekday: 'long' })],
          ['sunday', new Date(2024, 0, 7).toLocaleDateString(locale(), { weekday: 'long' })]
        ], state.start, start => calendar.write({ ...calendar.read(), start })),
        selection('personal.view', [['month', t('personal.month')], ['week', t('personal.week')]], state.view,
          view => calendar.write({ ...calendar.read(), view })));
      if (!previewHost) {
        previewHost = preview;
        eventEditor = { title: eventTitle, date: eventDate };
        retainedControls = controls; retainedCountrySettings = countrySettings;
        retainedEventForm = eventForm; retainedSettings = settings; retainedEvents = events;
        gridStage = document.createElement('div');
        gridStage.className = 'calendar-grid-stage';
        preview.insertBefore(gridStage, grid);
        gridStage.append(grid);
        visibleGrid = grid;
        container.replaceChildren(preview, settings);
        return;
      }
      retainedControls.querySelector('h2')!.textContent = title.textContent;
      const retainedJump = retainedControls.querySelector('input')!;
      if (document.activeElement !== retainedJump) retainedJump.value = jump.value;
      const previousArrows = retainedControls.querySelectorAll('button');
      [previous, next].forEach((source, index) => previousArrows[index]!.setAttribute('aria-label', source.getAttribute('aria-label')!));
      function updateOptions(target: HTMLSelectElement, source: HTMLSelectElement, value = target.value) {
        if ([...target.options].map(option => option.value).join() !== [...source.options].map(option => option.value).join()) {
          target.replaceChildren(...source.options);
        }
        target.value = [...target.options].some(option => option.value === value) ? value : '';
      }
      updateOptions(retainedCountrySettings.querySelector('select')!, filter.querySelector('select')!, countryState.filter);
      const selectedCountry = retainedEventForm.querySelector('select')!;
      updateOptions(selectedCountry, eventCountry);
      const retainedIconField = retainedEventForm.querySelector<HTMLElement>('.calendar-icon-field')!;
      updateIconVisibility(retainedIconField, selectedCountry);
      const settingSelects = retainedSettings.querySelectorAll('select');
      if (document.activeElement !== settingSelects[0]) settingSelects[0]!.value = state.start;
      if (document.activeElement !== settingSelects[1]) settingSelects[1]!.value = state.view;
      const oldGrid = visibleGrid;
      if (oldGrid.innerHTML !== grid.innerHTML) {
        const focusedDate = oldGrid.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.date : undefined;
        const height = gridStage.getBoundingClientRect().height;
        const opacity = getComputedStyle(oldGrid).opacity;
        oldGrid.inert = true;
        oldGrid.classList.add('calendar-grid-outgoing');
        gridStage.append(grid);
        visibleGrid = grid;
        const nextHeight = grid.getBoundingClientRect().height;
        motion.play(gridStage, [{ height: `${height}px`, overflow: 'hidden' }, { height: `${nextHeight}px`, overflow: 'hidden' }]);
        motion.play(oldGrid, [{ opacity }, { opacity: 0 }], () => oldGrid.remove());
        motion.play(grid, [{ opacity: 0 }, { opacity: 1 }]);
        if (focusedDate) grid.querySelector<HTMLElement>(`[data-date="${focusedDate}"]`)?.focus({ preventScroll: true });
      }
      if (retainedEvents.innerHTML !== events.innerHTML) {
        const previousEvents = new Map<string | undefined, Element>();
        for (const row of retainedEvents.children) {
          const element = row as HTMLElement;
          if (!previousEvents.has(element.dataset.eventId) || !element.inert) previousEvents.set(element.dataset.eventId, row);
        }
        const nextEvents = [...events.children].map(row => {
          const previous = previousEvents.get((row as HTMLElement).dataset.eventId);
          return previous?.innerHTML === row.innerHTML ? previous : row;
        });
        // Keep departing rows in their original slots while surviving rows settle.
        for (const row of [...retainedEvents.children]) if (!nextEvents.includes(row) && !(row as HTMLElement).inert) {
          const element = row as HTMLElement;
          element.inert = true;
          motion.play(element, [{ height: `${element.getBoundingClientRect().height}px`, opacity: getComputedStyle(element).opacity, overflow: 'hidden' },
            { height: '0px', opacity: 0, paddingBlock: '0px', borderWidth: '0px', marginBottom: '0px', overflow: 'hidden' }], () => element.remove());
        }
        nextEvents.forEach((row, index) => {
          const before = [...retainedEvents.children].filter(row => !(row as HTMLElement).inert)[index];
          if (before !== row) retainedEvents.insertBefore(row, before ?? null);
          const element = row as HTMLElement;
          if (element.inert || previousEvents.get(element.dataset.eventId) !== row) {
            const height = element.inert ? element.getBoundingClientRect().height : 0;
            const opacity = element.inert ? getComputedStyle(element).opacity : '0';
            element.inert = false;
            motion.cancel(element);
            motion.play(element, [{ height: `${height}px`, opacity, overflow: 'hidden' },
              { height: `${element.getBoundingClientRect().height}px`, opacity: 1, overflow: 'hidden' }]);
          }
        });
      }
    }
    return mounted(container, render, change => {
      const stopCalendar = calendar.subscribe(change);
      const stopTasks = tasks.subscribe(change);
      const stopEvents = calendarEvents.subscribe(change);
      const stopCountries = calendarCountries.subscribe(change);
      return () => { stopCalendar(); stopTasks(); stopEvents(); stopCountries(); motion.dispose(); };
    }, refresh);
  }
};

const water = storage<Water>('water', () => ({ goal: 2000, serving: 250, day: dayKey(), servings: [] }));
const todayWater = () => waterForDay(water.read(), dayKey());
function drink() {
  const state = todayWater();
  water.write({ ...state, servings: [...state.servings, state.serving] });
}
function undoDrink() {
  const state = todayWater();
  water.write({ ...state, servings: state.servings.slice(0, -1) });
}

const waterWidget: Widget = {
  id: 'water',
  islandPreview: () => {
    const state = todayWater();
    return { kind: 'intake', servings: state.servings, goal: state.goal };
  },
  subscribe: water.subscribe,
  summary() {
    const state = todayWater();
    return t('personal.waterProgress', { total: totalWater(state), goal: state.goal });
  },
  primary: drink,
  secondary: undoDrink,
  primaryLabel: () => t('personal.servingShort', { ml: todayWater().serving }),
  secondaryLabel: () => t('personal.undoShort'),
  secondaryEnabled: () => todayWater().servings.length > 0,
  mount(container, refresh) {
    const initial = todayWater();
    const goal = numberField('personal.goal', initial.goal, 100, 10_000, goal => water.write({ ...todayWater(), goal }), () => todayWater().goal);
    const serving = numberField('personal.serving', initial.serving, 10, 2000, serving => water.write({ ...todayWater(), serving }), () => todayWater().serving);
    const reminders = toggle('personal.waterReminders', Boolean(initial.reminders), reminders => water.write({ ...todayWater(), reminders }));
    const from = timeField('personal.activeFrom', initial.from ?? '08:30', value => water.write({ ...todayWater(), from: value }), () => todayWater().from ?? '08:30');
    const until = timeField('personal.activeUntil', initial.until ?? '17:00', value => water.write({ ...todayWater(), until: value }), () => todayWater().until ?? '17:00');
    const controls = [goal, serving, reminders, from, until].map(field => field.querySelector<HTMLInputElement>('input')!);
    const progress = document.createElement('progress');
    const status = document.createElement('p');
    const drinkButton = button('', drink);
    const undo = button(t('personal.undo'), undoDrink);
    const reset = button(t('personal.resetToday'), () => water.write({ ...todayWater(), servings: [] }));
    const actions = document.createElement('div');
    actions.className = 'personal-actions';
    actions.append(drinkButton, undo, reset);
    const intake = document.createElement('section');
    intake.className = 'setting-group water-intake';
    intake.append(status, progress, actions);
    container.replaceChildren(groupedFields(goal, serving, reminders, from, until), intake);
    function render(): void {
      const state = todayWater();
      progress.max = state.goal;
      progress.value = totalWater(state);
      progress.setAttribute('aria-label', waterWidget.summary());
      status.textContent = waterWidget.summary();
      drinkButton.textContent = t('personal.drink', { ml: state.serving });
      undo.disabled = reset.disabled = state.servings.length === 0;
      const values = [state.goal, state.serving, Boolean(state.reminders), state.from ?? '08:30', state.until ?? '17:00'];
      controls.forEach((control, index) => {
        if (control === document.activeElement) return;
        if (control.type === 'checkbox') control.checked = Boolean(values[index]);
        else control.value = String(values[index]);
      });
    }
    container.addEventListener('focusout', render);
    const dispose = mounted(container, render, water.subscribe, refresh);
    return () => { container.removeEventListener('focusout', render); dispose(); };
  }
};

export const widgets: Widget[] = [tasksWidget, calendarWidget, waterWidget];

function toggle(label: TranslationKey, checked: boolean, change: (checked: boolean) => void) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => change(input.checked));
  return field(label, input);
}

function timeField(label: TranslationKey, value: string, change: (value: string) => void, current = () => value) {
  const input = document.createElement('input');
  input.type = 'time';
  input.value = value;
  input.required = true;
  input.addEventListener('change', () => {
    if (input.reportValidity()) change(input.value);
    else input.value = current();
  });
  return field(label, input);
}

export function startPersonalReminders(notify: (...entries: Notice[]) => void): () => void {
  const delivered = storage('delivered', () => ({
    tasks: {} as Record<string, number>,
    water: null as { schedule: string; slot: number } | null,
  }));
  let timeout: ReturnType<typeof setTimeout> | undefined;
  // A queued refresh coalesces writes performed while recording a delivered reminder.
  const reschedule = () => {
    clearTimeout(timeout);
    timeout = setTimeout(check, 0);
  };
  function check() {
    const now = new Date();
    const timestamp = now.getTime();
    const taskState = tasks.read();
    const seen = delivered.read();
    const pending = taskState.reminders
      ? taskState.items.filter(task => !task.done && task.due !== null && seen.tasks[task.id] !== task.due)
      : [];
    const due = pending.filter(task => task.due! <= timestamp);
    const hydration = todayWater();
    const schedule = JSON.stringify([hydration.day, hydration.from, hydration.until, hydration.goal, hydration.serving]);
    const slot = waterSlot({ ...hydration, notifiedSlot: seen.water?.schedule === schedule ? seen.water.slot : -1 }, now);
    const messages: Notice[] = [];
    try {
      if (due.length || slot?.current != null) {
        const savedTasks = Object.fromEntries(taskState.items
          .filter(task => seen.tasks[task.id] !== undefined)
          .map(task => [task.id, seen.tasks[task.id]!]));
        for (const task of due) savedTasks[task.id] = task.due!;
        delivered.write({
          tasks: savedTasks,
          water: slot?.current == null ? seen.water : { schedule, slot: slot.current },
        });
      }
      if (due.length) {
        messages.push({ kind: 'tasks', text: t('personal.taskNotice', { title: due.map(task => task.title).join(', ') }) });
      }
      if (slot?.current != null) {
        messages.push({ kind: 'water', text: t('personal.waterNotice', { ml: hydration.serving }) });
      }
    } catch (error) {
      console.error('Unable to record widget reminder:', error);
    }
    if (messages.length) notify(...messages);
    clearTimeout(timeout);
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const next = Math.min(
      hydration.reminders ? midnight : Infinity,
      slot?.next ?? Infinity,
      ...pending.map(task => task.due! > timestamp ? task.due! : Infinity)
    );
    if (Number.isFinite(next)) timeout = setTimeout(check, Math.min(86_400_000, next - timestamp));
  }
  const stopTasks = tasks.subscribe(reschedule);
  const stopWater = water.subscribe(reschedule);
  check();
  return () => { clearTimeout(timeout); stopTasks(); stopWater(); };
}
