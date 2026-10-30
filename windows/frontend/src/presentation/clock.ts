/** Only presentations that display time need a minute-boundary wakeup. */
export function clockRefreshDelay(now: Date, visible: boolean, documentHidden: boolean, presentation: 'strip' | 'eyes' | 'expanded'): number | undefined {
  if (!visible || documentHidden || presentation === 'eyes') return undefined;
  return 60_000 - now.getSeconds() * 1000 - now.getMilliseconds();
}
