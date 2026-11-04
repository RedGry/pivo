import { locale, t } from '../i18n/index.ts';
import { localized, resetTimer, saveConfiguration, type Entry, type PluginState } from './model.ts';
import { configuration, type Values } from './configuration.ts';
import { loadPlugins, savePlugins, subscribePlugins } from './store.ts';
import './settings.css';

export function mountPluginSettings(container: HTMLElement, failed: (detail: unknown) => void): { render(): void; dispose(): void } {
  const list = document.createElement('div');
  const drafts = new Map<string, Values>();
  list.className = 'widget-settings';
  container.replaceChildren(list);
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
    const entry = loadPlugins().entries[0]!;
    const row = document.createElement('div'); row.className = 'setting-group widget-toggle';
    const name = document.createElement('span'); name.textContent = t('widgets.showOnIsland');
    const toggle = document.createElement('label'); toggle.className = 'switch';
    const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.role = 'switch'; enabled.checked = entry.enabled;
    enabled.setAttribute('aria-label', t('widgets.showOnIsland'));
    const track = document.createElement('span'); track.className = 'switch-track'; track.setAttribute('aria-hidden', 'true');
    enabled.addEventListener('change', () => mutate(state => { state.entries[0]!.enabled = enabled.checked; }));
    toggle.append(enabled, track); row.append(name, toggle);
    const durations = document.createElement('div'); durations.className = 'setting-group';
    const heading = document.createElement('h2'); heading.textContent = t('widgets.durations');
    durations.append(heading, settingsForm(entry));
    list.replaceChildren(row, durations);
  }
  const unsubscribe = subscribePlugins(render); render();
  return { render, dispose: unsubscribe };
}
