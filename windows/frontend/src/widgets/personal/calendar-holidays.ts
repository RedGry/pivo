import { holidaysOn, type HolidayId } from '../../presentation/holidays.ts';
import type { CustomHolidayIcon } from '../../presentation/calendar-holiday-icons.ts';

export const builtinHolidayCountries = ['world', 'ru', 'us', 'ie'] as const;
type Country = typeof builtinHolidayCountries[number];
const countries: Record<HolidayId, readonly Country[]> = {
  newYear: ['world', 'ru', 'us', 'ie'],
  orthodoxChristmas: ['ru'],
  valentine: ['world', 'us', 'ie'],
  defender: ['ru'],
  women: ['world', 'ru'],
  saintPatrick: ['ie'],
  aprilFools: ['world', 'ru', 'us', 'ie'],
  cosmonautics: ['ru'],
  earth: ['world', 'us'],
  easter: ['us', 'ie'],
  orthodoxEaster: ['ru'],
  labour: ['world', 'ru'],
  victory: ['ru'],
  mothers: ['us'],
  children: ['world', 'ru'],
  russia: ['ru'],
  fathers: ['us', 'ie'],
  family: ['ru'],
  knowledge: ['ru'],
  teachers: ['world', 'ru'],
  halloween: ['world', 'us', 'ie'],
  unity: ['ru'],
  thanksgiving: ['us'],
  mothersRussia: ['ru'],
  christmas: ['world', 'us', 'ie'],
  newYearsEve: ['world', 'ru', 'us', 'ie'],
};

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  country?: string;
  icon?: CustomHolidayIcon;
}

export function countryHolidays(date: Date, country: string) {
  return holidaysOn(date).filter(([id]) => country === 'all' ||
    countries[id].some(candidate => candidate === country));
}

export function eventsOn(events: readonly CalendarEvent[], date: string, country: string): CalendarEvent[] {
  return events.filter(event => event.country
    ? (country === 'all' || event.country === country) && event.date.slice(5) === date.slice(5)
    : event.date === date);
}
