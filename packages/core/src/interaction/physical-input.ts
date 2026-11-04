import { EngineError } from "../foundation/diagnostics";
import type { KeyCode } from "./key-code";

export const InputDevice = Object.freeze({
  Keyboard: "keyboard",
  Mouse: "mouse",
  Gamepad: "gamepad",
} as const);
export type InputDevice = (typeof InputDevice)[keyof typeof InputDevice];

/** Standard PointerEvent.button indices; these are not the buttons bit mask. */
export const MouseButton = Object.freeze({
  Left: 0,
  Middle: 1,
  Right: 2,
  Back: 3,
  Forward: 4,
} as const);
export type MouseButton = (typeof MouseButton)[keyof typeof MouseButton];
export function isMouseButton(value: unknown): value is MouseButton {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 4
  );
}
export function parseMouseButton(value: unknown): MouseButton {
  if (!isMouseButton(value))
    throw new EngineError(
      "INVALID_MOUSE_BUTTON",
      "Expected a standard mouse button index (0–4)",
    );
  return value;
}

/** One physical digital input, independent of an Action's gameplay meaning. */
export type PhysicalInput =
  | { readonly device: "keyboard"; readonly code: KeyCode }
  | { readonly device: "mouse"; readonly button: MouseButton }
  | {
      readonly device: "gamepad";
      readonly index: number;
      readonly id: string;
      readonly mapping: string;
      readonly button: number;
    };
