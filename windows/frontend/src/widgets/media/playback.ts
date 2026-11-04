export function playbackConfirmed(target: boolean, reported: boolean, acknowledgedAt: number | null, now: number): boolean {
  return acknowledgedAt !== null && (reported === target || now - acknowledgedAt >= 2000);
}

export function projectedPosition(position: number | null, elapsed: number, rate: number, duration: number | null): number | null {
  return position === null ? null : Math.min(duration ?? Infinity, Math.max(0, position + Math.max(0, elapsed) * rate));
}
