import { EngineError } from "@simpludify/core";
import { GamepadButton, gamepadIndex } from "./gamepad-bindings";

export type GamepadLayout = "generic" | "xbox" | "playstation" | "nintendo";
export interface GamepadInfo {
  /** Unmodified browser string; never a persistent individual-device identifier. */
  readonly id: string;
  readonly index: number;
  readonly connected: boolean;
  readonly mapping: string;
  readonly standardMapping: boolean;
  readonly buttonCount: number;
  readonly axisCount: number;
  /** Heuristic ID hint, not a browser fact or guaranteed product detection. */
  readonly inferredLayout: GamepadLayout;
}
const positions = Object.fromEntries(
  Object.entries(GamepadButton).map(([name, index]) => [index, name]),
);
const faces: Readonly<Record<GamepadLayout, readonly string[]>> = Object.freeze(
  {
    generic: Object.freeze(["South", "East", "West", "North"]),
    xbox: Object.freeze(["A", "B", "X", "Y"]),
    playstation: Object.freeze(["×", "○", "□", "△"]),
    nintendo: Object.freeze(["B", "A", "Y", "X"]),
  },
);
export function gamepadButtonLabel(
  button: number,
  options: {
    readonly layout?: GamepadLayout;
    readonly overrides?: Readonly<Record<number, string>>;
  } = {},
): string {
  gamepadIndex(button);
  const layout = options.layout ?? "generic";
  if (!Object.hasOwn(faces, layout))
    throw new EngineError(
      "INVALID_GAMEPAD_BINDING",
      "Unknown gamepad display layout",
    );
  if (options.overrides && Object.hasOwn(options.overrides, button)) {
    const label = options.overrides[button];
    if (typeof label !== "string")
      throw new EngineError(
        "INVALID_GAMEPAD_BINDING",
        "Button label must be a string",
      );
    return label;
  }
  return faces[layout][button] ?? positions[button] ?? `Button ${button}`;
}
export function inferredGamepadLayout(id: string): GamepadLayout {
  if (/dualsense|dualshock|playstation|054c/i.test(id)) return "playstation";
  if (/nintendo|switch|057e/i.test(id)) return "nintendo";
  if (/xbox|xinput|045e/i.test(id)) return "xbox";
  return "generic";
}
