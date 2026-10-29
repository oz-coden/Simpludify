import { cleanupAll } from "./lifetime";

/** Owner cancellation, independent of browser AbortSignal and host event types. */
export interface CancellationSignal {
  readonly aborted: boolean;
  onCancel(callback: () => void): () => void;
  throwIfCancelled(): void;
}
export class Cancellation {
  private dead = false;
  private readonly listeners = new Set<() => void>();
  readonly signal: CancellationSignal;
  constructor() {
    const owner = this;
    this.signal = Object.freeze({
      get aborted() {
        return owner.dead;
      },
      onCancel(callback: () => void): () => void {
        if (owner.dead) {
          callback();
          return () => {};
        }
        owner.listeners.add(callback);
        return () => {
          owner.listeners.delete(callback);
        };
      },
      throwIfCancelled(): void {
        if (owner.dead) throw new Error("Operation cancelled");
      },
    });
  }
  cancel(): void {
    if (this.dead) return;
    this.dead = true;
    const callbacks = [...this.listeners];
    this.listeners.clear();
    cleanupAll(callbacks, "Cancellation callbacks failed");
  }
}
