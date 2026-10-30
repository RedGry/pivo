const RATE = 32 / 1000;
const SETTLED = 0.0001;

/** Four exact exponential stages preserve motion through interruption without overshoot. */
export class PanelMotion {
  private target = 0;
  private stages = [0, 0, 0, 0];
  private started = 0;

  setExpanded(expanded: boolean, now: number, animate: boolean): void {
    const target = expanded ? 1 : 0;
    if (target === this.target && animate) return;
    this.stages = animate ? this.sample(now) : [target, target, target, target];
    this.target = target;
    this.started = now;
  }

  frame(now: number): { reveal: number; moving: boolean } {
    const stages = this.sample(now);
    const moving = stages.some(value => Math.abs(value - this.target) > SETTLED);
    return { reveal: moving ? stages[3]! : this.target, moving };
  }

  private sample(now: number): number[] {
    const elapsed = Math.max(0, now - this.started) * RATE;
    // Avoid Infinity * 0 after long idle intervals, far beyond subpixel precision.
    if (elapsed >= 40) return [this.target, this.target, this.target, this.target];
    const decay = Math.exp(-elapsed);
    const stages = this.stages.map((_, stage) => {
      let sum = 0;
      let coefficient = 1;
      for (let order = 0; order <= stage; order++) {
        sum += coefficient * (this.stages[stage - order]! - this.target);
        coefficient *= elapsed / (order + 1);
      }
      return this.target + decay * sum;
    });
    return stages.every(value => Math.abs(value - this.target) <= SETTLED)
      ? [this.target, this.target, this.target, this.target] : stages;
  }
}
