/** Keep untrusted cursor payloads finite and inside the compact eye cluster. */
export function gazeOffset(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) * 2 : 0;
}

/** One continuous silhouette with generous concave shoulders and rounded lower corners. */
export function islandFrame(reveal: number, tucked = 0): { width: number; height: number; lift: number; eyeOpacity: number; path: string } {
  const width = 180 + 380 * reveal;
  const height = 40 + 120 * reveal;
  const shoulder = 12 + 12 * reveal;
  const depth = 12 + 24 * reveal;
  const radius = 18 + 8 * reveal;
  const right = width - shoulder;
  const bottom = height - radius;
  const corner = radius * 0.55228475;
  return {
    width, height, lift: -16 * (1 - reveal) * tucked, eyeOpacity: (1 - reveal) * (1 - tucked),
    path: `M 0 0 C ${shoulder * 0.6} 0 ${shoulder} ${depth * 0.4} ${shoulder} ${depth}`
      + ` V ${bottom} C ${shoulder} ${bottom + corner} ${shoulder + radius - corner} ${height} ${shoulder + radius} ${height}`
      + ` H ${right - radius} C ${right - radius + corner} ${height} ${right} ${bottom + corner} ${right} ${bottom}`
      + ` V ${depth} C ${right} ${depth * 0.4} ${width - shoulder * 0.6} 0 ${width} 0 Z`,
  };
}
/** Timer rings drain as the plugin's elapsed progress advances. */
export function remainingProgress(elapsed: number | null): number | null {
  return elapsed === null ? null : 1 - Math.max(0, Math.min(1, Number.isFinite(elapsed) ? elapsed : 0));
}

