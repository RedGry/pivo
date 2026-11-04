import type { HolidayTheme } from './holidays.ts';

const artwork: Record<HolidayTheme, { icon: string; ornament: string }> = {
  winter: {
    icon: '<path d="M8 1v14M2 4.5l12 7M2 11.5l12-7M6 3l2 2 2-2m-4 10 2-2 2 2" fill="none" stroke="#83ccea" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
    ornament: `
      <path d="M2 3Q60 23 118 3" fill="none" stroke="#57957c" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 8v3m20 1v4m22-2v4m22-6v4m20-8v3" stroke="#77ae96" stroke-width="2"/>
      <ellipse cx="18" cy="13" rx="3.2" ry="4" fill="#ed9a8f"/>
      <ellipse cx="38" cy="18" rx="3.2" ry="4" fill="#f4ce7d"/>
      <ellipse cx="60" cy="20" rx="3.2" ry="4" fill="#96c8f0"/>
      <ellipse cx="82" cy="18" rx="3.2" ry="4" fill="#eab1dd"/>
      <ellipse cx="102" cy="13" rx="3.2" ry="4" fill="#f4ce7d"/>`,
  },
  love: {
    icon: '<path d="M8 14C4 11 1 9 1 5a3.5 3.5 0 0 1 7-1 3.5 3.5 0 0 1 7 1c0 4-3 6-7 9Z" fill="#dc83a4"/>',
    ornament: `
      <path d="M3 5Q60 18 117 5" fill="none" stroke="#b67896" stroke-width="1.5"/>
      <path d="M22 18c-12-6-3-13 0-7 4-6 12 1 0 7Zm38 5c-14-7-5-15 0-8 5-7 14 1 0 8Zm38-5c-12-6-3-13 0-7 4-6 12 1 0 7Z" fill="#dc83a4"/>
      <circle cx="41" cy="13" r="2" fill="#f3b8b9"/><circle cx="79" cy="13" r="2" fill="#f3b8b9"/>`,
  },
  spring: {
    icon: '<path d="M8 6C2 1 1 8 5 8c-5 4 2 7 3 2 1 5 8 2 3-2 4 0 3-7-3-2Z" fill="#dba2c1"/><circle cx="8" cy="8" r="2" fill="#f3ca83"/>',
    ornament: `
      <path d="M3 20Q31 2 60 15q29 11 57-8" fill="none" stroke="#73a584" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M20 13q-2-8-9-8 1 7 9 8Zm29-1q5-8 12-6-4 8-12 6Zm30 6q5-9 13-9-2 8-13 9Z" fill="#8dbb98"/>
      <circle cx="33" cy="11" r="5" fill="#e8a9bc"/><circle cx="68" cy="17" r="4" fill="#e5b6dc"/><circle cx="102" cy="15" r="5" fill="#e7aebd"/>
      <path d="M33 11h.1m35 6h.1m34-2h.1" stroke="#ffe2a1" stroke-width="3" stroke-linecap="round"/>`,
  },
  summer: {
    icon: '<circle cx="8" cy="8" r="3.5" fill="#edb965"/><path d="M8 1v2m0 10v2M1 8h2m10 0h2M3 3l1.5 1.5m7 7L13 13m0-10-1.5 1.5m-7 7L3 13" stroke="#edb965" stroke-width="1.4" stroke-linecap="round"/>',
    ornament: `
      <path d="M3 4q57 16 114 0" fill="none" stroke="#7ab3b6" stroke-width="1.5"/>
      <path d="m12 6 20 4-13 12Z" fill="#edb965"/><path d="m36 11 21 1-10 13Z" fill="#72b7bd"/>
      <path d="m63 12 21-1-9 14Z" fill="#eaa890"/><path d="m89 10 20-4-7 16Z" fill="#edc584"/>`,
  },
  autumn: {
    icon: '<path d="M2 12C1 5 7 2 14 2c0 7-4 12-10 11l-2 2" fill="#d99b65"/><path d="m3 13 8-8" stroke="#855442" stroke-width="1.1" stroke-linecap="round"/>',
    ornament: `
      <path d="M3 7q57 19 114-3" fill="none" stroke="#a57b63" stroke-width="1.5"/>
      <path d="M14 7Q25 2 36 8 30 20 19 17Zm31 6Q54 3 67 8 67 21 55 22Zm33 0Q88 2 98 6 96 20 84 20Z" fill="#d89c67"/>
      <path d="m19 15 12-5m23 10 9-9m20 8 12-10" stroke="#9c614b" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="105" cy="8" r="3" fill="#be7484"/>`,
  },
  spooky: {
    icon: '<path d="M8 4c5-4 10 3 5 8-2 2-8 2-10 0C-2 7 3 0 8 4Z" fill="#df8e58"/><path d="M8 5V2l3-1M4 8h1m6 0h1m-6 3h4" fill="none" stroke="#59374e" stroke-width="1.5" stroke-linecap="round"/>',
    ornament: `
      <path d="M2 2v23M2 2l25 23M2 2l49 17M2 2l65 8M2 2h80M2 10q8-2 10 2 5-3 10-3 5-5 13-6M2 17q11-5 16 1 8-7 16-5 8-7 19-9M2 24q14-7 22 0 10-10 23-6 9-10 22-9" fill="none" stroke="#b9afd2" stroke-width="1" stroke-linecap="round"/>
      <path d="M91 10l5 4 5-4v4l6-3-2 8-7-1-2 3-2-3-7 1-2-8 6 3Z" fill="#a990cb"/>
      <path d="M67 8v9" stroke="#b9afd2"/><circle cx="67" cy="19" r="3" fill="#d89164"/>`,
  },
};

export function holidayArtwork(theme: HolidayTheme, kind: 'icon' | 'ornament'): string {
  const viewBox = kind === 'icon' ? '0 0 16 16' : '0 0 120 26';
  return `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${artwork[theme][kind]}</svg>`;
}
