import {
  type ActionController,
  type ActionSet,
  type ActionSource,
  EngineError,
  type InputAdapter,
  type InputSystem,
  Lifetime,
} from "@simpludify/core";
import {
  type CheckedGamepadBinding,
  checkedGamepadBindings,
  type GamepadAxisBinding,
  type GamepadBindings,
  type GamepadButtonBinding,
  type GamepadVector3Binding,
  gamepadDeadZone,
  gamepadIndex,
} from "./gamepad-bindings";
import { type GamepadInfo, inferredGamepadLayout } from "./gamepad-layout";

/** Structural polling boundary also usable by deterministic tests/custom Web hosts. */
export interface GamepadState {
  readonly id: string;
  readonly index: number;
  readonly connected: boolean;
  readonly mapping: string;
  readonly axes: readonly number[];
  readonly buttons: readonly {
    readonly value: number;
    readonly pressed: boolean;
  }[];
}
export type GamepadPoll = () => readonly (GamepadState | null)[];
export interface GamepadOptions<A extends ActionSet> {
  readonly index: number;
  readonly bindings: GamepadBindings<A>;
  readonly deadZone?: number;
  /** Positional constants require standard mapping; raw is an explicit opt-in. */
  readonly mapping?: "standard" | "raw";
}
const finite = (v: unknown, min: number, max: number): number =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(min, Math.min(max, v))
    : 0;
const buttonValue = (pad: GamepadState, index: number): number =>
  finite(pad.buttons[index]?.value, 0, 1);
function scalar(
  pad: GamepadState,
  binding: GamepadAxisBinding,
  deadZone: number,
): number {
  const group = (indices: readonly number[] | undefined) =>
    Math.max(0, ...(indices ?? []).map((index) => buttonValue(pad, index)));
  const raw =
    finite(
      (binding.axis === undefined ? 0 : finite(pad.axes[binding.axis], -1, 1)) +
        group(binding.positive) -
        group(binding.negative),
      -1,
      1,
    ) * (binding.invert ? -1 : 1);
  const zone = binding.deadZone ?? deadZone;
  return Math.abs(raw) <= zone
    ? 0
    : (Math.sign(raw) * (Math.abs(raw) - zone)) / (1 - zone);
}
function values(
  pad: GamepadState,
  bindings: readonly CheckedGamepadBinding[],
  zone: number,
) {
  return bindings.map(([action, binding]) => {
    if (action.kind === "button")
      return [
        action,
        (binding as GamepadButtonBinding).buttons?.some(
          (b) =>
            buttonValue(pad, typeof b === "number" ? b : b.button) >=
            (typeof b === "number" ? 0.5 : (b.threshold ?? 0.5)),
        ) ?? false,
      ] as const;
    if (action.kind === "axis1d")
      return [
        action,
        scalar(pad, binding as GamepadAxisBinding, zone),
      ] as const;
    const b = binding as GamepadVector3Binding,
      x = scalar(pad, b.x ?? {}, zone),
      y = scalar(pad, b.y ?? {}, zone);
    return [
      action,
      action.kind === "axis2d"
        ? { x, y }
        : { x, y, z: scalar(pad, b.z ?? {}, zone) },
    ] as const;
  });
}
function neutral(
  value:
    | boolean
    | number
    | { readonly x: number; readonly y: number; readonly z?: number },
): boolean {
  return typeof value === "boolean"
    ? !value
    : typeof value === "number"
      ? value === 0
      : value.x === 0 && value.y === 0 && (value.z ?? 0) === 0;
}

/** A controller-owned device contribution. Reassignment does not replace its readers/Actors. */
export class GamepadSource<A extends ActionSet> {
  private readonly life = new Lifetime();
  private readonly source: ActionSource<A>;
  private bindings: readonly CheckedGamepadBinding[];
  private assigned: number;
  private armed = false;
  private signature: string | undefined;
  private readonly zone: number;
  private readonly mapping: "standard" | "raw";
  constructor(
    private readonly input: GamepadInput,
    private readonly controller: ActionController<A>,
    options: GamepadOptions<A>,
  ) {
    input.assertController(controller);
    this.assigned = gamepadIndex(options.index);
    this.zone = gamepadDeadZone(options.deadZone ?? 0.15);
    this.mapping = options.mapping ?? "standard";
    if (this.mapping !== "standard" && this.mapping !== "raw")
      throw new EngineError(
        "INVALID_GAMEPAD_BINDING",
        "Unknown gamepad mapping policy",
      );
    this.bindings = checkedGamepadBindings(
      controller.actions,
      options.bindings,
    );
    this.source = controller.createSource();
    this.life.onDispose(() => this.source.dispose());
    this.life.onDispose(controller.onDispose(() => this.dispose()));
  }
  get disposed(): boolean {
    return this.life.disposed;
  }
  get enabled(): boolean {
    return this.source.enabled;
  }
  set enabled(value: boolean) {
    this.alive();
    if (value === this.source.enabled) return;
    this.source.enabled = value;
    this.clear();
  }
  get index(): number {
    return this.assigned;
  }
  get info(): GamepadInfo | undefined {
    return this.input.devices.find((d) => d.index === this.assigned);
  }
  get connected(): boolean {
    return this.info?.connected ?? false;
  }
  get usable(): boolean {
    return (
      this.connected &&
      (this.mapping === "raw" || this.info?.standardMapping === true)
    );
  }
  assign(index: number): void {
    this.alive();
    const checked = gamepadIndex(index);
    if (checked === this.assigned) return;
    this.clear();
    this.signature = undefined;
    this.assigned = checked;
  }
  rebind(bindings: GamepadBindings<A>): void {
    this.alive();
    const checked = checkedGamepadBindings(this.controller.actions, bindings);
    this.clear();
    this.bindings = checked;
  }
  clear(): void {
    this.source.clear();
    this.armed = false;
  }
  private alive(): void {
    if (this.disposed)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Gamepad source has been disposed",
      );
  }
  /** @internal */ sample(
    pad: GamepadState | undefined,
    allowed: boolean,
  ): void {
    if (this.disposed) return;
    if (
      !allowed ||
      !this.enabled ||
      !this.controller.active ||
      !pad ||
      (this.mapping === "standard" && pad.mapping !== "standard")
    ) {
      this.clear();
      this.signature = undefined;
      return;
    }
    const signature = JSON.stringify([
      pad.id,
      pad.mapping,
      pad.buttons.length,
      pad.axes.length,
    ]);
    if (signature !== this.signature) {
      this.clear();
      this.signature = signature;
    }
    const next = values(pad, this.bindings, this.zone);
    if (!this.armed) {
      if (next.every(([, value]) => neutral(value))) this.armed = true;
      return;
    }
    for (const [action, value] of next)
      this.source.set(action as A[keyof A], value as never);
  }
  /** @internal */ onDispose(callback: () => void): () => void {
    return this.life.onDispose(callback);
  }
  dispose(): void {
    this.life.dispose();
  }
}

/** One Web host adapter; multiple sources share a single snapshot per Engine input boundary. */
export class GamepadInput implements InputAdapter {
  private readonly life = new Lifetime();
  private readonly sources = new Set<GamepadSource<ActionSet>>();
  private readonly disconnected = new Set<number>();
  private listed: readonly GamepadInfo[] = Object.freeze([]);
  private readable = false;
  private readonly poll: GamepadPoll;
  private readonly active: () => boolean;
  constructor(
    private readonly input: InputSystem,
    options: {
      readonly poll?: GamepadPoll;
      readonly active?: () => boolean;
      readonly events?: EventTarget;
    } = {},
  ) {
    this.poll =
      options.poll ??
      (() =>
        typeof navigator !== "undefined" &&
        typeof navigator.getGamepads === "function"
          ? navigator.getGamepads()
          : (() => {
              throw new Error("Gamepad API unavailable");
            })());
    this.active = options.active ?? (() => true);
    this.life.onDispose(input.addAdapter(this));
    const events =
        options.events ?? (typeof window === "undefined" ? undefined : window),
      abort = new AbortController();
    this.life.onDispose(() => abort.abort());
    events?.addEventListener(
      "gamepaddisconnected",
      (event) => {
        const index = (event as GamepadEvent).gamepad.index;
        this.disconnected.add(index);
        this.listed = Object.freeze(
          this.listed.filter((d) => d.index !== index),
        );
        for (const source of this.sources)
          if (source.index === index) source.clear();
      },
      { signal: abort.signal },
    );
    events?.addEventListener(
      "gamepadconnected",
      (event) => {
        const index = (event as GamepadEvent).gamepad.index;
        this.disconnected.delete(index);
        for (const source of this.sources)
          if (source.index === index) source.clear();
      },
      { signal: abort.signal },
    );
  }
  get disposed(): boolean {
    return this.life.disposed;
  }
  /** Whether the most recent polling attempt completed; an empty list may still need a user gesture. */
  get available(): boolean {
    return this.readable;
  }
  get devices(): readonly GamepadInfo[] {
    return this.listed;
  }
  /** @internal */ assertController(controller: object): void {
    if (!this.input.hasController(controller))
      throw new EngineError(
        "INVALID_ACTION",
        "Gamepad controller must belong to this InputSystem",
      );
  }
  bind<A extends ActionSet>(
    controller: ActionController<A>,
    options: GamepadOptions<A>,
  ): GamepadSource<A> {
    if (this.disposed)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Gamepad input has been disposed",
      );
    const source = new GamepadSource(this, controller, options);
    const entry = source as unknown as GamepadSource<ActionSet>;
    this.sources.add(entry);
    const remove = this.life.onDispose(() => source.dispose());
    source.onDispose(() => {
      this.sources.delete(entry);
      remove();
    });
    return source;
  }
  sample(): void {
    if (this.disposed) return;
    let snapshots: readonly (GamepadState | null)[];
    try {
      snapshots = this.poll();
      if (!Array.isArray(snapshots))
        throw new Error("Invalid gamepad snapshot");
      this.readable = true;
    } catch {
      snapshots = [];
      this.readable = false;
    }
    const pads = new Map<number, GamepadState>();
    for (const pad of snapshots)
      if (
        pad?.connected &&
        typeof pad.id === "string" &&
        typeof pad.mapping === "string" &&
        Array.isArray(pad.axes) &&
        Array.isArray(pad.buttons) &&
        Number.isSafeInteger(pad.index) &&
        pad.index >= 0
      )
        pads.set(pad.index, pad);
    for (const index of this.disconnected)
      if (!pads.has(index)) this.disconnected.delete(index);
    for (const index of this.disconnected) pads.delete(index);
    this.listed = Object.freeze(
      [...pads.values()]
        .sort((a, b) => a.index - b.index)
        .map((p) =>
          Object.freeze({
            id: p.id,
            index: p.index,
            connected: p.connected,
            mapping: p.mapping,
            standardMapping: p.mapping === "standard",
            buttonCount: p.buttons.length,
            axisCount: p.axes.length,
            inferredLayout: inferredGamepadLayout(p.id),
          }),
        ),
    );
    const allowed = this.active();
    for (const source of this.sources) {
      if (source.disposed) this.sources.delete(source);
      else source.sample(pads.get(source.index), allowed);
    }
  }
  reset(): void {
    for (const source of this.sources) source.clear();
  }
  dispose(): void {
    this.life.dispose();
    this.sources.clear();
    this.listed = Object.freeze([]);
  }
}
