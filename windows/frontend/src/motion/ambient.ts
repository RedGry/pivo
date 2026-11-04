export type AmbientMode = 'eyes' | 'strip';
export type Gesture = 'blink' | 'curious' | 'drowsy' | 'asleep' | 'wake' | 'wave' | 'strip-blink' | 'strip-wink';

interface Timer {
  now(): number;
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
}

const DROWSY_AFTER = 24_000;
const DROWSY_DURATION = 700;
const WAKE_DURATION = 1_150;

/** Sparse, finite expressions. Sleeping and disabled modes leave no timer running. */
export class AmbientMotion {
  private mode: AmbientMode | null = null;
  private timer: unknown;
  private cycle = 0;
  private activityAt = 0;
  private resting = false;

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
    this.resting = false;
    this.activityAt = this.clock.now();
    this.schedule();
  }

  activity(): void {
    if (this.mode !== 'eyes') return;
    this.activityAt = this.clock.now();
    if (!this.resting) return;
    this.resting = false;
    this.clock.clear(this.timer);
    this.gesture('wake');
    this.timer = this.clock.set(() => this.schedule(), WAKE_DURATION);
  }

  private schedule(): void {
    if (this.mode === 'strip') {
      this.timer = this.clock.set(() => {
        this.cycle++;
        this.gesture(this.cycle % 6 === 0 ? 'wave' : this.cycle % 3 === 0 ? 'strip-wink' : 'strip-blink');
        this.schedule();
      }, 8_000 + (this.cycle % 3) * 2_000);
      return;
    }
    if (this.mode !== 'eyes') return;
    const delay = 4_500 + (this.cycle % 4) * 700;
    const untilDrowsy = Math.max(0, this.activityAt + DROWSY_AFTER - this.clock.now());
    this.timer = this.clock.set(() => {
      if (this.clock.now() - this.activityAt >= DROWSY_AFTER) {
        this.resting = true;
        this.gesture('drowsy');
        this.timer = this.clock.set(() => {
          this.timer = undefined;
          this.gesture('asleep');
        }, DROWSY_DURATION);
        return;
      }
      this.cycle++;
      this.gesture(this.cycle % 4 === 0 ? 'curious' : 'blink');
      this.schedule();
    }, Math.min(delay, untilDrowsy));
  }
}
