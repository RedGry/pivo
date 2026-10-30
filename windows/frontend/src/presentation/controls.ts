/** Match action visibility to the painted island and native input readiness. */
export function actionsVisible(reveal: number, nativeReady: boolean): boolean {
  return reveal === 1 && nativeReady;
}
