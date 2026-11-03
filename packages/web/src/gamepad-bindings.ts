import {
  type ActionKind,
  type ActionSet,
  type ActionToken,
  EngineError,
} from "@simpludify/core";

/** Standard mapping physical positions, not product-specific printed labels. */
export const GamepadButton = Object.freeze({
  South: 0,
  East: 1,
  West: 2,
  North: 3,
  LeftShoulder: 4,
  RightShoulder: 5,
  LeftTrigger: 6,
  RightTrigger: 7,
  Select: 8,
  Start: 9,
  LeftStick: 10,
  RightStick: 11,
  DPadUp: 12,
  DPadDown: 13,
  DPadLeft: 14,
  DPadRight: 15,
  Home: 16,
});
export type GamepadButton = (typeof GamepadButton)[keyof typeof GamepadButton];
export const GamepadAxis = Object.freeze({
  LeftX: 0,
  LeftY: 1,
  RightX: 2,
  RightY: 3,
});
export type GamepadAxis = (typeof GamepadAxis)[keyof typeof GamepadAxis];
export interface GamepadButtonBinding {
  readonly buttons?: readonly (
    | number
    | { readonly button: number; readonly threshold?: number }
  )[];
}
export interface GamepadAxisBinding {
  readonly axis?: number;
  readonly invert?: boolean;
  readonly negative?: readonly number[];
  readonly positive?: readonly number[];
  readonly deadZone?: number;
}
export interface GamepadVectorBinding {
  readonly x?: GamepadAxisBinding;
  readonly y?: GamepadAxisBinding;
}
export interface GamepadVector3Binding extends GamepadVectorBinding {
  readonly z?: GamepadAxisBinding;
}
export type GamepadBinding<K extends ActionKind> = K extends "button"
  ? GamepadButtonBinding
  : K extends "axis1d"
    ? GamepadAxisBinding
    : K extends "axis2d"
      ? GamepadVectorBinding
      : GamepadVector3Binding;
export type GamepadBindings<A extends ActionSet> = {
  readonly [N in keyof A]?: GamepadBinding<A[N]["kind"]>;
};

const axis = (index: number) => Object.freeze({ axis: index });
/** Ready-to-use data; game Actions retain application-defined names. */
export const GamepadBindings = Object.freeze({
  LeftStick: Object.freeze({ x: axis(0), y: axis(1) }),
  RightStick: Object.freeze({ x: axis(2), y: axis(3) }),
  DPad: Object.freeze({
    x: Object.freeze({
      negative: Object.freeze([14]),
      positive: Object.freeze([15]),
    }),
    y: Object.freeze({
      negative: Object.freeze([12]),
      positive: Object.freeze([13]),
    }),
  }),
  Move: Object.freeze({
    x: Object.freeze({
      axis: 0,
      negative: Object.freeze([14]),
      positive: Object.freeze([15]),
    }),
    y: Object.freeze({
      axis: 1,
      negative: Object.freeze([12]),
      positive: Object.freeze([13]),
    }),
  }),
});

type Binding =
  | GamepadButtonBinding
  | GamepadAxisBinding
  | GamepadVector3Binding;
export type CheckedGamepadBinding = readonly [ActionToken, Binding];
const fail = (): never => {
  throw new EngineError("INVALID_GAMEPAD_BINDING", "Invalid gamepad binding");
};
export function gamepadIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    return fail();
  return value;
}
export function gamepadDeadZone(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value >= 1
  )
    return fail();
  return value;
}
function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    return fail();
  return value as Record<string, unknown>;
}
function axisBinding(value: unknown): GamepadAxisBinding {
  const v = record(value, [
    "axis",
    "invert",
    "negative",
    "positive",
    "deadZone",
  ]);
  const indices = (value: unknown): readonly number[] => {
    if (value === undefined) return Object.freeze([]);
    if (!Array.isArray(value)) return fail();
    return Object.freeze([...new Set(value.map(gamepadIndex))]);
  };
  if (v.invert !== undefined && typeof v.invert !== "boolean") return fail();
  return Object.freeze({
    ...(v.axis === undefined ? {} : { axis: gamepadIndex(v.axis) }),
    invert: v.invert ?? false,
    negative: indices(v.negative),
    positive: indices(v.positive),
    ...(v.deadZone === undefined
      ? {}
      : { deadZone: gamepadDeadZone(v.deadZone) }),
  }) as GamepadAxisBinding;
}
export function checkedGamepadBindings(
  actions: ActionSet,
  value: unknown,
): readonly CheckedGamepadBinding[] {
  const v = record(value, Object.keys(actions));
  return Object.freeze(
    Object.entries(v).map(([name, binding]) => {
      if (!Object.hasOwn(actions, name)) return fail();
      const action = actions[name];
      if (!action) return fail();
      let result: Binding;
      if (action.kind === "button") {
        const b = record(binding, ["buttons"]);
        if (b.buttons !== undefined && !Array.isArray(b.buttons)) return fail();
        result = Object.freeze({
          buttons: Object.freeze(
            ((b.buttons ?? []) as unknown[]).map((item) => {
              if (typeof item === "number") return gamepadIndex(item);
              const b = record(item, ["button", "threshold"]),
                threshold = b.threshold ?? 0.5;
              if (
                typeof threshold !== "number" ||
                !Number.isFinite(threshold) ||
                threshold <= 0 ||
                threshold > 1
              )
                return fail();
              return Object.freeze({
                button: gamepadIndex(b.button),
                threshold,
              });
            }),
          ),
        });
      } else if (action.kind === "axis1d") result = axisBinding(binding);
      else {
        const keys = action.kind === "axis2d" ? ["x", "y"] : ["x", "y", "z"],
          b = record(binding, keys);
        result = Object.freeze(
          Object.fromEntries(keys.map((k) => [k, axisBinding(b[k] ?? {})])),
        );
      }
      return Object.freeze([action, result] as const);
    }),
  );
}
