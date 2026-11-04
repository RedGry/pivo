import type { HolidayId } from './holidays.ts';

export const customHolidayIcons = ['spark', 'gift', 'flag', 'flower', 'star'] as const;
export type CustomHolidayIcon = typeof customHolidayIcons[number];
export type CalendarHolidayIcon = HolidayId | CustomHolidayIcon;

const paths = {
  newYear: 'M8 1v6M2 4l4 4m8-4-4 4M8 9l3 6H5zM2 11h1m10 0h1',
  orthodoxChristmas: 'M8 1l1.5 4.5L14 6l-3.5 3 1 5L8 11.5 4.5 14l1-5L2 6l4.5-.5Z',
  valentine: 'M8 14C2 10 1 8 1 5c0-4 5-4 7-1 2-3 7-3 7 1 0 3-1 5-7 9Z',
  defender: 'M8 1 14 4v4c0 3-3 5-6 7-3-2-6-4-6-7V4Zm0 4v5M6 7h4',
  women: 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8 1v3m0 8v3M1 8h3m8 0h3M3 3l2 2m6 6 2 2m0-10-2 2m-6 6-2 2',
  saintPatrick: 'M8 9C1 11 0 4 5 5c-3-5 6-5 5 0 5-1 5 6-2 4Zm0 0c1 3 0 4-2 6',
  aprilFools: 'M2 3q6 4 12 0v5q-2 6-6 6T2 8Zm3 4h.01m6 0h.01M5 10q3 3 6 0',
  cosmonautics: 'M6 10q0-7 8-8 0 8-7 9l-2 3v-3L2 9Zm4-3h.01M4 12l-2 2',
  earth: 'M8 1a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 0q-6 7 0 14m0-14q6 7 0 14M1 8h14',
  easter: 'M8 2c-3 0-6 5-6 8a6 5 0 0 0 12 0c0-3-3-8-6-8ZM3 9l3-2 4 3 3-2',
  orthodoxEaster: 'M8 1v5M6 3h4M3 9q5-5 10 0v5H3Zm0 1h10M6 12h.01m4 0h.01',
  labour: 'm3 13 8-8m-1-2 4 4-2 2-4-4ZM4 4h2m-3 3h1m8 5h2',
  victory: 'M5 2h6l-1 6H6Zm3 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 2v2',
  mothers: 'M8 6c-6-5-9 1 0 7 9-6 6-12 0-7Zm-5-4v3m-1-1h3m7-2v3m-1-1h3',
  children: 'M4 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm7-1a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 11q3 2 0 4m7-7q-2 4 1 6',
  russia: 'M2 14V2q3-2 6 0t6 0v9q-3 2-6 0t-6 0m0-6q3-2 6 0t6 0M2 8q3-2 6 0t6 0',
  fathers: 'm5 2 3 2 3-2-1 4 2 7-4 2-4-2 2-7ZM6 6h4',
  family: 'M2 7l6-5 6 5v7H2Zm6 5c-5-3-2-6 0-3 2-3 5 0 0 3Z',
  knowledge: 'M2 3q4-2 6 1 2-3 6-1v10q-4-2-6 1-2-3-6-1Zm6 1v10',
  teachers: 'M1 2h14v9H1zM5 14h6M8 11v3m-3-8 2 2 4-4',
  halloween: 'M8 4c5-4 10 3 5 8-2 2-8 2-10 0C-2 7 3 0 8 4Zm0 0V2l3-1M4 8h1m6 0h1m-6 3h4',
  unity: 'M2 6l3-3 3 2 3-2 3 3-3 5-3 2-3-2Zm3 0 2 2 3-2m-4 5 2 2',
  thanksgiving: 'M8 14V5m0 6C2 10 1 5 3 3c3 0 5 4 5 8Zm0 0c6-1 7-6 5-8-3 0-5 4-5 8Z',
  mothersRussia: 'M8 8c-5-4-7 1 0 6 7-5 5-10 0-6ZM8 1v4M3 2l2 2m8-2-2 2',
  christmas: 'm8 1 4 5h-2l4 4h-3l4 3H1l4-3H2l4-4H4Zm0 12v2',
  newYearsEve: 'M2 12V7m3 5V4m3 8V2m3 10V4m3 8V7M2 14h12',
  spark: 'M8 1q1 6 7 7-6 1-7 7-1-6-7-7 6-1 7-7Z',
  gift: 'M2 6h12v8H2zM8 6v8m0-8C1 6 3 0 8 6c5-6 7 0 0 0Z',
  flag: 'M3 14V2q3-2 6 0t5 0v8q-2 2-5 0t-6 0',
  flower: 'M8 5c-6-5-8 3-3 3-4 5 3 7 3 2 0 5 7 3 3-2 5 0 3-8-3-3Zm0 2v2',
  star: 'm8 1 2 4 5 1-3 3 1 5-5-2-5 2 1-5-3-3 5-1Z',
} satisfies Record<CalendarHolidayIcon, string>;

const colors = {
  newYear: ['#f3b968', '#745f9c'],
  orthodoxChristmas: ['#e8c565', '#8059a9'],
  valentine: ['#f485a7', '#b64470'],
  defender: ['#9bcf9c', '#4d845e'],
  women: ['#ffacd0', '#a450a1'],
  saintPatrick: ['#8ddf91', '#32834f'],
  aprilFools: ['#e4a7f3', '#8a5cb7'],
  cosmonautics: ['#90cfff', '#416da6'],
  earth: ['#8edfc6', '#3a8f9f'],
  easter: ['#ef9eb8', '#8669b6'],
  orthodoxEaster: ['#f6c185', '#b76257'],
  labour: ['#ff9d8b', '#a54b4f'],
  victory: ['#f5ba72', '#a06a3b'],
  mothers: ['#eb9cc5', '#92558e'],
  children: ['#ffd188', '#9a7b48'],
  russia: ['#a6c5fa', '#b9576a'],
  fathers: ['#7dbfe8', '#4664a0'],
  family: ['#ffa8ac', '#a55d70'],
  knowledge: ['#f3be7d', '#aa6749'],
  teachers: ['#a6d8bd', '#4a806f'],
  halloween: ['#ffa366', '#b85135'],
  unity: ['#92d4ec', '#5677b1'],
  thanksgiving: ['#edba83', '#a3634b'],
  mothersRussia: ['#f5a4d0', '#9b549b'],
  christmas: ['#9bdd9d', '#4c8f65'],
  newYearsEve: ['#bba4fa', '#b0759b'],
  spark: ['#ffe19d', '#a67546'],
  gift: ['#fa9b9f', '#ac627b'],
  flag: ['#9cc8f3', '#5475aa'],
  flower: ['#e7a1dc', '#926a9b'],
  star: ['#f5c86c', '#9f753b'],
} satisfies Record<CalendarHolidayIcon, readonly [string, string]>;

export function calendarHolidayIcon(icon: CalendarHolidayIcon, embroidered = false): string {
  const id = Object.hasOwn(paths, icon) ? icon : 'star';
  const [stroke, fill] = colors[id];
  const backdrop = embroidered ? '' : `<circle cx="8" cy="8" r="7.7" fill="${fill}" opacity=".28" stroke="none"/>`;
  return `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="${embroidered ? 'currentColor' : stroke}" stroke-width="1.28" stroke-linecap="round" stroke-linejoin="round">${backdrop}<path d="${paths[id]}"/></svg>`;
}