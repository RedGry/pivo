export function seekConfirmed(target: number, reported: number | null, beforeSeek: number | null, acknowledgedAt: number | null, now: number): boolean {
  if (acknowledgedAt === null) return false;
  if (now - acknowledgedAt >= 2000) return true;
  if (reported === null) return false;
  const distance = Math.abs(reported - target);
  return distance <= 1000 && (beforeSeek === null || distance === 0 || distance < Math.abs(beforeSeek - target));
}
