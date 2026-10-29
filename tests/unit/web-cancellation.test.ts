import { Cancellation } from "@simpludify/core";
import { expect, it } from "vitest";
import {
  browserAbortSignal,
  CanvasButton,
} from "../../packages/web/src/canvas-node";

it("bridges portable cancellation into browser AbortSignal, including already cancelled owners", () => {
  const owner = new Cancellation(),
    signal = browserAbortSignal(owner.signal);
  expect(signal).toBeInstanceOf(AbortSignal);
  expect(signal.aborted).toBe(false);
  owner.cancel();
  expect(signal.aborted).toBe(true);
  expect(browserAbortSignal(owner.signal).aborted).toBe(true);
});
it("preserves Web button callbacks' native signal and cancels pending work on disposal", async () => {
  let received: AbortSignal | undefined;
  let finish = () => {};
  const button = CanvasButton("pending", (signal) => {
    received = signal;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  button.activate();
  expect(received).toBeInstanceOf(AbortSignal);
  expect(button.busy).toBe(true);
  button.dispose();
  expect(received?.aborted).toBe(true);
  finish();
  await Promise.resolve();
});
