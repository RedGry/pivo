/** Keep untrusted cursor payloads finite and inside the compact eye cluster. */
export function gazeOffset(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) * 6 : 0;
}

/** Opacity follows geometry so interrupted reveals retain their current appearance. */
export function islandContentOpacity(reveal: number): { compact: number; expanded: number } {
  const compact = Math.max(0, Math.min(1, reveal / 0.3));
  const expanded = Math.max(0, Math.min(1, (reveal - 0.3) / 0.52));
  return {
    compact: 1 - compact * compact * (3 - 2 * compact),
    expanded: expanded * expanded * (3 - 2 * expanded),
  };
}

/** One continuous silhouette with generous concave shoulders and rounded lower corners. */
export function islandFrame(reveal: number, tucked = 0, expandedWidth = 480, stripWidth = 148, stripHeight = 34, minimumWidth = 148, minimumHeight = 34, minimal = 0, settle = 0): { width: number; height: number; compactWidth: number; lift: number; eyeOpacity: number; path: string } {
  const mini = tucked * minimal;
  const fullWidth = Math.max(minimumWidth, 148 + (stripWidth - 148) * tucked);
  const fullHeight = Math.max(minimumHeight, 34 + (stripHeight - 34) * tucked);
  const compactWidth = fullWidth + (56 - fullWidth) * mini;
  const compactHeight = fullHeight + (18 - fullHeight) * mini;
  // Endpoint and travel gains keep the measured settlement peak near 4.5% at every size.
  const width = compactWidth + (expandedWidth - compactWidth) * reveal
    + (expandedWidth * 0.046 + (expandedWidth - compactWidth) * 0.03) * settle;
  const height = compactHeight + (156 - compactHeight) * reveal
    + (156 * 0.046 + (156 - compactHeight) * 0.03) * settle;
  const shoulder = 8 + 12 * reveal;
  const lift = -10 * (1 - reveal) * tucked;
  const top = -lift;
  const depth = (7 - 4 * mini) * (1 - reveal) + 30 * reveal;
  const radius = (17 - 12 * mini) * (1 - reveal) + 30 * reveal;
  const right = width - shoulder;
  const bottom = height - radius;
  const corner = radius * 0.55228475;
  return {
    width, height, compactWidth: reveal === 1 ? expandedWidth : compactWidth, lift, eyeOpacity: (1 - reveal) * (1 - tucked),
    path: `M 0 ${top} C ${shoulder * 0.6} ${top} ${shoulder} ${top + depth * 0.4} ${shoulder} ${top + depth}`
      + ` V ${bottom} C ${shoulder} ${bottom + corner} ${shoulder + radius - corner} ${height} ${shoulder + radius} ${height}`
      + ` H ${right - radius} C ${right - radius + corner} ${height} ${right} ${bottom + corner} ${right} ${bottom}`
      + ` V ${top + depth} C ${right} ${top + depth * 0.4} ${width - shoulder * 0.6} ${top} ${width} ${top} Z`,
  };
}
/** Timer rings drain as the plugin's elapsed progress advances. */
export function remainingProgress(elapsed: number | null): number | null {
  return elapsed === null ? null : 1 - Math.max(0, Math.min(1, Number.isFinite(elapsed) ? elapsed : 0));
}

