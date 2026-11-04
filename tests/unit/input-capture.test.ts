import {
  InputCapture,
  InputCaptureState,
  InputDevice,
  KeyCode,
  Lifetime,
  MouseButton,
} from "@simpludify/core";
import { expect, it, vi } from "vitest";

it.each([KeyCode.Escape, KeyCode.ShiftLeft, KeyCode.ControlRight, KeyCode.E])(
  "captures the single physical key %s only after arming",
  async (code) => {
    const capture = new InputCapture({ devices: [InputDevice.Keyboard] });
    expect(capture.state).toBe(InputCaptureState.Arming);
    expect(capture.accept({ device: InputDevice.Keyboard, code })).toBe(false);
    capture.arm();
    expect(capture.accept({ device: InputDevice.Keyboard, code })).toBe(true);
    expect(capture.state).toBe(InputCaptureState.Completed);
    const result = await capture.result;
    expect(result).toEqual({
      device: InputDevice.Keyboard,
      code,
      binding: { keys: [code] },
    });
    expect(Object.isFrozen(result?.binding.keys)).toBe(true);
    capture.cancel();
    capture.arm();
    expect(capture.state).toBe(InputCaptureState.Completed);
    expect(capture.accept({ device: InputDevice.Keyboard, code })).toBe(false);
  },
);
it.each(Object.values(MouseButton))(
  "returns a mouse Button binding for %s",
  async (button) => {
    const capture = new InputCapture();
    capture.arm();
    capture.accept({ device: InputDevice.Mouse, button });
    expect(await capture.result).toEqual({
      device: InputDevice.Mouse,
      button,
      binding: { mouse: [button] },
    });
  },
);
it("filters devices and pad assignment, preserving raw device facts", async () => {
  const capture = new InputCapture({
    devices: [InputDevice.Gamepad],
    gamepadIndex: 2,
  });
  capture.arm();
  expect(
    capture.accept({ device: InputDevice.Keyboard, code: KeyCode.Space }),
  ).toBe(false);
  expect(
    capture.accept({
      device: InputDevice.Gamepad,
      index: 0,
      id: "Other",
      mapping: "standard",
      button: 0,
    }),
  ).toBe(false);
  expect(
    capture.accept({
      device: InputDevice.Gamepad,
      index: 2,
      id: "Raw pad",
      mapping: "",
      button: 7,
    }),
  ).toBe(true);
  expect(await capture.result).toEqual({
    device: InputDevice.Gamepad,
    index: 2,
    id: "Raw pad",
    mapping: "",
    button: 7,
    binding: { gamepad: { buttons: [7] } },
  });
});
it("cancels explicitly and with an owner, removing registrations on completion", async () => {
  const callbacks = new Set<() => void>();
  const owner = {
    disposed: false,
    onDispose: (callback: () => void) => {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
  };
  const complete = new InputCapture({ owner });
  complete.arm();
  complete.accept({ device: InputDevice.Keyboard, code: KeyCode.Space });
  expect(callbacks.size).toBe(0);
  const capture = new InputCapture({ owner });
  const cleanup = vi.fn();
  capture.onDispose(cleanup);
  for (const callback of callbacks) callback();
  expect(await capture.result).toBeUndefined();
  expect(capture.state).toBe(InputCaptureState.Cancelled);
  capture.dispose();
  capture.cancel();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(callbacks.size).toBe(0);
});
it("settles and releases every owner even when a cleanup fails", async () => {
  const capture = new InputCapture(),
    cleanup = vi.fn();
  capture.onDispose(cleanup);
  capture.onDispose(() => {
    throw new Error("Fixture cleanup failure");
  });
  expect(() => capture.cancel()).toThrow(AggregateError);
  expect(await capture.result).toBeUndefined();
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(capture.disposed).toBe(true);
});
it("validates capture options and physical values before settling", () => {
  const dead = new Lifetime();
  dead.dispose();
  for (const options of [
    { devices: [] },
    { devices: ["touch"] },
    { gamepadIndex: -1 },
    { owner: dead },
    { unknown: true },
  ])
    expect(() => new InputCapture(options as never)).toThrow();
  const capture = new InputCapture();
  capture.arm();
  for (const input of [
    { device: "touch" },
    { device: "keyboard", code: "InventedKey" },
    { device: "mouse", button: 5 },
    { device: "gamepad", index: 0, button: NaN, id: "", mapping: "" },
  ])
    expect(() => capture.accept(input as never)).toThrow();
  expect(capture.state).toBe(InputCaptureState.Listening);
  capture.cancel();
});
