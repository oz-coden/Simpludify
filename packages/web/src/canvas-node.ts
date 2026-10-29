import {
  type CancellationSignal,
  type CanvasNode,
  type CanvasStyle,
  CanvasButton as CoreCanvasButton,
} from "@simpludify/core";

export {
  CanvasColumn,
  CanvasHoldButton,
  CanvasLabel,
  CanvasNode,
  type CanvasNodeKind,
  type CanvasNodeOwner,
  CanvasPanel,
  CanvasRow,
  type CanvasStyle,
  defaultCanvasStyle,
  type ResolvedCanvasStyle,
  type UIAlign,
  type UIBounds,
  type UIJustify,
  type UISize,
} from "@simpludify/core";

/** Bridge owner cancellation to browser APIs such as fetch. */
export function browserAbortSignal(signal: CancellationSignal): AbortSignal {
  const controller = new AbortController();
  signal.onCancel(() => controller.abort());
  return controller.signal;
}
/** Preserve Web callbacks' native AbortSignal; portable definitions import Core's factory. */
export function CanvasButton(
  text: string,
  click: (signal: AbortSignal) => void | Promise<void>,
  style: CanvasStyle = {},
): CanvasNode {
  let signal: AbortSignal | undefined;
  return CoreCanvasButton(
    text,
    (owner) => {
      signal ??= browserAbortSignal(owner);
      return click(signal);
    },
    style,
  );
}
