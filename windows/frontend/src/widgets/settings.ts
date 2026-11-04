import { t } from '../i18n/index.ts';
import { widgets, widgetTitle, widgetEnabled, setWidgetEnabled } from './index.ts';
import { mountHudSettings } from './hud/index.ts';

export function addWidgetSections(): (section: string) => (() => void) | undefined {
  const nav = document.querySelector('nav')!;
  const pomodoro = document.querySelector('#tab-pomodoro')!;
  const updates = document.querySelector('#tab-updates')!;
  const updatePage = document.querySelector('#page-updates')!;
  const icons: Record<string, string> = {
    music: 'M9 18V6l11-2v12M9 18c0 3-6 3-6 0s6-3 6 0Zm11-2c0 3-6 3-6 0s6-3 6 0Z',
    tasks: 'M5 12l4 4L19 6M7 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    calendar: 'M4 8h16M8 3v4m8-4v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 8h2m4 0h2m-8 4h2',
    water: 'M12 3C9 8 6 11 6 15a6 6 0 0 0 12 0c0-4-3-7-6-12Z',
    shelf: 'M3 7h6l2 2h10v10H3zM3 13h18',
    hud: 'M5 17h14l-2-3V9A5 5 0 0 0 7 9v5l-2 3Zm5 3h4',
  };
  const sections = [...widgets, { id: 'hud', mount: mountHudSettings }];
  for (const widget of sections) {
    const id = widget.id;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = 'tab-' + id;
    tab.dataset.section = id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'page-' + id);
    tab.setAttribute('aria-selected', 'false');
    tab.tabIndex = -1;
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    marker.setAttribute('viewBox', '0 0 24 24');
    marker.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(marker.namespaceURI, 'path');
    path.setAttribute('d', icons[id] ?? 'M5 5h14v14H5z');
    marker.append(path);
    const label = document.createElement('span');
    label.dataset.i18n = 'widgets.' + id;
    label.textContent = widgetTitle(id);
    tab.append(marker, label);
    nav.insertBefore(tab, ['music', 'tasks', 'calendar'].includes(id) ? pomodoro : updates);
    const page = document.createElement('section');
    page.id = 'page-' + id;
    page.className = 'page';
    page.hidden = true;
    page.setAttribute('role', 'tabpanel');
    page.setAttribute('aria-labelledby', tab.id);
    updatePage.before(page);
  }
  return id => {
    const widget = sections.find(item => item.id === id);
    if (!widget) return;
    const page = document.querySelector<HTMLElement>('#page-' + id)!;
    const heading = document.createElement('h1');
    heading.textContent = widgetTitle(id);
    const header = document.createElement('header');
    header.className = 'page-heading';
    header.append(heading);
    const body = document.createElement('div');
    body.className = 'page-body';
    if (id !== 'hud') {
      const toggle = document.createElement('label');
      toggle.className = 'setting-group widget-toggle';
      const enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.role = 'switch';
      enabled.checked = widgetEnabled(id);
      enabled.addEventListener('change', () => setWidgetEnabled(id, enabled.checked));
      toggle.append(t('widgets.showOnIsland'), enabled);
      body.append(toggle);
    }
    const content = document.createElement('div');
    content.className = 'widget-content';
    body.append(content);
    page.replaceChildren(header, body);
    const dispose = widget.mount(content, () => {});
    return () => { dispose(); page.replaceChildren(); };
  };
}
