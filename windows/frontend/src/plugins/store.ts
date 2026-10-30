import { initialState, restore, type PluginState } from './model.ts';

const key = 'pivo.plugins.v1';
const changed = 'pivo:plugins-local';
export function loadPlugins(): PluginState {
  try { return restore(localStorage.getItem(key)); } catch { return initialState(); }
}
export function savePlugins(state: PluginState): void {
  localStorage.setItem(key, JSON.stringify(state));
  dispatchEvent(new Event(changed));
}
export function subscribePlugins(callback: () => void): () => void {
  const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) callback(); };
  addEventListener('storage', storage);
  addEventListener(changed, callback);
  return () => { removeEventListener('storage', storage); removeEventListener(changed, callback); };
}
