import type { Lyric } from './lyrics.ts';

export interface VocalSegment {
  startMs: number;
  endMs: number;
  text: string;
}

function phrase(text: string): string {
  return (text.normalize('NFKC').toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');
}

/** Use only unambiguous matches in lyric order. Unmatched audio stays unhighlighted. */
export function alignVocalSegments(plain: string, segments: readonly VocalSegment[]): Lyric[] {
  const lines = plain.split(/\r?\n/).map(text => text.trim()).filter(Boolean);
  const phrases = lines.map(phrase);
  const words: VocalSegment[] = [];
  let previousEnd = 0;
  for (const segment of segments) {
    const { endMs, text } = segment;
    const startMs = Math.max(segment.startMs, previousEnd);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || segment.startMs < 0
      || previousEnd - segment.startMs > 250 || endMs <= segment.startMs) {
      return [];
    }
    if (endMs <= startMs) continue;
    previousEnd = endMs;
    const tokens = phrase(text).split(' ').filter(Boolean);
    if (!tokens.length) continue;
    const span = (endMs - startMs) / tokens.length;
    tokens.forEach((token, index) => words.push({
      startMs: startMs + span * index,
      endMs: index === tokens.length - 1 ? endMs : startMs + span * (index + 1),
      text: token,
    }));
  }
  const matches = [...new Set(phrases)].flatMap(key => {
    if (!key.includes(' ')) return [];
    const tokens = key.split(' ');
    const candidates = words.flatMap((word, index) => {
      const last = words[index + tokens.length - 1];
      if (!last || tokens.some((_, offset) => offset > 0
        && words[index + offset]!.startMs - words[index + offset - 1]!.endMs >= 1000)) return [];
      const errors = tokens.filter((token, offset) => words[index + offset]!.text !== token).length;
      return errors === 0 || (tokens.length >= 4 && errors === 1
        && word.text === tokens[0] && last.text === tokens.at(-1))
        ? [{ startMs: word.startMs, endMs: last.endMs, errors }] : [];
    });
    const exact = candidates.filter(candidate => candidate.errors === 0);
    return (exact.length ? exact : candidates.length === 1 ? candidates : [])
      .map(candidate => ({ ...candidate, key }));
  }).sort((a, b) => a.startMs - b.startMs);
  let line = -1;
  const aligned = matches.map(match => {
    line = phrases.indexOf(match.key, line + 1);
    return { ...match, line };
  });
  if (new Set(aligned.map(match => match.key)).size < 2
    || aligned.some((match, index) => match.line < 0 || index > 0 && match.startMs < aligned[index - 1]!.endMs)) {
    return [];
  }
  return aligned.flatMap(({ startMs, endMs, line }) => [
    { timeMs: startMs, text: lines[line]! },
    { timeMs: endMs, text: '' },
  ]);
}
