export type ObsessionActivity = 'reading' | 'writing' | 'coding';

export type ObsessionGesture = 'snap' | 'farewell' | 'disappointed' | 'smile' | 'stare'
  | 'waited' | 'distress' | 'hug' | 'jealous' | 'clutch'
  | 'plans' | 'patience' | 'falseSleep' | 'peek' | 'thread' | 'visit' | 'coincidence' | 'compatibility' | 'spareHeart'
  | 'tea' | 'search' | 'rehearsal' | 'bouquet' | 'mend' | 'kiss' | 'drawnHearts'
  | 'encourage' | 'juggle' | 'laptop' | 'sharedActivity';

export interface ObsessionState {
  enabled: boolean;
  visible: boolean;
  reducedMotion: boolean;
  presentation: 'strip' | 'eyes' | 'expanded';
  transitionId: number;
}

export interface ObsessionPointer {
  target: 'mascot' | 'clock' | 'none';
  /** Coordinates in the panel's local CSS pixels. */
  x: number;
  y: number;
}

export interface ObsessionCue {
  gesture: ObsessionGesture;
  duration: number;
  count?: number;
  noticed?: boolean;
  activity?: ObsessionActivity;
  point?: Pick<ObsessionPointer, 'x' | 'y'>;
}

interface Clock {
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
  now(): number;
}

export const obsessionDuration: Record<ObsessionGesture, number> = {
  snap: 2000, farewell: 2400, disappointed: 2600, smile: 1600, stare: 2500,
  waited: 2600, distress: 1900, hug: 2300, jealous: 1800, clutch: 480,
  plans: 3200, patience: 2600, falseSleep: 3000, peek: 900, thread: 2800, visit: 2400,
  coincidence: 2600, compatibility: 2800, spareHeart: 3200,
  tea: 3200, search: 2800, rehearsal: 3000, bouquet: 3400, mend: 3200,
  kiss: 1800, drawnHearts: 2200,
  encourage: 2800, juggle: 3000, laptop: 3200, sharedActivity: 3200,
};
const PENDING_LIFETIME = 60_000;

/** Event-driven behavior only. Timers exist solely for finite poses, dwell and sparse idle cues. */
export class ObsessionMotion {
  private state: ObsessionState = { enabled: false, visible: false, reducedMotion: false, presentation: 'strip', transitionId: 0 };
  private active: ObsessionGesture | null = null;
  private pending: { gesture: 'snap' | 'farewell' | 'waited' | 'spareHeart'; until: number } | undefined;
  private completion: unknown;
  private idle: unknown;
  private dwell: unknown;
  private generation = 0;
  private hover: ObsessionPointer['target'] = 'none';
  private pointerGeneration = 0;
  private hoverConsumed = false;
  private disposed = false;
  private visits = 0;
  private clockValue = '';
  private coincidencePending = false;
  private kissPending = false;
  private activity: ObsessionActivity = 'reading';
  private focusRunning = false;
  private readonly clock: Clock;
  private readonly emit: (cue: ObsessionCue | null) => void;
  private readonly random: () => number;

  constructor(clock: Clock, emit: (cue: ObsessionCue | null) => void, random = Math.random) {
    this.clock = clock;
    this.emit = emit;
    this.random = random;
  }

  setState(next: ObsessionState): void {
    if (this.disposed) return;
    const previous = this.state;
    const changed = next.enabled !== previous.enabled;
    const boundary = next.visible !== previous.visible || next.reducedMotion !== previous.reducedMotion
      || next.presentation !== previous.presentation || next.transitionId !== previous.transitionId;
    const reveal = next.enabled && next.visible && next.presentation === 'expanded' && previous.presentation !== 'expanded';
    if (!next.enabled) this.visits = 0;
    else if (reveal) this.visits = Math.min(999, this.visits + 1);
    this.state = { ...next };
    if (changed || boundary) {
      this.cancel();
      this.hover = 'none';
    }
    if (next.reducedMotion) {
      this.pending = undefined;
      return;
    }
    if (changed) this.pending = { gesture: next.enabled ? 'snap' : 'farewell', until: this.clock.now() + PENDING_LIFETIME };
    // Leaving the desktop cancels obsolete reactions, while settings changes made there can queue one new reaction.
    if (!changed && previous.visible && !next.visible) this.pending = undefined;
    if (!next.visible) return;
    if (this.pending && this.clock.now() > this.pending.until) this.pending = undefined;
    if (this.pending && next.presentation === 'expanded') {
      const pending = this.pending.gesture;
      this.pending = undefined;
      this.play(pending);
      return;
    }
    if (!next.enabled) return;
    if (previous.presentation === 'expanded' && next.presentation !== 'expanded' && !changed) {
      this.play('clutch');
      return;
    }
    if (reveal && this.visits > 1) {
      this.play('visit');
      return;
    }
    this.scheduleIdle();
  }

  pointer(pointer: ObsessionPointer): void {
    if (this.disposed || pointer.target === this.hover) return;
    const previous = this.hover;
    const pointerGeneration = ++this.pointerGeneration;
    this.clock.clear(this.dwell);
    this.dwell = undefined;
    this.hover = pointer.target;
    if (this.active === 'falseSleep' && pointer.target === 'mascot') {
      this.play('peek');
      return;
    }
    if (this.active === 'spareHeart' && pointer.target === 'mascot') this.cancel();
    if ((this.active === 'search' || this.active === 'rehearsal' || this.active === 'laptop') && pointer.target !== 'none') this.cancel();
    if (this.active === 'hug' || this.active === 'jealous') this.cancel();
    this.hoverConsumed = false;
    if (previous === 'mascot' && pointer.target === 'none' && !this.active
      && this.allowed() && this.state.presentation === 'expanded') {
      const generation = this.generation;
      // Ordinary folding starts sooner; its state boundary cancels this departure reaction.
      this.dwell = this.clock.set(() => {
        if (generation !== this.generation || pointerGeneration !== this.pointerGeneration
          || this.hover !== 'none' || !this.allowed() || this.state.presentation !== 'expanded') return;
        this.dwell = undefined;
        this.play('search');
      }, 400);
    }
    this.scheduleIdle();
    this.scheduleDwell();
  }

  resume(): void {
    if (!this.allowed()) return;
    if (this.state.presentation === 'strip') {
      this.pending = { gesture: 'waited', until: this.clock.now() + PENDING_LIFETIME };
    } else this.play('waited');
  }

  timerCancelled(): void {
    if (this.allowed() && this.state.presentation === 'expanded') this.play('disappointed');
  }

  setActivity(activity: ObsessionActivity): void {
    if (this.disposed || !['reading', 'writing', 'coding'].includes(activity) || activity === this.activity) return;
    this.activity = activity;
    if (this.allowed() && this.state.presentation === 'expanded') this.play('sharedActivity');
  }

  setFocusRunning(running: boolean): void {
    if (this.disposed || running === this.focusRunning) return;
    this.focusRunning = running;
    if (!running && this.active === 'laptop') {
      this.cancel();
      this.scheduleIdle();
    }
  }

  timerStarted(): void {
    if (this.allowed() && this.state.presentation === 'expanded') {
      this.play('plans');
      this.kissPending = true;
    }
  }

  doubleClick(point: Pick<ObsessionPointer, 'x' | 'y'>): void {
    if (!this.allowed() || this.state.presentation !== 'expanded'
      || !Number.isFinite(point.x) || !Number.isFinite(point.y)
      || point.x < 60 || point.x >= 175 || point.y < 45 || point.y >= 125) return;
    this.play('drawnHearts', point);
  }

  timerBreakStarted(): void {
    if (this.allowed() && this.state.presentation === 'expanded') this.play('tea');
  }

  timerPaused(): void {
    if (this.allowed() && this.state.presentation === 'expanded') this.play('patience');
  }

  timerCompleted(): void {
    if (!this.allowed()) return;
    if (this.state.presentation === 'expanded') this.play('spareHeart');
    else this.pending = { gesture: 'spareHeart', until: this.clock.now() + PENDING_LIFETIME };
  }

  clockChanged(value: string): void {
    const digits = value.replace(':', '');
    if (!/^([01]\d|2[0-3])[0-5]\d$/.test(digits) || digits === this.clockValue) return;
    this.clockValue = digits;
    if (!this.allowed() || this.state.presentation !== 'expanded' || digits.slice(0, 2) !== digits.slice(2)) return;
    if (this.active) this.coincidencePending = true;
    else this.play('coincidence');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pending = undefined;
    this.cancel();
  }

  private allowed(): boolean {
    return !this.disposed && this.state.enabled && this.state.visible && !this.state.reducedMotion;
  }

  private cancel(): void {
    this.generation++;
    this.clock.clear(this.completion);
    this.clock.clear(this.idle);
    this.clock.clear(this.dwell);
    this.completion = this.idle = this.dwell = undefined;
    this.coincidencePending = false;
    this.kissPending = false;
    this.hoverConsumed = true;
    if (this.active) this.emit(null);
    this.active = null;
  }

  private play(gesture: ObsessionGesture, point?: Pick<ObsessionPointer, 'x' | 'y'>): void {
    if (this.disposed || !this.state.visible || this.state.reducedMotion || (gesture !== 'farewell' && !this.state.enabled)) return;
    this.cancel();
    this.active = gesture;
    this.emit({ gesture, duration: obsessionDuration[gesture],
      ...(gesture === 'visit' ? { count: this.visits } : {}),
      ...(gesture === 'spareHeart' ? { noticed: this.hover === 'mascot' } : {}),
      ...(gesture === 'sharedActivity' ? { activity: this.activity } : {}),
      ...(point ? { point: { ...point } } : {}),
    });
    const generation = this.generation;
    this.completion = this.clock.set(() => {
      if (generation !== this.generation || this.disposed) return;
      const kiss = this.kissPending && this.active === 'plans';
      this.kissPending = false;
      this.completion = undefined;
      this.active = null;
      this.emit(null);
      if (kiss) {
        const coincidencePending = this.coincidencePending;
        this.play('kiss');
        this.coincidencePending = coincidencePending;
        return;
      }
      if (this.coincidencePending && this.clockValue.slice(0, 2) === this.clockValue.slice(2)) {
        this.play('coincidence');
        return;
      }
      this.coincidencePending = false;
      this.scheduleIdle();
    }, obsessionDuration[gesture]);
  }

  private scheduleIdle(): void {
    if (!this.allowed() || this.active || this.idle !== undefined || this.state.presentation === 'strip') return;
    const generation = this.generation;
    this.idle = this.clock.set(() => {
      if (generation !== this.generation || !this.allowed()) return;
      this.idle = undefined;
      const gestures: ObsessionGesture[] = this.state.presentation === 'eyes'
        ? ['stare'] : ['smile', 'stare', 'distress', 'falseSleep', 'thread', 'compatibility', 'rehearsal', 'bouquet', 'mend', 'encourage', 'juggle', 'laptop', 'sharedActivity'];
      const index = Math.min(gestures.length - 1, Math.max(0, Math.floor(this.random() * gestures.length)));
      const gesture = gestures[index]!;
      const watched = this.hover !== 'none' && ['falseSleep', 'rehearsal', 'laptop'].includes(gesture);
      this.play(watched || (gesture === 'laptop' && !this.focusRunning) ? 'stare' : gesture);
    }, 18_000 + Math.max(0, Math.min(1, this.random())) * 22_000);
    this.scheduleDwell();
  }

  private scheduleDwell(): void {
    if (!this.allowed() || this.active || this.state.presentation !== 'expanded' || this.hover === 'none'
      || this.hoverConsumed || this.dwell !== undefined) return;
    const target = this.hover;
    const generation = this.generation;
    this.dwell = this.clock.set(() => {
      if (generation !== this.generation || target !== this.hover || !this.allowed()) return;
      this.dwell = undefined;
      this.hoverConsumed = true;
      this.play(target === 'mascot' ? 'hug' : 'jealous');
    }, target === 'mascot' ? 1000 : 700);
  }
}
