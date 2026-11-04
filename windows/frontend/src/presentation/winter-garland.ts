const bulbColors = ['#ef9b87', '#f0cf82', '#8ecbe8', '#a7d5ad', '#d5a6e3'] as const;

export function winterGarland(width: number): string {
  const span = Math.max(12, Math.floor(width));
  const inset = 2;
  const length = span - 2 * inset;
  const sections = Math.max(1, Math.round(length / 104));
  const step = length / sections;
  const cable: string[] = [`M${inset} 4`];
  const bulbs: string[] = [];
  const sockets: string[] = [];
  for (let section = 0; section < sections; section++) {
    const x = inset + step * section;
    cable.push(`Q${(x + step / 2).toFixed(2)} 18 ${Number((x + step).toFixed(2))} 4`);
    for (let lamp = 1; lamp <= 5; lamp++) {
      const t = lamp / 6;
      const cx = x + t * step;
      const y = 4 + 28 * t * (1 - t);
      if (cx < 5 || cx > span - 5) continue;
      sockets.push(`M${cx} ${y}v3`);
      const color = bulbColors[(section * 3 + lamp - 1) % bulbColors.length];
      bulbs.push(`<ellipse cx="${cx}" cy="${y + 5}" rx="2.5" ry="3.3" fill="${color}"/>`);
    }
  }
  return `<svg viewBox="0 0 ${span} 22" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${cable.join(' ')}" fill="none" stroke="#6b9b87" stroke-width="1.4" stroke-linecap="round"/><path d="${sockets.join(' ')}" fill="none" stroke="#6b9b87" stroke-width="1.6"/>${bulbs.join('')}</svg>`;
}
