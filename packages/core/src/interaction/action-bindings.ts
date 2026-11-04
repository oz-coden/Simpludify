import { EngineError } from "../foundation/diagnostics";
import type { ActionKind, ActionSet, ActionToken } from "./action-types";
import {
  checkedGamepadBindings,
  type GamepadBinding,
} from "./gamepad-bindings";
import { KeyCode, parseKeyCode } from "./key-code";
import { type MouseButton, parseMouseButton } from "./physical-input";
export interface ButtonBinding {
  readonly keys?: readonly KeyCode[];
  readonly mouse?: readonly MouseButton[];
}
export interface Axis1DBinding {
  readonly negative?: readonly KeyCode[];
  readonly positive?: readonly KeyCode[];
  readonly mouseNegative?: readonly MouseButton[];
  readonly mousePositive?: readonly MouseButton[];
}
export interface Axis2DBinding {
  readonly x?: Axis1DBinding;
  readonly y?: Axis1DBinding;
}
export interface Axis3DBinding extends Axis2DBinding {
  readonly z?: Axis1DBinding;
}
export type ActionBinding<K extends ActionKind> = (K extends "button"
  ? ButtonBinding
  : K extends "axis1d"
    ? Axis1DBinding
    : K extends "axis2d"
      ? Axis2DBinding
      : Axis3DBinding) & { readonly gamepad?: GamepadBinding<K> };
export type ActionBindings<A extends ActionSet> = {
  readonly [N in keyof A]?: ActionBinding<A[N]["kind"]>;
};
type Binding = ActionBinding<ActionKind>;
export function checkedBinding(action: ActionToken, value: unknown): Binding {
  const record = (v: unknown, allowed: readonly string[]) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new EngineError("INVALID_BINDING", "Binding must be an object");
    const r = v as Record<string, unknown>;
    if (Object.keys(r).some((k) => !allowed.includes(k)))
      throw new EngineError("INVALID_BINDING", "Unknown binding field", {
        action: action.name,
      });
    return r;
  };
  const codes = (v: unknown): readonly KeyCode[] => {
    if (v === undefined) return Object.freeze([]);
    if (!Array.isArray(v))
      throw new EngineError("INVALID_BINDING", "Key list must be an array");
    return Object.freeze([...new Set(v.map(parseKeyCode))]);
  };
  const mice = (v: unknown): readonly MouseButton[] => {
    if (!Array.isArray(v))
      throw new EngineError(
        "INVALID_BINDING",
        "Mouse button list must be an array",
      );
    return Object.freeze([...new Set(v.map(parseMouseButton))]);
  };
  const axis = (v: unknown, root = false): Axis1DBinding => {
    const r = record(v ?? {}, [
      "negative",
      "positive",
      "mouseNegative",
      "mousePositive",
      ...(root ? ["gamepad"] : []),
    ]);
    return Object.freeze({
      negative: codes(r.negative),
      positive: codes(r.positive),
      ...(r.mouseNegative === undefined
        ? {}
        : { mouseNegative: mice(r.mouseNegative) }),
      ...(r.mousePositive === undefined
        ? {}
        : { mousePositive: mice(r.mousePositive) }),
    });
  };
  const r = record(
    value,
    action.kind === "button"
      ? ["keys", "mouse", "gamepad"]
      : action.kind === "axis1d"
        ? ["negative", "positive", "mouseNegative", "mousePositive", "gamepad"]
        : action.kind === "axis2d"
          ? ["x", "y", "gamepad"]
          : ["x", "y", "z", "gamepad"],
  );
  let gamepad: GamepadBinding<ActionKind> | undefined;
  if (r.gamepad !== undefined) {
    const checked = checkedGamepadBindings(
      { [action.name]: action },
      { [action.name]: r.gamepad },
    )[0];
    if (!checked)
      throw new EngineError("INVALID_BINDING", "Missing gamepad binding");
    gamepad = checked[1];
  }
  const base =
    action.kind === "button"
      ? {
          keys: codes(r.keys),
          ...(r.mouse === undefined ? {} : { mouse: mice(r.mouse) }),
        }
      : action.kind === "axis1d"
        ? axis(value, true)
        : action.kind === "axis2d"
          ? { x: axis(r.x), y: axis(r.y) }
          : { x: axis(r.x), y: axis(r.y), z: axis(r.z) };
  return Object.freeze({
    ...base,
    ...(gamepad === undefined ? {} : { gamepad }),
  });
}
export function keyLists(
  binding: Binding,
  path = "",
): Array<{ path: string; keys: readonly KeyCode[] }> {
  const lists: Array<{ path: string; keys: readonly KeyCode[] }> = [];
  for (const [key, value] of Object.entries(binding)) {
    if (key === "keys" || key === "negative" || key === "positive")
      lists.push({ path: path + key, keys: value as readonly KeyCode[] });
    else if (key === "x" || key === "y" || key === "z")
      lists.push(...keyLists(value, `${path}${key}.`));
  }
  return lists;
}
export function mouseLists(
  binding: Binding,
  path = "",
): Array<{ path: string; buttons: readonly MouseButton[] }> {
  const lists: Array<{ path: string; buttons: readonly MouseButton[] }> = [];
  for (const [key, value] of Object.entries(binding)) {
    if (key === "mouse" || key === "mouseNegative" || key === "mousePositive")
      lists.push({
        path: path + key,
        buttons: value as readonly MouseButton[],
      });
    else if (key === "x" || key === "y" || key === "z")
      lists.push(...mouseLists(value, `${path}${key}.`));
  }
  return lists;
}
export function gamepadControls(
  binding: GamepadBinding<ActionKind>,
  path = "gamepad",
): Array<{ kind: "button" | "axis"; index: number; path: string }> {
  const result: Array<{
    kind: "button" | "axis";
    index: number;
    path: string;
  }> = [];
  for (const [name, value] of Object.entries(binding)) {
    if (name === "axis" && typeof value === "number")
      result.push({ kind: "axis", index: value, path: `${path}.axis` });
    else if (name === "buttons" || name === "negative" || name === "positive") {
      for (const item of value as readonly (
        | number
        | { readonly button: number }
      )[])
        result.push({
          kind: "button",
          index: typeof item === "number" ? item : item.button,
          path: `${path}.${name}`,
        });
    } else if (name === "x" || name === "y" || name === "z")
      result.push(...gamepadControls(value, `${path}.${name}`));
  }
  return result;
}
function editGamepad(
  current: unknown,
  patch: unknown,
  remove: boolean,
): unknown {
  if (Array.isArray(patch)) {
    const old = Array.isArray(current) ? current : [];
    const control = (v: unknown) =>
      v && typeof v === "object" && "button" in v ? v.button : v;
    return remove
      ? old.filter((v) => !patch.some((p) => control(p) === control(v)))
      : [
          ...new Map(
            [...old, ...patch].map((v) => [JSON.stringify(v), v]),
          ).values(),
        ];
  }
  if (patch && typeof patch === "object") {
    const result: Record<string, unknown> =
      current && typeof current === "object" ? { ...current } : {};
    for (const [key, value] of Object.entries(patch)) {
      const edited = editGamepad(result[key], value, remove);
      if (edited === undefined) delete result[key];
      else result[key] = edited;
    }
    return result;
  }
  return remove ? (current === patch ? undefined : current) : patch;
}
export function editBinding(
  current: Binding,
  patch: Binding,
  remove: boolean,
): Binding {
  const result: Record<string, unknown> = { ...current };
  for (const [name, value] of Object.entries(patch)) {
    const old = (current as Record<string, unknown>)[name];
    if (name === "gamepad") result[name] = editGamepad(old, value, remove);
    else if (Array.isArray(value))
      result[name] = remove
        ? ((old ?? []) as unknown[]).filter((k) => !value.includes(k))
        : [...new Set([...((old ?? []) as unknown[]), ...value])];
    else result[name] = editBinding(old as Binding, value as Binding, remove);
  }
  return result as Binding;
}

/** Physical keyboard presets for any user-defined Axis2D Action. */
export const KeyboardBindings = Object.freeze({
  WASD: Object.freeze({
    x: Object.freeze({
      negative: Object.freeze([KeyCode.A]),
      positive: Object.freeze([KeyCode.D]),
    }),
    y: Object.freeze({
      negative: Object.freeze([KeyCode.W]),
      positive: Object.freeze([KeyCode.S]),
    }),
  }),
  Arrows: Object.freeze({
    x: Object.freeze({
      negative: Object.freeze([KeyCode.ArrowLeft]),
      positive: Object.freeze([KeyCode.ArrowRight]),
    }),
    y: Object.freeze({
      negative: Object.freeze([KeyCode.ArrowUp]),
      positive: Object.freeze([KeyCode.ArrowDown]),
    }),
  }),
});
