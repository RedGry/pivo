import { locale, t } from '../i18n/index.ts';
import { builtin, localized, movePlugin, parseManifest, resetTimer, saveConfiguration, type Entry, type PluginState } from './model.ts';
import { configuration, type Values } from './configuration.ts';
import { loadPlugins, savePlugins, subscribePlugins } from './store.ts';
import './settings.css';
import { createPluginIcon } from './icon-view.ts';

export function mountPluginSettings(container: HTMLElement, failed: (detail: unknown) => void): { render(): void; dispose(): void } {
  const list = document.createElement('div');
  const drafts = new Map<string, Values>();
  const expanded = new Set<string>();
  list.className = 'plugin-list';
  const file = document.createElement('input');
  file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
  const importButton = document.createElement('button');
  importButton.className = 'primary-button'; importButton.type = 'button';
  importButton.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const selected = file.files?.[0]; file.value = '';
    if (!selected) return;
    void (async () => {
      if (selected.size > 65536) throw new Error('Plugin manifest exceeds 64 KiB');
      const manifest = parseManifest(JSON.parse(await selected.text()));
      if (manifest.id.startsWith('pivo.')) throw new Error('Reserved plugin identifier');
      mutate(state => {
        if (state.entries.some(item => item.manifest.id === manifest.id)) throw new Error('Plugin is already installed');
        if (state.entries.length >= 30) throw new Error('Plugin limit reached');
        state.entries.push({ manifest, enabled: true }); state.selected = manifest.id;
      });
    })().catch(failed);
  });
  const hint = document.createElement('p'); hint.className = 'footnote';
  container.replaceChildren(list, importButton, file, hint);
  function mutate(change: (state: PluginState) => void): void {
    try { const state = loadPlugins(); change(state); savePlugins(state); } catch (error) { failed(error); }
  }
  function settingsForm(entry: Entry): HTMLFormElement {
    const form = document.createElement('form'); form.className = 'plugin-settings-form';
    const fields = entry.manifest.settings ?? [];
    const values = { ...(drafts.get(entry.manifest.id) ?? configuration(fields, entry.values)) };
    for (const field of fields) {
      const label = document.createElement('label');
      const text = document.createElement('span');
      text.textContent = field.labelKey ? t(field.labelKey) : localized(field.label!, locale());
      const input = document.createElement('input'); input.name = field.key;
      input.type = field.type; input.value = String(values[field.key] ?? field.default);
      if (field.type === 'number') {
        input.min = String(field.min); input.max = String(field.max); input.step = '1'; input.required = true;
      } else input.maxLength = field.maxLength;
      input.addEventListener('input', () => {
        values[field.key] = field.type === 'number' ? input.valueAsNumber : input.value;
        drafts.set(entry.manifest.id, values);
      });
      label.append(text, input); form.append(label);
    }
    if (entry.manifest.kind === 'timer') {
      const note = document.createElement('p'); note.className = 'footnote'; note.textContent = t('plugins.settingsHint'); form.append(note);
    }
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'primary-button';
    submit.textContent = t('plugins.saveSettings'); form.append(submit);
    if (entry.manifest.kind === 'timer') {
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'plugin-text-button';
      reset.textContent = t('plugins.reset');
      reset.addEventListener('click', () => mutate(state => {
        const item = state.entries.find(item => item.manifest.id === entry.manifest.id);
        if (item) item.timer = resetTimer(item);
      }));
      form.append(reset);
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      try { configuration(fields, values, true); } catch { failed(t('plugins.settingsInvalid')); return; }
      drafts.delete(entry.manifest.id);
      mutate(state => {
        const item = state.entries.find(item => item.manifest.id === entry.manifest.id);
        if (item) saveConfiguration(item, values);
      });
    });
    return form;
  }
  function render(): void {
    for (const details of list.querySelectorAll<HTMLDetailsElement>('details[data-plugin-settings]')) {
      if (details.open) expanded.add(details.dataset.pluginSettings!); else expanded.delete(details.dataset.pluginSettings!);
    }
    importButton.textContent = t('plugins.import'); hint.textContent = t('plugins.importHint');
    const state = loadPlugins();
    for (const id of drafts.keys()) if (!state.entries.some(entry => entry.manifest.id === id)) drafts.delete(id);
    for (const id of expanded) if (!state.entries.some(entry => entry.manifest.id === id)) expanded.delete(id);
    list.replaceChildren(...state.entries.map(entry => {
      const card = document.createElement('article'); card.className = 'plugin-tile';
      const header = document.createElement('div'); header.className = 'plugin-tile-header';
      const name = document.createElement('h2'); name.textContent = localized(entry.manifest.name, locale());
      name.title = name.textContent;
      header.append(createPluginIcon(entry.manifest.icon, entry.manifest.kind), name);
      if (entry.manifest.id !== builtin.id) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'plugin-remove';
        remove.textContent = '×'; remove.title = t('plugins.remove'); remove.setAttribute('aria-label', `${t('plugins.remove')}: ${name.textContent}`);
        remove.addEventListener('click', () => mutate(next => { next.entries = next.entries.filter(item => item.manifest.id !== entry.manifest.id); }));
        header.append(remove);
      }
      const description = document.createElement('p'); description.className = 'plugin-tile-description';
      description.textContent = entry.manifest.id === builtin.id ? t('plugins.pomodoroDescription')
        : entry.manifest.description ? localized(entry.manifest.description, locale()) : t('plugins.descriptionFallback');
      description.title = description.textContent;
      const author = document.createElement('p'); author.className = 'plugin-tile-author';
      author.textContent = entry.manifest.author
        ? t('plugins.byAuthor', { author: entry.manifest.author }) : t('plugins.authorUnknown');
      const connection = document.createElement('div'); connection.className = 'plugin-connection';
      const connectionLabel = document.createElement('span'); connectionLabel.textContent = t('plugins.enable');
      const toggle = document.createElement('label'); toggle.className = 'switch';
      const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.role = 'switch'; enabled.checked = entry.enabled;
      enabled.setAttribute('aria-label', `${t('plugins.enable')}: ${name.textContent}`);
      const track = document.createElement('span'); track.className = 'switch-track'; track.setAttribute('aria-hidden', 'true');
      toggle.append(enabled, track); connection.append(connectionLabel, toggle);
      enabled.addEventListener('change', () => mutate(next => {
        const item = next.entries.find(item => item.manifest.id === entry.manifest.id);
        if (item) item.enabled = enabled.checked;
      }));
      card.append(header, description, author, connection);
      if (entry.manifest.settings?.length || entry.manifest.kind === 'timer') {
        const details = document.createElement('details'); details.className = 'plugin-settings'; details.dataset.pluginSettings = entry.manifest.id;
        details.open = expanded.has(entry.manifest.id);
        const summary = document.createElement('summary'); summary.textContent = t('plugins.settings'); details.append(summary, settingsForm(entry));
        details.addEventListener('toggle', () => {
          if (!details.isConnected) return;
          if (details.open) expanded.add(entry.manifest.id); else expanded.delete(entry.manifest.id);
        });
        card.append(details);
      }
      return card;
    }));
  }
  const unsubscribe = subscribePlugins(render); render();
  return { render, dispose: unsubscribe };
}

export function mountPluginOrder(container: HTMLElement, failed: (detail: unknown) => void): { render(): void; dispose(): void } {
  function render(): void {
    const entries = loadPlugins().entries.filter(entry => entry.enabled);
    if (entries.length === 0) {
      const empty = document.createElement('p'); empty.className = 'footnote'; empty.textContent = t('plugins.none'); container.replaceChildren(empty); return;
    }
    container.replaceChildren(...entries.map((entry, index) => {
      const row = document.createElement('div'); row.className = 'plugin-order-row';
      const name = document.createElement('span'); name.textContent = localized(entry.manifest.name, locale()); row.append(name);
      for (const delta of [-1, 1] as const) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = delta === -1 ? '↑' : '↓';
        button.title = t(delta === -1 ? 'plugins.up' : 'plugins.down'); button.setAttribute('aria-label', `${button.title}: ${name.textContent}`);
        button.disabled = index + delta < 0 || index + delta >= entries.length;
        button.addEventListener('click', () => {
          try { const state = loadPlugins(); movePlugin(state, entry.manifest.id, delta); savePlugins(state); } catch (error) { failed(error); }
        });
        row.append(button);
      }
      return row;
    }));
  }
  const unsubscribe = subscribePlugins(render); render();
  return { render, dispose: unsubscribe };
}
