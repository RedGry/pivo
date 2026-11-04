import type { HolidayTheme } from '../presentation/holidays.ts';

export const holidayNavSections = [
  'appearance', 'mascot', 'behavior', 'music', 'tasks', 'calendar',
  'pomodoro', 'water', 'shelf', 'hud', 'updates', 'about',
] as const;

type IconSet = Record<typeof holidayNavSections[number], string>;

const iconSets = {
  winter: {
    appearance: 'M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3m-6 16 3-3 3 3M4 10l3-1-1-3m14 8-3 1 1 3',
    mascot: 'M4 17a8 8 0 0 1 16 0v3H4zM5 13l5-8 7 3 2 5M10 16v1m4-1v1M16 7l3-3',
    behavior: 'M3 7q9 5 18 0M5 8v6a7 7 0 0 0 14 0V8M7 9v3m5-2v3m5-4v3',
    music: 'M10 17V5l9-2v6M10 8l9-2M10 17c0 3-6 4-6 1 0-2 6-4 6-1Zm7-3v7m-3-5 6 3m-6 0 6-3',
    tasks: 'M8 5H5v16h14V5h-3M9 3h6v4H9zM8 13l3 3 5-6m-4 8h4',
    calendar: 'M4 5h16v16H4zM4 9h16M8 3v4m8-4v4m-4 5v6m-3-4 6 2m-6 0 6-2',
    pomodoro: 'M9 3h6m-3 0v3M6 8 4 6m14 2 2-2M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l3 2',
    water: 'M12 3c-3 5-6 8-6 13a6 6 0 0 0 12 0c0-5-3-8-6-13Zm0 9v7m-3-5 6 3m-6 0 6-3',
    shelf: 'M3 8h18v13H3zM3 8l4-4h10l4 4M12 4v17M4 13h16m-8-9c-6 0-4-5 0 0 4-5 6 0 0 0Z',
    hud: 'M12 4c-4 0-6 4-6 8l-2 5h16l-2-5c0-4-2-8-6-8Zm-2 15q2 4 4 0M3 6l2 2m16-2-2 2M12 2v2',
    updates: 'M5 10a7 7 0 0 1 13-3l2 3m0-5v5h-5M19 14a7 7 0 0 1-13 3l-2-3m0 5v-5h5m3-4v4m-2-3 4 2m-4 0 4-2',
    about: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-9h.01M7 6l2 1m6 10 2 1',
  },
  love: {
    appearance: 'M12 20C5 15 3 12 3 8c0-5 7-6 9-1 2-5 9-4 9 1 0 4-2 7-9 12Z',
    mascot: 'M4 17a8 8 0 0 1 16 0v3H4zM9 15v2m6-2v2M12 9c-6-3-2-7 0-4 2-3 6 1 0 4Z',
    behavior: 'M3 5h18M4 6q0 10 8 14 8-4 8-14M9 11q3-4 6 0-1 3-3 4-2-1-3-4Z',
    music: 'M9 17V5l11-2v9M9 17c0 3-6 4-6 1 0-2 6-4 6-1Zm9 4c-7-4-2-8 0-5 2-3 7 1 0 5Z',
    tasks: 'M5 11v10h14V11M12 3c-6-4-9 3 0 8 9-5 6-12 0-8Zm-4 12 3 3 5-5',
    calendar: 'M4 5h16v16H4zM4 9h16M8 3v4m8-4v4m-4 7c-5-4-7 2 0 5 7-3 5-9 0-5Z',
    pomodoro: 'M9 3h6m-3 0v3M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 7c-4-4-6 1 0 5 6-4 4-9 0-5Z',
    water: 'M12 3c-4 6-7 9-7 13a7 7 0 0 0 14 0c0-4-3-7-7-13Zm0 11c-4-3-5 1 0 4 5-3 4-7 0-4Z',
    shelf: 'M3 6h7l2 3h9v12H3zM12 13c-5-4-7 2 0 5 7-3 5-9 0-5Z',
    hud: 'M3 6h18v12h-8l-4 3v-3H3zM12 10c-5-3-6 2 0 5 6-3 5-8 0-5Z',
    updates: 'M4 10a8 8 0 0 1 15-3l2 3m0-5v5h-5m4 4a8 8 0 0 1-15 3l-2-3m0 5v-5h5m4-3c-4-3-5 1 0 4 5-3 4-7 0-4Z',
    about: 'M12 21C4 16 3 12 3 8c0-5 7-6 9-1 2-5 9-4 9 1 0 4-1 8-9 13Zm0-10h.01M12 14v3',
  },
  spring: {
    appearance: 'M12 8c-7-8-12 2-4 4-6 5 2 11 4 4 3 7 10 1 4-4 8-2 3-12-4-4Zm0 3v2',
    mascot: 'M4 17a8 8 0 0 1 16 0v3H4zM9 15v2m6-2v2M12 9V4m0 4C4 8 5 2 9 4l3 4c2-6 8-6 7-2-1 2-4 2-7 2Z',
    behavior: 'M3 6q9 4 18 0M5 8v7a7 7 0 0 0 14 0V8m-7 3v7m0-4q-5 0-5-4 4 0 5 4 1-4 5-4 0 4-5 4Z',
    music: 'M10 18V6l10-2v6M10 18c0 3-6 4-6 1 0-2 6-4 6-1Zm8-6v9m0-4q-5 0-5-4 4 0 5 4 1-4 4-4 0 4-4 4Z',
    tasks: 'M5 7h14v14H5zM12 8V3m0 4q-5 0-5-4 4 0 5 4 1-4 5-4 0 4-5 4Zm-4 7 3 3 5-6',
    calendar: 'M4 6h16v15H4zM4 10h16M8 3v5m8-5v5m-4 5v5m0-2q-4 0-4-3 4 0 4 3 1-3 4-3 0 3-4 3Z',
    pomodoro: 'M12 7V3m0 4q-5 0-5-4 4 0 5 4 1-4 5-4 0 4-5 4Zm0 0a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 3v4l3 2',
    water: 'M12 4c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12Zm-3 13q5 1 6-4m-4 6 4-6',
    shelf: 'M3 8h7l2 3h9v10H3zM12 10V4m0 4q-5 0-5-4 4 0 5 4 1-4 5-4 0 4-5 4Zm-6 8h12',
    hud: 'M4 5h16l-3 11H7zM9 19q3 4 6 0M12 5v11M8 6l2 10m6-10-2 10',
    updates: 'M4 11a8 8 0 0 1 15-4l2 3m0-5v5h-5m4 3a8 8 0 0 1-15 4l-2-3m0 5v-5h5m4-6v8m0-3q-4 0-4-3 4 0 4 3 1-3 4-3 0 3-4 3Z',
    about: 'M12 3q8 0 9 8-1 9-9 10-8-1-9-10 1-8 9-8Zm0 8v6m0-9h.01M6 12l-3 1m15-1 3 1',
  },
  summer: {
    appearance: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
    mascot: 'M4 17a8 8 0 0 1 16 0v3H4zM4 12h16M8 12l1-5h6l1 5M8 16h3v2H8zm5 0h3v2h-3z',
    behavior: 'M3 5h18m-17 1 4 5 4-5 4 5 4-5M5 13a7 7 0 0 0 14 0M9 14v2m6-2v2',
    music: 'M8 18V6l11-3v8M8 18c0 3-6 4-6 1 0-2 6-4 6-1Zm10-5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-2v1m0 8v1m-5-5h1m8 0h1',
    tasks: 'M5 3h14v18H5zM8 8l2 2 4-4m-6 9h8m-8 3h5M16 3v4',
    calendar: 'M4 5h16v16H4zM4 9h16M8 3v4m8-4v4m-4 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0-2v1m0 6v1m-4-4h1m6 0h1',
    pomodoro: 'M7 3h10v3l-4 6 4 6v3H7v-3l4-6-4-6Zm-2 0h14M5 21h14m-9-3 2-3 2 3',
    water: 'M4 8h15l-2 13H7zM12 8l3-5h5M6 13q3-3 6 0t6 0',
    shelf: 'M3 8h18l-2 13H5zM7 8l3-5m7 5-3-5M4 13h16M9 16v3m6-3v3',
    hud: 'M3 13q9-12 18 0Zm9 0v7q0 2-3 2M12 4v2m-5 7q2-6 5-6 3 0 5 6',
    updates: 'M5 10a7 7 0 0 1 14-2l2 2m0-5v5h-5M3 16q3-4 6 0t6 0 6 0M3 20q3-4 6 0t6 0 6 0',
    about: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 7v5m0-8h.01M12 1v1m0 20v1M1 12h1m20 0h1',
  },
  autumn: {
    appearance: 'M4 19C0 8 12 3 21 3c0 10-5 20-15 18M3 22 16 8m-7 8 1-6m2 3 6-1',
    mascot: 'M4 17a8 8 0 0 1 16 0v3H4zM9 15v2m6-2v2M8 10q2-7 9-7 0 6-7 7m0-1 4-3',
    behavior: 'M3 5q9 6 18 0M5 8v7a7 7 0 0 0 14 0V8m-7 10 4-6q-6 0-6 5',
    music: 'M9 17V5l11-2v11M9 17c-6-2-7 7-1 3l1-3Zm11-3c-6-2-7 7-1 3l1-3Z',
    tasks: 'M5 4h10l4 4v13H5zM15 4v5h4M8 14l3 3 5-7m-6 6 2-5',
    calendar: 'M4 5h16v16H4zM4 9h16M8 3v4m8-4v4m-6 12c-3-4 1-7 6-7 0 4-2 7-5 7m-2 1 5-6',
    pomodoro: 'M7 4h10v3l-4 5 4 5v3H7v-3l4-5-4-5ZM5 4h14M5 20h14m-9-3 2-2 2 2',
    water: 'M12 3c-3 6-7 9-7 13a7 7 0 0 0 14 0c0-4-4-7-7-13Zm-2 16c-4-4 0-7 5-8 0 4-2 7-5 7',
    shelf: 'M3 8h6l2 3h10v10H3zM8 17c1-4 6-6 10-5-1 4-5 6-8 6m-3 1 7-5',
    hud: 'M12 4q-6 0-6 9l-2 4h16l-2-4q0-9-6-9Zm-2 15q2 4 4 0M12 4q0-3 4-3-1 4-4 3Z',
    updates: 'M4 10a8 8 0 0 1 15-3l2 3m0-5v5h-5m4 4a8 8 0 0 1-15 3l-2-3m0 5v-5h5m2 1q-1-5 5-5 0 5-5 5Z',
    about: 'M12 3q8 0 9 9-1 8-9 9-8-1-9-9 1-9 9-9Zm0 8v6m0-9h.01M8 4 6 7m12 10-2 3',
  },
  spooky: {
    appearance: 'M15 3A9 9 0 1 0 21 16 8 8 0 0 1 15 3Zm4 1v6m-3-3h6',
    mascot: 'M4 20V12a8 8 0 0 1 16 0v8l-4-3-4 3-4-3zM9 11v2m6-2v2',
    behavior: 'M3 5l4 4 5-3 5 3 4-4-2 9-4 1-3 4-3-4-4-1zM9 11l1 1m5-1-1 1',
    music: 'M9 17V5l11-2v9M9 17c0 3-6 4-6 1 0-2 6-4 6-1Zm5-3 3 3 3-3 2 4-3 2-2 2-2-2-3-2z',
    tasks: 'M5 20V7l3-4h8l3 4v13zM8 13l3 3 5-6M8 6h8',
    calendar: 'M4 6h16v15H4zM4 10h16M8 3l1 3m7-3-1 3m-7 7 2 2 2-2 2 2 2-2-1 4-3 2-3-2z',
    pomodoro: 'M12 7c-8-4-11 11-4 13h8c7-2 4-17-4-13Zm0 0V3l4-1M8 12l2 2m6-2-2 2m-4 3h4',
    water: 'M12 3c-4 6-7 9-7 13a7 7 0 0 0 14 0c0-4-3-7-7-13ZM9 14h.01m6 0h.01m-6 3 3 2 3-2',
    shelf: 'M3 7l5-4h8l5 4v13H3zM3 9h18M12 11v7m-3-5h6',
    hud: 'M4 7l4-4 4 4 4-4 4 4-2 9H6zM8 12h.01m8 0h.01m-6 5q2 4 4 0',
    updates: 'M5 10a7 7 0 0 1 13-3l2 3m0-5v5h-5M19 14a7 7 0 0 1-13 3l-2-3m0 5v-5h5m0-3 3-2 3 2-3 4z',
    about: 'M12 3a8 8 0 0 1 6 13v4H6v-4a8 8 0 0 1 6-13Zm-3 8h.01m6 0h.01m-3 2v4m-3 1v2m6-2v2',
  },
} satisfies Record<HolidayTheme, IconSet>;

export function holidayNavPath(theme: HolidayTheme, section: string): string | undefined {
  const icons: Readonly<Partial<Record<string, string>>> = iconSets[theme];
  return Object.hasOwn(icons, section) ? icons[section] : undefined;
}

const originalIcons = new WeakMap<SVGSVGElement, Node[]>();
let lastTheme: HolidayTheme | undefined;

export function renderHolidayNavigation(theme: HolidayTheme | undefined): void {
  if (theme === lastTheme) return;
  lastTheme = theme;
  for (const button of document.querySelectorAll<HTMLButtonElement>('.sidebar [data-section]')) {
    const svg = button.querySelector('svg');
    if (!svg) continue;
    const geometry = theme && holidayNavPath(theme, button.dataset.section ?? '');
    if (geometry) {
      if (!originalIcons.has(svg)) originalIcons.set(svg, [...svg.childNodes]);
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', geometry);
      svg.replaceChildren(path);
    } else {
      const original = originalIcons.get(svg);
      if (original) {
        svg.replaceChildren(...original);
        originalIcons.delete(svg);
      }
    }
  }
}
