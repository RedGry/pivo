import { calendarHolidayIcon } from './calendar-holiday-icons.ts';
import type { HolidayId, HolidayTheme } from './holidays.ts';

const hats = {
  pom: 'M42 47Q42 28 62 28q17 0 22 18l-4 3H45Z M58 27a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z',
  party: 'M43 47 60 23l19 22q-17 9-36 2Z M58 23a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z',
  beret: 'M40 47q0-13 14-17 18-5 34 11l-8 8H45Z',
  cap: 'M40 46q3-17 22-17 15 0 20 13l11 5q-10 6-21 1H43Z',
  hood: 'M35 53Q36 29 60 26q27 1 33 25l-10 5q-5-15-22-17-15 2-18 17Z',
  wreath: 'M38 48q8-12 24-13 18-1 28 13l-4 4q-25-13-44 0Z',
  band: 'M39 45q23-14 48-1l-4 5q-22-9-42 1Z',
  point: 'M37 48q13-2 14-20l17 3 12 15 9 2q-22 9-52 0Z',
  sun: 'M43 46q3-15 20-16 16 1 20 16l12 4q-29 9-62 0Z',
  crest: 'M40 48l2-13 11 6 9-14 10 14 11-6 4 12q-20 8-47 1Z',
  pilot: 'M41 49q3-20 21-20 20 0 23 20l-7 6-5-10q-10-5-21 0l-4 10Z',
  petals: 'M39 49q-3-9 9-10 1-11 12-6 10-11 17 1 12-3 13 10l-5 7q-19-8-46-2Z',
};

const necks = {
  scarf: 'M34 81q29 9 59 0l-3 8q-28 8-54 0Z M77 87h9l6 10-9 2Z',
  bow: 'm63 86-15-7q-6 4-4 12l19-3 19 3q2-8-4-12Z',
  cape: 'M35 81q27 9 57 0l4 14q-29 8-64 0Z',
  kerchief: 'M38 81q23 9 50 0l-4 8-20 9-22-9Z',
  collar: 'M36 82q26 7 55-1l-3 9q-24 9-50 0Z',
  ribbon: 'M38 82q25 8 50-1l-1 5q-28 9-49 0Z M58 87l6 9 6-9Z',
  muffler: 'M36 80q28 10 55 0l-2 12q-27 8-51 0Z',
  pendant: 'M38 81q23 14 51 0l-3 4q-24 13-46 0Z M57 87h12v9H57Z',
};

type Hat = keyof typeof hats;
type Neck = keyof typeof necks;
type Pair = readonly [Hat, Neck];
type Outfit = readonly [color: string, first: Pair, second: Pair, third: Pair];

const outfits = {
  newYear: ['#708baa', ['party', 'scarf'], ['pom', 'bow'], ['cap', 'cape']],
  orthodoxChristmas: ['#93585b', ['hood', 'muffler'], ['wreath', 'ribbon'], ['beret', 'pendant']],
  valentine: ['#a45e7f', ['petals', 'bow'], ['beret', 'collar'], ['band', 'ribbon']],
  defender: ['#647d79', ['cap', 'collar'], ['pilot', 'muffler'], ['beret', 'cape']],
  women: ['#a4759c', ['petals', 'ribbon'], ['wreath', 'bow'], ['crest', 'pendant']],
  saintPatrick: ['#537f69', ['sun', 'bow'], ['cap', 'kerchief'], ['wreath', 'collar']],
  aprilFools: ['#967cad', ['party', 'bow'], ['point', 'ribbon'], ['crest', 'cape']],
  cosmonautics: ['#627eab', ['pilot', 'collar'], ['hood', 'pendant'], ['band', 'cape']],
  earth: ['#668b87', ['sun', 'pendant'], ['wreath', 'kerchief'], ['hood', 'collar']],
  easter: ['#a185a8', ['petals', 'collar'], ['crest', 'ribbon'], ['band', 'bow']],
  orthodoxEaster: ['#967969', ['wreath', 'pendant'], ['hood', 'ribbon'], ['beret', 'kerchief']],
  labour: ['#95766d', ['cap', 'scarf'], ['band', 'kerchief'], ['pilot', 'cape']],
  victory: ['#927065', ['beret', 'ribbon'], ['cap', 'pendant'], ['pilot', 'bow']],
  mothers: ['#a67b86', ['wreath', 'scarf'], ['petals', 'pendant'], ['sun', 'ribbon']],
  children: ['#8f7dad', ['party', 'collar'], ['sun', 'kerchief'], ['pom', 'cape']],
  russia: ['#6c789c', ['crest', 'collar'], ['beret', 'scarf'], ['cap', 'ribbon']],
  fathers: ['#6a8491', ['pilot', 'scarf'], ['sun', 'cape'], ['beret', 'bow']],
  family: ['#a67f87', ['wreath', 'cape'], ['petals', 'scarf'], ['hood', 'bow']],
  knowledge: ['#7f769d', ['crest', 'kerchief'], ['cap', 'bow'], ['band', 'pendant']],
  teachers: ['#9a7d67', ['beret', 'muffler'], ['sun', 'collar'], ['pilot', 'pendant']],
  halloween: ['#745e91', ['point', 'cape'], ['hood', 'kerchief'], ['crest', 'muffler']],
  unity: ['#748b84', ['band', 'scarf'], ['pilot', 'kerchief'], ['petals', 'cape']],
  thanksgiving: ['#a37b62', ['sun', 'scarf'], ['pom', 'kerchief'], ['point', 'collar']],
  mothersRussia: ['#a87994', ['petals', 'muffler'], ['pom', 'ribbon'], ['crest', 'bow']],
  christmas: ['#965f6b', ['pom', 'scarf'], ['hood', 'cape'], ['point', 'pendant']],
  newYearsEve: ['#75689b', ['party', 'ribbon'], ['crest', 'scarf'], ['point', 'bow']],
} satisfies Record<HolidayId, Outfit>;

const variantIndices: Readonly<Partial<Record<string, 1 | 2 | 3>>> = {
  classic: 1, alternate: 2, signature: 3,
};

const themeOutfits: Record<HolidayTheme, HolidayId> = {
  winter: 'newYear',
  love: 'valentine',
  spring: 'women',
  summer: 'children',
  autumn: 'knowledge',
  spooky: 'halloween',
};

function occasionId(occasion: string): HolidayId | undefined {
  if (Object.hasOwn(outfits, occasion)) return occasion as HolidayId;
  if (Object.hasOwn(themeOutfits, occasion)) return themeOutfits[occasion as HolidayTheme];
}

export function occasionPieces(occasion: string, variant: string): Pair | undefined {
  const id = occasionId(occasion);
  return id ? outfits[id][variantIndices[variant] ?? 1] : undefined;
}

export function occasionOutfitArtwork(occasion: string, variant: string): string {
  const id = occasionId(occasion);
  if (!id) return '';
  const design = outfits[id];
  const [hat, neck] = design[variantIndices[variant] ?? 1];
  const winter = id === 'newYear' || id === 'christmas' || id === 'orthodoxChristmas' || id === 'newYearsEve';
  const santa = winter && (variant === 'classic' || hat === 'pom');
  const witch = id === 'halloween' && variant === 'classic';
  const special = santa
    ? '<path d="M37 45Q39 22 61 21q16 0 24 18l-10 4-9-10-4 13Z" fill="#ae4e5c"/><path d="M41 46q17-5 35-1" fill="none" stroke="#f2e8de" stroke-width="7" stroke-linecap="round"/><circle cx="85" cy="39" r="5" fill="#f2e8de"/>'
    : witch
      ? '<path d="M43 47q10-13 13-32l14 9 11 22Z" fill="#645176"/><path d="M36 48q27-9 54 0-2 7-12 6H46q-10 0-10-6Z" fill="#8971a0"/><path d="M53 43h17" stroke="#d2a171" stroke-width="3" stroke-linecap="round"/>'
      : id === 'valentine' && variant === 'classic'
        ? '<path d="M63 50c-25-14-10-27 0-17 10-10 25 3 0 17Z" fill="#c67b9b"/><path d="M51 36q4-5 8-1" stroke="#e6acc0" fill="none" stroke-linecap="round"/>'
        : id === 'women' && variant === 'classic'
          ? '<path d="M40 47q22-15 46 0" fill="none" stroke="#6d947b" stroke-width="4"/><circle cx="51" cy="42" r="5" fill="#d594aa"/><circle cx="63" cy="39" r="6" fill="#e7bf82"/><circle cx="75" cy="42" r="5" fill="#bb9ac8"/>'
          : '';
  const fabricColor = santa ? '#a95261' : design[0];
  const pin = calendarHolidayIcon(id, true).replace('<svg ', '<svg x="58" y="81" width="10" height="10" ');
  return `<g class="occasion-outfit" style="--occasion-cloth:${fabricColor}">
    ${special || `<path class="occasion-head" d="${hats[hat]}"/><path class="occasion-stitch" d="M44 47q17-7 37-1"/>`}
    <g class="costume-fabric">
      <path class="occasion-neck" d="${necks[neck]}"/>
      <g class="occasion-pin">${pin}</g>
    </g>
  </g>`;
}
export function renderOccasionOutfit(host: HTMLElement, occasion = '', variant = 'classic'): void {
  const key = `${occasion}:${variant}`;
  if (host.dataset.occasionRender === key) return;
  host.dataset.occasionRender = key;
  const slot = host.querySelector('[data-occasion-outfit]');
  if (!slot) return;
  slot.innerHTML = occasionOutfitArtwork(occasion, variant);
  host.classList.toggle('has-occasion-outfit', slot.childElementCount > 0);
}
