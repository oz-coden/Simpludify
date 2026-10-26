import { EngineError, positive } from "./diagnostics";
import type { LifetimeOwner } from "./lifetime";

interface Timer {
  remaining: number;
  interval: number;
  callback(): void;
  cancel(): void;
  removeOwner?: () => void;
  active: boolean;
}
export class SimulationTimers {
  private readonly timers = new Set<Timer>();
  private dead = false;
  schedule(
    seconds: number,
    callback: () => void,
    repeat: boolean,
    owner?: LifetimeOwner,
  ): () => void {
    if (this.dead || owner?.disposed)
      throw new EngineError("OWNER_DISPOSED", "Timer owner has been disposed");
    if (repeat) positive(seconds, "interval");
    else if (!Number.isFinite(seconds) || seconds < 0)
      throw new EngineError(
        "INVALID_VALUE",
        "Timer delay must be finite and nonnegative",
      );
    const timer: Timer = {
      remaining: seconds,
      interval: repeat ? seconds : 0,
      callback,
      active: true,
      cancel: () => {
        if (!timer.active) return;
        timer.active = false;
        this.timers.delete(timer);
        timer.removeOwner?.();
        delete timer.removeOwner;
      },
    };
    this.timers.add(timer);
    if (owner) {
      try {
        timer.removeOwner = owner.onDispose(timer.cancel);
      } catch (error) {
        timer.cancel();
        throw error;
      }
    }
    return timer.cancel;
  }
  step(seconds: number): void {
    if (!this.timers.size) return;
    const errors: unknown[] = [];
    for (const timer of [...this.timers]) {
      if (!timer.active) continue;
      timer.remaining -= seconds;
      if (timer.remaining > 1e-12) continue;
      if (timer.interval === 0) timer.cancel();
      else timer.remaining = timer.interval;
      try {
        timer.callback();
      } catch (error) {
        errors.push(error);
      }
      if (this.dead) break;
    }
    if (errors.length)
      throw new AggregateError(errors, "Timer callbacks failed");
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    for (const timer of this.timers) timer.cancel();
  }
}
