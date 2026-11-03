import { EngineError } from "../foundation/diagnostics";
import { cleanupAll, type LifetimeOwner } from "../foundation/lifetime";
/** @internal Shared lifetime for logical and device contributions. */
export abstract class OwnedInputSource {
  private dead = false;
  private accepting = true;
  private removeOwner: (() => void) | undefined;
  get disposed(): boolean {
    return this.dead;
  }
  get enabled(): boolean {
    return this.accepting;
  }
  set enabled(value: boolean) {
    if (this.dead)
      throw new EngineError("OWNER_DISPOSED", "Input source has been disposed");
    if (typeof value !== "boolean")
      throw new EngineError("INVALID_VALUE", "Source enabled must be boolean");
    if (value === this.accepting) return;
    this.accepting = value;
    if (!value) this.release(false);
  }
  /** @internal */ own(owner: LifetimeOwner): void {
    if (owner.disposed)
      throw new EngineError("OWNER_DISPOSED", "Input owner has been disposed");
    this.removeOwner = owner.onDispose(() => this.dispose());
  }
  protected writable(neutral: boolean): boolean {
    if (!this.dead) return this.accepting;
    if (neutral) return false;
    throw new EngineError("OWNER_DISPOSED", "Input source has been disposed");
  }
  protected abstract release(remove: boolean): void;
  clear(): void {
    if (!this.dead) this.release(false);
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const remove = this.removeOwner;
    this.removeOwner = undefined;
    cleanupAll(
      [() => this.release(true), () => remove?.()],
      "Input source cleanup failed",
    );
  }
}
