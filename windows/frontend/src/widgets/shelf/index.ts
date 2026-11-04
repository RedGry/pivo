import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { t } from '../../i18n/index.ts';
import type { Widget } from '../types.ts';
import { publishNotice } from '../notice.ts';
import './style.css';

interface Shelf {
  clearOnStartup: boolean;
  paths: string[];
}

let shelf: Shelf = { clearOnStartup: false, paths: [] };

function subscribe(refresh: () => void, fail: () => void = () => {}): () => void {
  let active = true;
  let changed = false;
  const subscription = listen<Shelf>('pivo:shelf', ({ payload }) => {
    if (!active) return;
    changed = true;
    shelf = payload;
    refresh();
  });
  void subscription.then(async () => {
    if (!active) return;
    const current = await invoke<Shelf>('pivo_shelf_get');
    if (!active || changed) return;
    shelf = current;
    refresh();
  }).catch(() => {
    if (active) fail();
  });
  return () => {
    active = false;
    void subscription.then(unlisten => unlisten()).catch(() => {});
  };
}

function button(label: string, action: () => void): HTMLButtonElement {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = label;
  control.addEventListener('click', action);
  return control;
}

function mount(container: HTMLElement, refresh: () => void): () => void {
  let active = true;
  let pending = false;
  let ready = false;
  const panel = document.createElement('div');
  panel.className = 'shelf-widget setting-group';
  const list = document.createElement('ul');
  const status = document.createElement('p');
  status.className = 'footnote';
  status.setAttribute('role', 'status');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  const option = document.createElement('label');
  option.append(checkbox, t('shelf.clearOnStartup'));
  const hint = document.createElement('p');
  hint.className = 'footnote';
  hint.textContent = t('shelf.clearHelp');
  const add = button(t('shelf.add'), () => perform('pivo_shelf_add'));
  add.className = 'primary-button';
  panel.append(option, hint, add, list, status);
  container.replaceChildren(panel);

  const rows = new Map<string | null, { row: HTMLLIElement; present: boolean; animation?: Animation }>();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches || document.documentElement.hasAttribute('data-reduced-motion');
  function settleRows(): void {
    if (!active) return;
    for (const [key, entry] of rows) {
      entry.animation?.cancel();
      entry.animation = undefined;
      if (!entry.present) { entry.row.remove(); rows.delete(key); }
    }
  }
  const motionChanged = () => { if (reduced()) settleRows(); };
  media.addEventListener('change', motionChanged);
  const observer = new MutationObserver(motionChanged);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });

  function transitionRow(key: string | null, present: boolean, entering = false): void {
    const entry = rows.get(key)!;
    const style = getComputedStyle(entry.row);
    const height = entering ? 0 : entry.row.getBoundingClientRect().height;
    const opacity = entering ? 0 : Number(style.opacity);
    const { paddingBlock, borderTopWidth, marginBottom } = style;
    entry.animation?.cancel();
    entry.present = present;
    entry.row.inert = !present;
    if (reduced()) {
      entry.animation = undefined;
      if (!present) { entry.row.remove(); rows.delete(key); }
      return;
    }
    const fullHeight = entry.row.getBoundingClientRect().height;
    const animation = entry.row.animate([
      { height: `${height}px`, opacity, paddingBlock: entering ? '0px' : paddingBlock,
        borderTopWidth: entering ? '0px' : borderTopWidth, marginBottom: entering ? '0px' : marginBottom, overflow: 'hidden' },
      { height: `${present ? fullHeight : 0}px`, opacity: present ? 1 : 0,
        paddingBlock: present ? '8px' : '0px', borderTopWidth: present ? '1px' : '0px',
        marginBottom: present ? '8px' : '0px', overflow: 'hidden' },
    ], { duration: 300, easing: 'cubic-bezier(.2, 0, .2, 1)' });
    entry.animation = animation;
    void animation.finished.then(() => {
      if (!active || entry.animation !== animation) return;
      entry.animation = undefined;
      if (!entry.present) { entry.row.remove(); rows.delete(key); }
    }, () => {});
  }

  const failed = () => { status.textContent = t('shelf.error'); };
  function placeRow(row: HTMLLIElement, index: number): void {
    // Exiting rows keep their layout slot until their height reaches zero.
    const before = [...list.children].filter(child => !(child as HTMLElement).inert)[index];
    if (before !== row) list.insertBefore(row, before ?? null);
  }
  function render(): void {
    checkbox.checked = shelf.clearOnStartup;
    checkbox.disabled = add.disabled = pending || !ready;
    const keys: (string | null)[] = shelf.paths.length ? shelf.paths : [null];
    for (const [key, entry] of rows) {
      if (entry.present && !keys.includes(key)) transitionRow(key, false);
    }
    keys.forEach((path, index) => {
      const existing = rows.get(path);
      if (existing) {
        if (!existing.present) transitionRow(path, true);
        placeRow(existing.row, index);
        for (const action of existing.row.querySelectorAll('button')) {
          action.disabled = !ready;
          action.setAttribute('aria-disabled', String(pending || !ready));
        }
        return;
      }
      const row = document.createElement('li');
      if (path === null) {
        row.textContent = t('shelf.empty');
      } else {
        const file = document.createElement('span');
        file.textContent = path.split(/[\\/]/).at(-1) ?? path;
        file.title = path;
        const actions = document.createElement('div');
        actions.append(
          button(t('shelf.open'), () => perform('pivo_shelf_open', { path, reveal: false })),
          button(t('shelf.reveal'), () => perform('pivo_shelf_open', { path, reveal: true })),
          button(t('shelf.remove'), () => perform('pivo_shelf_remove', { path })),
        );
        for (const action of actions.querySelectorAll('button')) {
          action.disabled = !ready;
          action.setAttribute('aria-disabled', String(pending || !ready));
        }
        row.append(file, actions);
      }
      rows.set(path, { row, present: true });
      placeRow(row, index);
      if (ready) transitionRow(path, true, true);
    });
  }
  function perform(command: string, args?: Record<string, unknown>): void {
    if (!active || !ready || pending) return;
    pending = true;
    status.textContent = '';
    render();
    void invoke(command, args).catch(() => {
      if (active) failed();
    }).finally(() => {
      if (!active) return;
      pending = false;
      render();
    });
  }
  checkbox.addEventListener('change', () => perform('pivo_shelf_clear_on_startup', { enabled: checkbox.checked }));
  render();
  const unsubscribe = subscribe(() => {
    ready = true;
    render();
    refresh();
  }, failed);
  return () => {
    active = false;
    unsubscribe();
    observer.disconnect();
    media.removeEventListener('change', motionChanged);
    for (const entry of rows.values()) entry.animation?.cancel();
    rows.clear();
    panel.remove();
  };
}

export const widgets: Widget[] = [{
  id: 'shelf',
  mount,
  subscribe,
  summary: () => t('shelf.count', { count: shelf.paths.length }),
  primary: () => actOnFirst('pivo_shelf_open'),
  secondary: () => actOnFirst('pivo_shelf_remove'),
  primaryEnabled: () => shelf.paths.length > 0,
  secondaryEnabled: () => shelf.paths.length > 0,
  primaryLabel: () => t('shelf.open'),
  secondaryLabel: () => t('shelf.remove'),
  actionKey: () => shelf.paths[0],
  islandPreview: () => ({
    kind: 'list',
    items: shelf.paths.slice(0, 1).map(path => path.split(/[\\/]/).at(-1) ?? path),
  }),
}];

async function actOnFirst(command: 'pivo_shelf_open' | 'pivo_shelf_remove'): Promise<void> {
  const path = shelf.paths[0];
  if (!path) return;
  try {
    await invoke(command, { path, reveal: false });
  } catch {
    publishNotice({ kind: 'shelf', text: t('shelf.error') });
  }
}
