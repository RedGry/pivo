import artwork from './mascot.svg?raw';
import './mascot.css';

let nextMascot = 0;

export function mountMascot(host: HTMLElement): SVGSVGElement {
  const prefix = `mascot-${++nextMascot}-`;
  host.innerHTML = artwork.replace(/(id="|url\(#)([\w-]+)/g, (_match, start: string, id: string) =>
    start + prefix + id);
  return host.querySelector('svg')!;
}
