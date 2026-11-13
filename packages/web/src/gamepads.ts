import {
  type ActionController,
  type ActionSet,
  type ActionSource,
  type ActionToken,
  defineEvent,
  EngineError,
  EventBus,
  type InputAdapter,
  type InputSystem,
  Lifetime,
  type LifetimeOwner,
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
  /** Omit to follow ActionController's common gamepad settings. */
  readonly bindings?: GamepadBindings<A>;
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
    (indices ?? []).reduce(
      (maximum, index) => Math.max(maximum, buttonValue(pad, index)),
      0,
    );
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

function intentional(value: Parameters<typeof neutral>[0]): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Math.abs(value) >= 0.12;
  return (
    Math.max(Math.abs(value.x), Math.abs(value.y), Math.abs(value.z ?? 0)) >=
    0.12
  );
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
  private following: boolean;
  private bindingRevision: number;
  private readonly waiting = new Set<ActionToken>();
  private readonly activeBindings = new Set<ActionToken>();
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
    this.following = options.bindings === undefined;
    this.bindingRevision = controller.bindingRevision;
    this.bindings = this.following
      ? this.commonBindings()
      : checkedGamepadBindings(controller.actions, options.bindings);
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
  rebind(bindings?: GamepadBindings<A>): void {
    this.alive();
    const checked =
      bindings === undefined
        ? this.commonBindings()
        : checkedGamepadBindings(this.controller.actions, bindings);
    this.clear();
    this.bindings = checked;
    this.following = bindings === undefined;
    this.bindingRevision = this.controller.bindingRevision;
  }
  private commonBindings(): readonly CheckedGamepadBinding[] {
    return Object.freeze(
      Object.values(this.controller.actions).flatMap((action) => {
        const binding = this.controller.getBinding(
          action as A[keyof A],
        ).gamepad;
        return binding ? [Object.freeze([action, binding] as const)] : [];
      }),
    );
  }
  private syncBindings(): void {
    if (
      !this.following ||
      this.bindingRevision === this.controller.bindingRevision
    )
      return;
    const next = this.commonBindings();
    const before = new Map(this.bindings),
      after = new Map(next);
    for (const action of new Set([...before.keys(), ...after.keys()])) {
      if (
        JSON.stringify(before.get(action)) === JSON.stringify(after.get(action))
      )
        continue;
      this.source.resetBinding(action as A[keyof A]);
      this.activeBindings.delete(action);
      if (after.has(action)) this.waiting.add(action);
      else this.waiting.delete(action);
    }
    this.bindings = next;
    this.bindingRevision = this.controller.bindingRevision;
  }
  clear(): void {
    this.source.clear();
    this.armed = false;
    this.waiting.clear();
    this.activeBindings.clear();
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
  ): boolean {
    if (this.disposed) return false;
    this.syncBindings();
    if (
      !allowed ||
      !this.enabled ||
      !this.controller.active ||
      !pad ||
      (this.mapping === "standard" && pad.mapping !== "standard")
    ) {
      this.clear();
      this.signature = undefined;
      return false;
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
      return false;
    }
    let activity = false;
    for (const [action, value] of next) {
      if (this.waiting.has(action)) {
        if (!neutral(value)) continue;
        this.waiting.delete(action);
      }
      this.source.set(action as A[keyof A], value as never);
      if (neutral(value)) this.activeBindings.delete(action);
      else if (intentional(value) && !this.activeBindings.has(action)) {
        this.activeBindings.add(action);
        activity = true;
      }
    }
    return activity;
  }
  /** @internal */ onDispose(callback: () => void): () => void {
    return this.life.onDispose(callback);
  }
  dispose(): void {
    this.life.dispose();
  }
}

const devicesChanged = defineEvent<void>("GamepadsChanged");

/** One Web host adapter; multiple sources share a single snapshot per Engine input boundary. */
export class GamepadInput implements InputAdapter {
  private readonly life = new Lifetime();
  private readonly changes = new EventBus();
  private readonly sources = new Set<GamepadSource<ActionSet>>();
  private readonly disconnected = new Set<number>();
  private listed: readonly GamepadInfo[] = Object.freeze([]);
  private readable = false;
  private readonly poll: GamepadPoll;
  private readonly active: () => boolean;
  private readonly onActivity: (() => void) | undefined;
  private readonly observe:
    | ((pads: ReadonlyMap<number, GamepadState>) => void)
    | undefined;
  constructor(
    private readonly input: InputSystem,
    options: {
      readonly poll?: GamepadPoll;
      readonly active?: () => boolean;
      readonly events?: EventTarget;
      /** @internal Host capture observes the same poll before any device contribution. */
      readonly observe?: (pads: ReadonlyMap<number, GamepadState>) => void;
      /** @internal Record accepted activity from any assigned controller. */
      readonly onActivity?: () => void;
    } = {},
  ) {
    this.life.onDispose(() => this.changes.dispose());
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
    this.observe = options.observe;
    this.onActivity = options.onActivity;
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
        for (const source of this.sources)
          if (source.index === index) source.clear();
        this.publish(this.listed.filter((d) => d.index !== index));
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
  onChange(handler: () => void, owner?: LifetimeOwner): () => void {
    return this.changes.on(devicesChanged, handler, owner);
  }
  private publish(devices: readonly GamepadInfo[], force = false): void {
    const changed = JSON.stringify(this.listed) !== JSON.stringify(devices);
    this.listed = Object.freeze(devices);
    if (changed || force) this.changes.emit(devicesChanged, undefined);
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
    const wasReadable = this.readable;
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
    const listed = Object.freeze(
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
    this.observe?.(pads);
    const allowed = this.active() && this.input.liveInput;
    let activity = false;
    for (const source of this.sources) {
      if (source.disposed) this.sources.delete(source);
      else if (source.sample(pads.get(source.index), allowed)) activity = true;
    }
    if (activity) this.onActivity?.();
    this.publish(listed, wasReadable !== this.readable);
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
