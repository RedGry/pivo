export type AmbientMode = 'eyes' | 'strip';
export type Gesture = 'blink' | 'curious' | 'peek';

interface Timer {
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
}

/** Sparse, finite gestures. No frame loop or wakeups while hidden or reduced-motion. */
export class AmbientMotion {
  private mode: AmbientMode | null = null;
  private timer: unknown;
  private cycle = 0;

  private readonly clock: Timer;
  private readonly gesture: (gesture: Gesture | null) => void;

  constructor(clock: Timer, gesture: (gesture: Gesture | null) => void) {
    this.clock = clock;
    this.gesture = gesture;
  }

  setMode(mode: AmbientMode | null): void {
    if (this.mode === mode) return;
    this.clock.clear(this.timer);
    this.timer = undefined;
    this.gesture(null);
    this.mode = mode;
    this.cycle = 0;
    this.schedule();
  }

  private schedule(): void {
    const mode = this.mode;
    if (!mode) return;
    const delay = mode === 'strip' ? 120_000 + (this.cycle % 3) * 30_000 : 4_500 + (this.cycle % 4) * 700;
    this.timer = this.clock.set(() => {
      this.cycle++;
      this.gesture(mode === 'strip' ? 'peek' : this.cycle % 4 === 0 ? 'curious' : 'blink');
      this.schedule();
    }, delay);
  }
}
