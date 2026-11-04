const notices = new EventTarget();

const icons = {
  volume: 'M2 6h3l3-3v10l-3-3H2z M10 5q3 3 0 6 M12 3q5 5 0 10',
  brightness: 'M8 5a3 3 0 1 0 0 6 3 3 0 1 0 0-6 M8 1v2m0 10v2M1 8h2m10 0h2M3 3l1 1m8 8 1 1m0-10-1 1m-8 8-1 1',
  capsLock: 'M3 8l5-5 5 5h-3v3H6V8z M5 14h6',
  language: 'M2 12l3-8 3 8M3 9h4m3-5h5m-5 0q1 5 5 8m0-8q-1 5-5 8',
  battery: 'M1 5h12v6H1z M15 7v2 M3 8h6',
  wifi: 'M1 6a11 11 0 0 1 14 0 M3 9a8 8 0 0 1 10 0 M5.5 11.5a4 4 0 0 1 5 0 M8 14h.01',
  headset: 'M2 9V7a6 6 0 0 1 12 0v2 M2 8h3v5H2z M11 8h3v5h-3z',
  tasks: 'M3 2h10v12H3z M5 8l2 2 4-4',
  water: 'M8 2c1 3 5 5 5 8a5 5 0 0 1-10 0c0-3 4-5 5-8Z',
  shelf: 'M2 5h5l2 2h5l-1 6H2z M2 5V3h5l2 2h4v2',
} as const;

export interface Notice {
  kind: keyof typeof icons;
  text: string;
  level?: number;
  badge?: string;
  badgeActive?: boolean;
}

export function publishNotice(...entries: Notice[]): void {
  notices.dispatchEvent(new CustomEvent<Notice[]>('notice', { detail: entries }));
}

function renderNotice(notice: Notice) {
  let current = notice;
  const card = document.createElement('span');
  card.className = 'notice-card';
  card.dataset.kind = notice.kind;
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(icon.namespaceURI, 'path');
  icon.append(path);
  const label = document.createElement('span');
  label.className = 'notice-label';
  card.append(icon, label);
  const meter = document.createElement('span');
  meter.className = 'notice-meter';
  meter.setAttribute('aria-hidden', 'true');
  card.append(meter);
  const badge = document.createElement('span');
  badge.className = 'notice-badge';
  badge.setAttribute('aria-hidden', 'true');
  card.append(badge);
  function update(next: Notice): void {
    current = next;
    path.setAttribute('d', next.kind === 'volume' && next.level === 0
      ? 'M2 6h3l3-3v10l-3-3H2z M10 6l4 4m0-4-4 4'
      : icons[next.kind]);
    label.textContent = next.text;
    badge.hidden = !next.badge;
    badge.textContent = next.badge ?? '';
    badge.dataset.active = String(Boolean(next.badgeActive));
    const level = next.level !== undefined && Number.isFinite(next.level) ? next.level : 0;
    meter.style.setProperty('--notice-level', String(Math.min(100, Math.max(0, level)) / 100));
  }
  update(notice);
  function matches(next: Notice): boolean {
    return current.kind === next.kind && (
      (current.level !== undefined && next.level !== undefined)
      || (current.text === next.text && current.badge === next.badge
        && Boolean(current.badgeActive) === Boolean(next.badgeActive))
    );
  }
  return { card, update, matches };
}

export function mountNotices(element: HTMLElement, visibleChanged?: (visible: boolean) => void): () => void {
  const retireDelay = 310;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let retirement: ReturnType<typeof setTimeout> | undefined;
  let cards: ReturnType<typeof renderNotice>[] = [];
  let row: HTMLElement | undefined;
  const show = (event: Event) => {
    const entries = (event as CustomEvent<Notice[]>).detail.filter(notice => notice.text.trim());
    if (!entries.length) return;
    clearTimeout(timeout);
    clearTimeout(retirement);
    if (row && cards.length === entries.length
      && cards.every(({ matches }, index) => matches(entries[index]!))) {
      cards.forEach(({ update }, index) => update(entries[index]!));
    } else {
      const previous = row;
      cards = entries.map(renderNotice);
      row = document.createElement('div');
      row.className = 'notice-row';
      row.append(...cards.map(({ card }) => card));
      if (previous) {
        previous.setAttribute('aria-hidden', 'true');
        previous.dataset.outgoing = '';
        row.dataset.incoming = '';
        element.append(row);
        const current = row;
        setTimeout(() => {
          previous.remove();
          delete current.dataset.incoming;
        }, retireDelay);
      } else {
        element.replaceChildren(row);
      }
    }
    element.hidden = false;
    visibleChanged?.(true);
    timeout = setTimeout(() => {
      element.hidden = true;
      visibleChanged?.(false);
      retirement = setTimeout(() => {
        element.replaceChildren();
        row = undefined;
        cards = [];
      }, retireDelay);
    }, 2600);
  };
  notices.addEventListener('notice', show);
  return () => {
    notices.removeEventListener('notice', show);
    clearTimeout(timeout);
    clearTimeout(retirement);
    element.replaceChildren();
    element.hidden = true;
    visibleChanged?.(false);
  };
}
