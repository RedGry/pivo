import type { Lyric } from './lyrics.ts';

type Cues = readonly [Lyric | undefined, Lyric | undefined, Lyric | undefined];

export function currentLyricText(cues: Cues | null | undefined): string {
  return cues ? cues[1]?.text || '♪' : '';
}
type Point = readonly [number, number];
type Bounds = Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>;

const outgoingText = new WeakMap<HTMLElement, Set<HTMLElement>>();
/** Island ancestors use uniform scaling; computed width preserves subpixel sizing. */
function ancestorScale(viewport: HTMLElement): number {
  const width = parseFloat(getComputedStyle(viewport).width);
  const scale = viewport.getBoundingClientRect().width / width;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
function sampleText(element: HTMLElement) {
  const style = getComputedStyle(element);
  return { bounds: element.getBoundingClientRect(), scrollTop: element.scrollTop,
    style: { font: style.font, color: style.color, whiteSpace: style.whiteSpace, opacity: style.opacity,
      fontSize: style.fontSize, lineHeight: style.lineHeight, transform: style.transform } };
}

export function settleLyricText(element: HTMLElement): void {
  element.getAnimations().forEach(animation => animation.cancel());
  for (const snapshot of outgoingText.get(element) ?? []) {
    snapshot.getAnimations().forEach(animation => animation.cancel());
    snapshot.remove();
  }
  outgoingText.delete(element);
}

/** Preserve the currently painted text while its replacement enters. */
export function replaceLyricText(element: HTMLElement, text: string, motion: boolean, sampled?: ReturnType<typeof sampleText>): void {
  if (!motion) settleLyricText(element);
  if (element.textContent === text) {
    if (motion && element.hidden && text) element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
    return;
  }
  const parent = element.parentElement;
  if (motion && parent && !element.hidden && element.textContent) {
    const { bounds, style, scrollTop } = sampled ?? sampleText(element);
    const origin = parent.getBoundingClientRect();
    const scale = ancestorScale(parent);
    const snapshot = element.cloneNode(true) as HTMLElement;
    snapshot.classList.add('lyric-outgoing');
    snapshot.setAttribute('aria-hidden', 'true');
    snapshot.inert = true;
    Object.assign(snapshot.style, {
      position: 'absolute', left: `${(bounds.left - origin.left) / scale - parent.clientLeft + parent.scrollLeft}px`,
      top: `${(bounds.top - origin.top) / scale - parent.clientTop + parent.scrollTop}px`,
      width: `${bounds.width / scale}px`, height: `${bounds.height / scale}px`, margin: '0',
      font: style.font, color: style.color, whiteSpace: style.whiteSpace, opacity: style.opacity,
      transform: 'none', pointerEvents: 'none',
    });
    if (style.transform !== 'none') {
      const scale = new DOMMatrixReadOnly(style.transform).a;
      snapshot.style.fontSize = `${parseFloat(style.fontSize) * scale}px`;
      if (Number.isFinite(parseFloat(style.lineHeight))) snapshot.style.lineHeight = `${parseFloat(style.lineHeight) * scale}px`;
    }
    parent.append(snapshot);
    snapshot.scrollTop = scrollTop;
    const snapshots = outgoingText.get(element) ?? new Set<HTMLElement>();
    outgoingText.set(element, snapshots); snapshots.add(snapshot);
    const animation = snapshot.animate([{ opacity: style.opacity }, { opacity: 0 }], { duration: 300, easing: 'ease-out' });
    const remove = () => { snapshot.remove(); snapshots.delete(snapshot); };
    void animation.finished.then(remove, remove);
  }
  element.getAnimations().forEach(animation => animation.cancel());
  element.textContent = text;
  if (motion && text) element.animate([{ opacity: 0, translate: '0 5px' }, { opacity: 1, translate: '0 0' }], { duration: 300, easing: 'ease-out' });
}

export function lyricSeekTarget(
  press: Point, release: Point, viewport: Bounds,
  rows: readonly { bounds: Bounds; target: number | undefined }[],
): number | undefined {
  const contains = (bounds: Bounds, [x, y]: Point) =>
    x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom;
  if (Math.hypot(press[0] - release[0], press[1] - release[1]) > 4
    || !contains(viewport, press) || !contains(viewport, release)) return;
  const pressed = rows.filter(row => contains(row.bounds, press));
  const released = rows.filter(row => contains(row.bounds, release));
  if (pressed.length === 1 && released.length === 1 && pressed[0] === released[0]) return pressed[0]?.target;
}

export function renderLyricRows(rows: HTMLElement[]) {
  let last: Cues | null = null;
  let lastTrack: string | undefined;
  let resize: Animation | undefined;
  let rendered = false;
  const render = (track: string | undefined, cues: Cues | null, message: string, shown: boolean, motion: boolean) => {
    const previous = last;
    const trackChanged = track !== lastTrack;
    const slide = shown && motion && !trackChanged && previous && cues
      && previous.some((cue, index) => cue !== cues[index]);
    const centers = slide ? rows.map(line => {
      const bounds = line.getBoundingClientRect();
      return bounds.top + bounds.height / 2;
    }) : [];
    const viewport = rows[1]?.parentElement;
    const scale = viewport ? ancestorScale(viewport) : 1;
    const swapping = Boolean(!slide && shown && motion && rendered && rows.some((line, index) =>
      line.textContent !== (index === 1 ? currentLyricText(cues) || message : cues?.[index]?.text ?? '')));
    const paints = swapping ? rows.map(sampleText) : [];
    const previousHeight = (slide || swapping) && viewport ? viewport.getBoundingClientRect().height / scale : undefined;
    if (slide || swapping || trackChanged || !shown || !motion) resize?.cancel();
    const oldStyles = slide ? rows.map(line => {
      const { color, fontSize, opacity, transform } = getComputedStyle(line);
      const scale = transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
      return { color, opacity, fontSize: parseFloat(fontSize) * scale };
    }) : [];
    const backward = (cues?.[1]?.timeMs ?? Infinity) < (previous?.[1]?.timeMs ?? -Infinity);
    last = shown ? cues : null;
    lastTrack = track;

    rows.forEach((line, index) => {
      const text = index === 1 ? currentLyricText(cues) || message : cues?.[index]?.text ?? '';
      if (slide || !shown || !motion) {
        line.getAnimations().forEach(animation => animation.cancel());
      }
      if (slide) {
        if (line.textContent !== text) line.textContent = text;
      } else replaceLyricText(line, text, Boolean(shown && motion && rendered), paints[index]);
      line.hidden = !shown;
      line.classList.toggle('is-sung', index === 1 && Boolean(cues));
      line.title = text;
    });
    const active = rows[1];
    if (shown && viewport && active && (trackChanged || previous?.[1] !== cues?.[1])) {
      const beforeScroll = viewport.scrollTop;
      viewport.scrollTop = Math.max(0, active.offsetTop + (active.offsetHeight - viewport.clientHeight) / 2);
      const delta = viewport.scrollTop - beforeScroll;
      if (delta) for (const line of rows) for (const snapshot of outgoingText.get(line) ?? []) {
        snapshot.style.top = `${parseFloat(snapshot.style.top) + delta}px`;
      }
    }
    rendered = true;
    const height = viewport?.offsetHeight;
    const timing = { duration: 300, easing: 'cubic-bezier(.22,.75,.23,1)' };
    if (viewport && previousHeight !== undefined && height !== undefined && previousHeight !== height) {
      resize = viewport.animate([{ height: `${previousHeight}px` }, { height: `${height}px` }], timing);
    }
    if (!slide) return;
    rows.forEach((line, index) => {
      const cue = cues[index];
      if (index !== 1 && !cue?.text) return;
      const oldIndex = cue ? previous.indexOf(cue) : -1;
      const bounds = line.getBoundingClientRect();
      const offset = oldIndex < 0 ? (backward ? -18 : 18) : (centers[oldIndex]! - (bounds.top + bounds.height / 2)) / scale;
      const oldStyle = oldStyles[oldIndex];
      const currentStyle = getComputedStyle(line);
      const initialScale = oldStyle ? oldStyle.fontSize / parseFloat(currentStyle.fontSize) : 1;
      line.animate([
        { transform: `translateY(${offset}px) scale(${initialScale})`, opacity: oldStyle?.opacity ?? 0, color: oldStyle?.color },
        { transform: 'none', opacity: 1, color: currentStyle.color },
      ], timing);
    });
  };
  return Object.assign(render, { dispose() {
    resize?.cancel();
    rows.forEach(settleLyricText);
    last = null; lastTrack = undefined; rendered = false;
  } });
}
