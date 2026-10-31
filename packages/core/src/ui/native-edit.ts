import type { CanvasActivation } from "./canvas-control";

/** UTF-16 offsets, matching native editors; the Host owns grapheme navigation and painting. */
export interface CanvasTextSnapshot {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly direction: "forward" | "backward" | "none";
  readonly composing: boolean;
}
export interface CanvasNativeSession<D> {
  readonly id: number;
  readonly active: boolean;
  update(draft: D): boolean;
  commit(): boolean;
  cancel(): void;
}
export interface CanvasNativePort<D> {
  begin(source: CanvasActivation): CanvasNativeSession<D> | undefined;
  /** Blur accepts a valid noncomposing draft; all other interruptions cancel. */
  end(reason: "blur" | "interrupt"): void;
}
export type CanvasNativeControl =
  | ({ readonly kind: "select" } & CanvasNativePort<number>)
  | ({ readonly kind: "text" } & CanvasNativePort<CanvasTextSnapshot>);

let nextSession = 0;
/** @internal Every callback is bound to this session and its original control generation. */
export function nativeSession<D>(
  valid: () => boolean,
  update: (draft: D) => void,
  finish: (commit: boolean) => boolean,
): CanvasNativeSession<D> {
  let ended = false;
  const active = () => !ended && valid();
  return Object.freeze({
    id: ++nextSession,
    get active() {
      return active();
    },
    update(draft: D) {
      if (!active()) return false;
      update(draft);
      return active();
    },
    commit() {
      if (!active()) return false;
      ended = true;
      return finish(true);
    },
    cancel() {
      if (ended) return;
      ended = true;
      finish(false);
    },
  });
}
