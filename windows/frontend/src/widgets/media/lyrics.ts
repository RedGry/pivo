export interface Lyric {
  timeMs: number;
  text: string;
}

export function parseLyrics(source: string): Lyric[] {
  const lines: Lyric[] = [];
  const offset = Number(source.match(/^\[offset:([+-]?\d+)\]\s*$/im)?.[1] ?? 0);
  for (const line of source.split(/\r?\n/)) {
    const times = /^((?:\[\d{1,4}:\d{2}(?:[.:]\d{1,3})?\])+)(.*)$/.exec(line.trim());
    if (!times) continue;
    const text = times[2]!.trim();
    for (const match of times[1]!.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)) {
      const seconds = Number(match[2]);
      if (seconds >= 60) continue;
      const timestamp = (Number(match[1]) * 60 + seconds) * 1000;
      const fraction = Number((match[3] ?? '').padEnd(3, '0'));
      lines.push({ timeMs: Math.max(0, timestamp + fraction + offset), text });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

function activeIndex(lines: Lyric[], positionMs: number): number {
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (lines[middle]!.timeMs <= positionMs) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

export function lyricAt(lines: Lyric[], positionMs: number): string {
  return lines[activeIndex(lines, positionMs)]?.text ?? '';
}

export function lyricCueWindow(lines: Lyric[], positionMs: number): readonly [Lyric | undefined, Lyric | undefined, Lyric | undefined] {
  const active = activeIndex(lines, positionMs);
  let before = active - 1;
  while (before >= 0 && !lines[before]?.text) before--;
  let after = active + 1;
  while (after < lines.length && !lines[after]?.text) after++;
  return [lines[before], lines[active], lines[after]];
}

export function lyricWindow(lines: Lyric[], positionMs: number): readonly [string, string, string] {
  const [before, active, after] = lyricCueWindow(lines, positionMs);
  return [before?.text ?? '', active?.text ?? '', after?.text ?? ''];
}

export function nextLyricDelay(lines: Lyric[], position: number, rate: number): number | undefined {
  const next = lines[activeIndex(lines, position) + 1];
  return next && rate > 0 ? Math.max(1, Math.ceil((next.timeMs - position) / rate)) : undefined;
}
