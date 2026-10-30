import type { PluginIcon } from './icons.ts';
import './icons.css';

/** The icon has no independent input behavior; its plugin name supplies the label. */
export function createPluginIcon(icon: PluginIcon | undefined, kind: 'timer' | 'information'): HTMLElement {
  const badge = document.createElement('span');
  badge.className = 'plugin-icon';
  badge.setAttribute('aria-hidden', 'true');
  const fallback = kind === 'timer' ? '⏱' : '▤';
  if (icon?.type === 'png') {
    const image = document.createElement('img');
    image.alt = '';
    image.decoding = 'async';
    image.draggable = false;
    image.addEventListener('error', () => { badge.textContent = fallback; }, { once: true });
    image.src = icon.data;
    badge.append(image);
  } else badge.textContent = icon?.value ?? fallback;
  return badge;
}
