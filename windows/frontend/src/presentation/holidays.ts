export const holidayThemes = ['winter', 'love', 'spring', 'summer', 'autumn', 'spooky'] as const;
export type HolidayTheme = typeof holidayThemes[number];
export type HolidayMode = 'off' | 'auto' | HolidayTheme;

type DateRule = (date: Date) => boolean;
const fixed = (month: number, day: number): DateRule => date =>
  date.getMonth() + 1 === month && date.getDate() === day;
const weekday = (month: number, day: number, occurrence: number): DateRule => date =>
  date.getMonth() + 1 === month && date.getDay() === day && Math.ceil(date.getDate() / 7) === occurrence;
const lastSunday = (month: number): DateRule => date =>
  date.getMonth() + 1 === month && date.getDay() === 0 &&
  new Date(date.getFullYear(), month - 1, date.getDate() + 7).getMonth() !== month - 1;

// Gregorian and Julian computus, converted to local Gregorian calendar days.
function easter(date: Date, orthodox: boolean): boolean {
  const year = date.getFullYear();
  const lunar = year % 19;
  const century = Math.floor(year / 100);
  let offset: number;
  if (orthodox) {
    const epact = (19 * lunar + 15) % 30;
    const weekdayOffset = (2 * (year % 4) + 4 * (year % 7) - epact + 34) % 7;
    offset = epact + weekdayOffset + century - Math.floor(century / 4) - 2;
  } else {
    const quarter = Math.floor(century / 4);
    const leapCorrection = Math.floor((century + 8) / 25);
    const epact = (19 * lunar + century - quarter - Math.floor((century - leapCorrection + 1) / 3) + 15) % 30;
    const remainder = year % 100;
    const weekdayOffset = (32 + 2 * (century % 4) + 2 * Math.floor(remainder / 4) - epact - (remainder % 4)) % 7;
    offset = epact + weekdayOffset - 7 * Math.floor((lunar + 11 * epact + 22 * weekdayOffset) / 451);
  }
  const day = new Date(year, 2, 22 + offset);
  return day.getMonth() === date.getMonth() && day.getDate() === date.getDate();
}

export const holidays = [
  ['newYear', 'winter', fixed(1, 1)],
  ['orthodoxChristmas', 'winter', fixed(1, 7)],
  ['valentine', 'love', fixed(2, 14)],
  ['defender', 'winter', fixed(2, 23)],
  ['women', 'spring', fixed(3, 8)],
  ['saintPatrick', 'spring', fixed(3, 17)],
  ['aprilFools', 'spring', fixed(4, 1)],
  ['cosmonautics', 'spring', fixed(4, 12)],
  ['earth', 'spring', fixed(4, 22)],
  ['easter', 'spring', date => easter(date, false)],
  ['orthodoxEaster', 'spring', date => easter(date, true)],
  ['labour', 'spring', fixed(5, 1)],
  ['victory', 'spring', fixed(5, 9)],
  ['mothers', 'love', weekday(5, 0, 2)],
  ['children', 'summer', fixed(6, 1)],
  ['russia', 'summer', fixed(6, 12)],
  ['fathers', 'summer', weekday(6, 0, 3)],
  ['family', 'love', fixed(7, 8)],
  ['knowledge', 'autumn', fixed(9, 1)],
  ['teachers', 'autumn', fixed(10, 5)],
  ['halloween', 'spooky', fixed(10, 31)],
  ['unity', 'autumn', fixed(11, 4)],
  ['thanksgiving', 'autumn', weekday(11, 4, 4)],
  ['mothersRussia', 'love', lastSunday(11)],
  ['christmas', 'winter', fixed(12, 25)],
  ['newYearsEve', 'winter', fixed(12, 31)],
] as const satisfies readonly (readonly [string, HolidayTheme, DateRule])[];

export type HolidayId = typeof holidays[number][0];

export function holidaysOn(date: Date) {
  return holidays.filter(([, , matches]) => matches(date));
}

export function holidayTheme(mode: HolidayMode, date: Date): HolidayTheme | undefined {
  if (mode === 'auto') return holidaysOn(date)[0]?.[1];
  if (mode !== 'off') return mode;
}
