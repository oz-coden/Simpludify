import type { LifetimeOwner } from "../foundation/lifetime";
import type { PointerInfo } from "./pointer-routing";

/** @internal Scene-scoped recipients behind Canvas UI; the existing router owns all IDs. */
export interface PointerTarget extends LifetimeOwner {
  readonly available: boolean;
  readonly revision: number;
  subscribe(callback: () => void): () => void;
  contains(data: PointerInfo): boolean;
  deliver(type: "down" | "move" | "up" | "cancel", data: PointerInfo): void;
}
/** @internal */
export interface PointerTargetProvider extends LifetimeOwner {
  pick(data: PointerInfo): PointerTarget | undefined;
}
