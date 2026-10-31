import { EngineError } from "../foundation/diagnostics";
import type { LifetimeOwner } from "../foundation/lifetime";
import { Easing, type EasingFunction } from "./easing";

export type TweenCancelReason =
  | "cancelled"
  | "stopped"
  | "replaced"
  | "external-write"
  | "target-unavailable"
  | "owner-disposed"
  | "scheduler-disposed"
  | "error";
export interface TweenBindingOptions {
  readonly target: object;
  readonly key: PropertyKey;
  readonly read: () => number;
  readonly write: ((value: number) => void) | ((value: number) => boolean);
  readonly owner?: LifetimeOwner;
  readonly scope?: () => object | undefined;
  readonly valid?: () => boolean;
  readonly validate?: (value: number) => void;
  readonly stamp?: () => unknown;
  readonly watch?: (
    invalidate: (reason?: TweenCancelReason) => void,
  ) => () => void;
}
/** Explicit numeric write capability. target/key identifies a channel, not a reflected object path. */
export class TweenBinding {
  readonly key: string | symbol;
  constructor(readonly options: TweenBindingOptions) {
    if (
      !options?.target ||
      !["object", "function"].includes(typeof options.target) ||
      !["string", "number", "symbol"].includes(typeof options.key) ||
      typeof options.read !== "function" ||
      typeof options.write !== "function"
    )
      throw new EngineError(
        "INVALID_TWEEN",
        "Binding needs a target, property identity, read and write",
      );
    for (const fn of [
      options.scope,
      options.valid,
      options.validate,
      options.stamp,
      options.watch,
    ])
      if (fn !== undefined && typeof fn !== "function")
        throw new EngineError(
          "INVALID_TWEEN",
          "Binding hooks must be functions",
        );
    this.key =
      typeof options.key === "symbol" ? options.key : String(options.key);
    this.options = Object.freeze({ ...options });
    Object.freeze(this);
  }
}
export interface TweenOptions {
  readonly duration: number;
  readonly from?: number;
  readonly easing?: EasingFunction;
  readonly delay?: number;
  /** Additional iterations, or Infinity. */
  readonly repeat?: number;
  readonly yoyo?: boolean;
}
type NumberRecipe = Readonly<{
  kind: "number";
  binding: TweenBinding;
  to: number;
  duration: number;
  delay: number;
  repeat: number;
  yoyo: boolean;
  easing: EasingFunction;
  from: number | undefined;
}>;
export type TweenRecipe =
  | NumberRecipe
  | Readonly<{ kind: "delay"; duration: number }>
  | Readonly<{
      kind: "sequence" | "parallel";
      children: readonly TweenRecipe[];
    }>;
const recipes = new WeakSet<object>();
export function tweenFinite(value: number, label: string): number {
  if (!Number.isFinite(value))
    throw new EngineError("INVALID_TWEEN", `${label} must be finite`);
  return value;
}
function seconds(value: number, label: string): number {
  tweenFinite(value, label);
  if (value < 0)
    throw new EngineError(
      "INVALID_TWEEN",
      `${label} must be nonnegative seconds`,
    );
  return value;
}
function recipe<T extends TweenRecipe>(value: T): T {
  recipes.add(value);
  return Object.freeze(value);
}
type Equal<X, Y, A, B> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;
export type TweenNumericKey<T> = {
  [K in keyof T]-?: T[K] extends number
    ? Equal<Pick<T, K>, { -readonly [P in K]: T[P] }, K, never>
    : never;
}[keyof T];
export const Tween = Object.freeze({
  bind: (options: TweenBindingOptions): TweenBinding =>
    new TweenBinding(options),
  /** Only writable own numeric data properties on plain records. Classes need explicit adapters. */
  property<T extends object>(target: T, key: TweenNumericKey<T>): TweenBinding {
    const prototype = Object.getPrototypeOf(target),
      descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      !descriptor?.writable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "number"
    )
      throw new EngineError(
        "INVALID_TWEEN",
        "Property binding requires a writable own numeric data property on a plain object",
      );
    tweenFinite(descriptor.value, "property");
    return new TweenBinding({
      target,
      key,
      read: () => (target as Record<PropertyKey, number>)[key] as number,
      write: (value) => {
        (target as Record<PropertyKey, number>)[key] = value;
      },
      valid: () => {
        const d = Object.getOwnPropertyDescriptor(target, key);
        return !!d?.writable && "value" in d && typeof d.value === "number";
      },
    });
  },
  to(binding: TweenBinding, to: number, options: TweenOptions): TweenRecipe {
    if (!(binding instanceof TweenBinding) || !options)
      throw new EngineError(
        "INVALID_TWEEN",
        "Tween.to requires a numeric binding and options",
      );
    tweenFinite(to, "to");
    if (options.from !== undefined) tweenFinite(options.from, "from");
    const duration = seconds(options.duration, "duration"),
      delay = seconds(options.delay ?? 0, "delay"),
      repeat = options.repeat ?? 0,
      yoyo = options.yoyo ?? false,
      easing = options.easing ?? Easing.Linear;
    if (
      (repeat !== Infinity && (!Number.isSafeInteger(repeat) || repeat < 0)) ||
      typeof yoyo !== "boolean" ||
      typeof easing !== "function" ||
      (repeat === Infinity && duration === 0)
    )
      throw new EngineError(
        "INVALID_TWEEN",
        "Invalid repeat, yoyo or easing; infinite zero-duration loops are not allowed",
      );
    if (
      repeat !== Infinity &&
      !Number.isFinite(delay + duration * (repeat + 1))
    )
      throw new EngineError("INVALID_TWEEN", "Tween duration overflows");
    synchronous(binding.options.validate?.(to));
    if (options.from !== undefined)
      synchronous(binding.options.validate?.(options.from));
    return recipe({
      kind: "number",
      binding,
      to,
      duration,
      delay,
      repeat,
      yoyo,
      easing,
      from: options.from,
    });
  },
  delay: (duration: number): TweenRecipe =>
    recipe({ kind: "delay", duration: seconds(duration, "delay") }),
  sequence: (...children: TweenRecipe[]): TweenRecipe =>
    recipe({ kind: "sequence", children: Object.freeze([...children]) }),
  parallel: (...children: TweenRecipe[]): TweenRecipe =>
    recipe({ kind: "parallel", children: Object.freeze([...children]) }),
});
interface Track {
  definition: NumberRecipe;
  start: number;
  end: number;
  from: number | undefined;
  done: boolean;
  channel?: Channel | undefined;
}
interface Channel {
  binding: TweenBinding;
  expected: number;
  stamp: unknown;
}
function same(a: TweenBinding, b: TweenBinding): boolean {
  return a.options.target === b.options.target && a.key === b.key;
}
function compile(root: TweenRecipe) {
  let count = 0;
  const tracks: Track[] = [];
  const visit = (
    item: TweenRecipe,
    start: number,
    depth: number,
  ): { duration: number; bindings: TweenBinding[] } => {
    if (!item || !recipes.has(item) || ++count > 4096 || depth > 64)
      throw new EngineError(
        "INVALID_TWEEN",
        "Expected engine recipes within 4096 nodes / 64 nesting levels",
      );
    if (item.kind === "number") {
      const duration =
        item.repeat === Infinity ? Infinity : item.duration * (item.repeat + 1);
      tracks.push({
        definition: item,
        start: start + item.delay,
        end: duration === Infinity ? Infinity : start + item.delay + duration,
        from: undefined,
        done: false,
      });
      return { duration: item.delay + duration, bindings: [item.binding] };
    }
    if (item.kind === "delay") return { duration: item.duration, bindings: [] };
    let duration = 0;
    const bindings: TweenBinding[] = [];
    for (const child of item.children) {
      if (item.kind === "sequence" && duration === Infinity)
        throw new EngineError(
          "INVALID_TWEEN",
          "An unbounded sequence child must be last",
        );
      const part = visit(
        child,
        start + (item.kind === "sequence" ? duration : 0),
        depth + 1,
      );
      if (
        item.kind === "parallel" &&
        part.bindings.some((b) => bindings.some((a) => same(a, b)))
      )
        throw new EngineError(
          "TWEEN_CONFLICT",
          "Parallel children cannot share a property channel",
        );
      for (const b of part.bindings)
        if (!bindings.some((a) => same(a, b))) bindings.push(b);
      const next =
        item.kind === "sequence"
          ? duration + part.duration
          : Math.max(duration, part.duration);
      if (
        next === Infinity &&
        duration !== Infinity &&
        part.duration !== Infinity
      )
        throw new EngineError("INVALID_TWEEN", "Composite duration overflows");
      duration = next;
    }
    return { duration, bindings };
  };
  const plan = visit(root, 0, 0);
  if (
    tracks.some(
      (t) =>
        t.start === Infinity ||
        (t.end === Infinity && t.definition.repeat !== Infinity),
    )
  )
    throw new EngineError("INVALID_TWEEN", "Track timing overflows");
  return { ...plan, tracks };
}
export interface TweenPlayOptions {
  readonly owner?: LifetimeOwner;
  readonly conflict?: "replace" | "error";
  readonly onComplete?: (playback: TweenPlayback) => void;
  readonly onCancel?: (
    reason: TweenCancelReason,
    playback: TweenPlayback,
  ) => void;
}
export type TweenState = "playing" | "paused" | "completed" | "cancelled";
const claims = new WeakMap<object, Map<string | symbol, TweenPlayback>>();
function synchronous(result: unknown): void {
  if (
    result &&
    (typeof result === "object" || typeof result === "function") &&
    "then" in result &&
    typeof result.then === "function"
  ) {
    void Promise.resolve(result).catch(() => {});
    throw new EngineError(
      "TWEEN_ASYNC_CALLBACK",
      "Tween hooks and callbacks must be synchronous",
    );
  }
}
function notify(callback: (() => unknown) | undefined): void {
  synchronous(callback?.());
}
/** One playback, terminal once. A finished handle drops channels, targets and scheduler references. */
export class TweenPlayback {
  private status: TweenState = "playing";
  private time = 0;
  private updating = false;
  private cause: TweenCancelReason | undefined;
  private removers: Array<() => void> = [];
  private channels: Channel[];
  private tracks: Track[];
  private scheduler: TweenScheduler | undefined;
  private complete: TweenPlayOptions["onComplete"];
  private cancelled: TweenPlayOptions["onCancel"];
  readonly duration: number;
  /** @internal Created by Scheduler.play after recipe validation. */
  constructor(
    scheduler: TweenScheduler,
    plan: ReturnType<typeof compile>,
    options: TweenPlayOptions,
  ) {
    this.scheduler = scheduler;
    this.tracks = plan.tracks;
    this.duration = plan.duration;
    this.complete = options.onComplete;
    this.cancelled = options.onCancel;
    this.channels = plan.bindings.map((binding) => {
      const expected = tweenFinite(binding.options.read(), "start value");
      synchronous(binding.options.validate?.(expected));
      return { binding, expected, stamp: binding.options.stamp?.() };
    });
    for (const track of this.tracks)
      track.channel = this.channels.find((c) =>
        same(c.binding, track.definition.binding),
      );
  }
  get state(): TweenState {
    return this.status;
  }
  get elapsed(): number {
    return this.time;
  }
  get reason(): TweenCancelReason | undefined {
    return this.cause;
  }
  pause(): void {
    if (this.status === "playing") this.status = "paused";
  }
  resume(): void {
    if (this.status === "paused") this.status = "playing";
  }
  cancel(): void {
    this.interrupt("cancelled");
  }
  stop(): void {
    this.interrupt("stopped");
  }
  /** Skip finite delays/iterations and apply terminal values. Infinite playback cannot finish. */
  finish(): void {
    if (this.terminal) return;
    if (this.updating)
      throw new EngineError(
        "TWEEN_REENTRANT",
        "Playback finish is not reentrant",
      );
    if (this.duration === Infinity)
      throw new EngineError(
        "INVALID_TWEEN",
        "Cannot finish unbounded playback",
      );
    const previous = this.status;
    this.status = "playing";
    try {
      this.updateTo(this.duration);
    } catch (error) {
      if (!this.terminal) this.interrupt("error");
      throw error;
    }
    if (!this.terminal && this.status === "playing") this.status = previous;
  }
  private get terminal(): boolean {
    return this.status === "completed" || this.status === "cancelled";
  }
  /** @internal */ valid(scope: object | undefined): boolean {
    return this.channels.every(
      ({ binding: b }) =>
        !b.options.owner?.disposed &&
        (b.options.valid?.() ?? true) &&
        (scope === undefined ||
          !b.options.scope ||
          b.options.scope() === scope),
    );
  }
  /** @internal */ own(owners: Iterable<LifetimeOwner>): void {
    for (const owner of owners) {
      if (this.terminal) break;
      const remove = owner.onDispose(() => this.interrupt("owner-disposed"));
      if (this.terminal) remove();
      else this.removers.push(remove);
    }
  }
  /** @internal Claims are reserved before replaced-owner callbacks run. */
  claim(): Set<TweenPlayback> {
    const replaced = new Set<TweenPlayback>();
    for (const { binding: b } of this.channels) {
      let slots = claims.get(b.options.target);
      if (!slots) {
        slots = new Map();
        claims.set(b.options.target, slots);
      }
      const old = slots.get(b.key);
      if (old) replaced.add(old);
      slots.set(b.key, this);
    }
    return replaced;
  }
  /** @internal */ conflicts(): boolean {
    return this.channels.some(({ binding: b }) =>
      claims.get(b.options.target)?.has(b.key),
    );
  }
  /** @internal */ watch(): void {
    for (const { binding: b } of this.channels) {
      if (this.terminal) break;
      const remove = b.options.watch?.((reason) =>
        this.interrupt(reason ?? "external-write"),
      );
      if (remove) {
        if (this.terminal) remove();
        else this.removers.push(remove);
      }
    }
  }
  private release(): void {
    const errors: unknown[] = [];
    for (const { binding: b } of this.channels) {
      const slots = claims.get(b.options.target);
      if (slots?.get(b.key) === this) {
        slots.delete(b.key);
        if (!slots.size) claims.delete(b.options.target);
      }
    }
    this.channels = [];
    this.tracks = [];
    const scheduler = this.scheduler;
    this.scheduler = undefined;
    scheduler?.remove(this);
    const removers = this.removers;
    this.removers = [];
    for (const remove of removers)
      try {
        remove();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, "Tween resource release failed");
  }
  private end(
    state: "completed" | "cancelled",
    reason?: TweenCancelReason,
  ): void {
    if (this.terminal) return;
    this.status = state;
    this.cause = reason;
    const callback = state === "completed" ? this.complete : this.cancelled;
    this.complete = undefined;
    this.cancelled = undefined;
    const errors: unknown[] = [];
    try {
      this.release();
    } catch (error) {
      errors.push(error);
    }
    try {
      if (state === "completed")
        notify(() => (callback as TweenPlayOptions["onComplete"])?.(this));
      else
        notify(() =>
          (callback as TweenPlayOptions["onCancel"])?.(
            reason as TweenCancelReason,
            this,
          ),
        );
    } catch (error) {
      errors.push(error);
    }
    if (errors.length)
      throw new AggregateError(errors, "Tween termination callbacks failed");
  }
  /** @internal */ interrupt(reason: TweenCancelReason): void {
    this.end("cancelled", reason);
  }
  /** @internal */ advance(delta: number): void {
    if (this.status !== "playing") return;
    const time =
      this.duration !== Infinity && delta >= this.duration - this.time
        ? this.duration
        : this.time + delta;
    tweenFinite(time, "elapsed time");
    this.updateTo(time);
  }
  private updateTo(time: number): void {
    if (this.updating)
      throw new EngineError(
        "TWEEN_REENTRANT",
        "Playback update is not reentrant",
      );
    this.updating = true;
    try {
      this.advanceTo(time);
    } finally {
      this.updating = false;
    }
  }
  private advanceTo(time: number): void {
    if (!this.scheduler?.available || !this.valid(this.scheduler.scope)) {
      this.interrupt("target-unavailable");
      return;
    }
    for (const c of this.channels)
      if (
        !Object.is(c.binding.options.read(), c.expected) ||
        !Object.is(c.binding.options.stamp?.(), c.stamp)
      ) {
        this.interrupt("external-write");
        return;
      }
    this.time = time;
    for (const track of this.tracks) {
      if (this.status !== "playing") return;
      if (track.done || time < track.start) continue;
      const d = track.definition,
        b = d.binding;
      if (track.from === undefined)
        track.from = d.from ?? tweenFinite(b.options.read(), "start value");
      const finished = time >= track.end,
        relative = Math.max(0, time - track.start);
      let progress: number;
      if (finished || d.duration === 0)
        progress = d.yoyo && d.repeat % 2 === 1 ? 0 : 1;
      else if (d.yoyo) {
        const period = d.duration * 2,
          phase = Number.isFinite(period) ? relative % period : relative;
        progress =
          phase <= d.duration
            ? phase / d.duration
            : 1 - (phase - d.duration) / d.duration;
      } else progress = (relative % d.duration) / d.duration;
      const eased =
        progress === 0 ? 0 : progress === 1 ? 1 : d.easing(progress);
      if (!Number.isFinite(eased) || eased < 0 || eased > 1)
        throw new EngineError(
          "INVALID_TWEEN",
          "Easing must return a finite normalized value",
        );
      const value =
        eased === 0
          ? track.from
          : eased === 1
            ? d.to
            : track.from * (1 - eased) + d.to * eased;
      tweenFinite(value, "interpolated value");
      synchronous(b.options.validate?.(value));
      if (
        !this.scheduler?.available ||
        b.options.owner?.disposed ||
        !(b.options.valid?.() ?? true) ||
        (this.scheduler.scope !== undefined &&
          b.options.scope &&
          b.options.scope() !== this.scheduler.scope)
      ) {
        this.interrupt("target-unavailable");
        return;
      }
      const current = track.channel;
      if (
        current &&
        (!Object.is(b.options.read(), current.expected) ||
          !Object.is(b.options.stamp?.(), current.stamp))
      ) {
        this.interrupt("external-write");
        return;
      }
      const written: unknown = b.options.write(value);
      synchronous(written);
      if (this.terminal) return;
      if (written === false) {
        this.interrupt("external-write");
        return;
      }
      const c = track.channel;
      if (c) {
        c.expected = tweenFinite(b.options.read(), "written value");
        c.stamp = b.options.stamp?.();
      }
      track.done = finished;
    }
    if (this.status === "playing" && time >= this.duration)
      this.end("completed");
  }
}
/** Explicit clock. Scene owns automatic clocks; standalone schedulers are advanced by their caller. */
export class TweenScheduler {
  private readonly entries = new Set<TweenPlayback>();
  private roster: readonly TweenPlayback[] = [];
  private dirty = true;
  private plan: readonly TweenPlayback[] = [];
  private advancing = false;
  private dead = false;
  private rate = 1;
  private owner: LifetimeOwner | undefined;
  private removeOwner: (() => void) | undefined;
  readonly scope: object | undefined;
  constructor(options: { owner?: LifetimeOwner; scope?: object } = {}) {
    this.owner = options.owner;
    this.scope = options.scope;
    this.removeOwner = this.owner?.onDispose(() => this.dispose());
  }
  get disposed(): boolean {
    return this.dead;
  }
  /** @internal */ get available(): boolean {
    return !this.dead && !this.owner?.disposed;
  }
  get diagnostics() {
    return { active: this.entries.size };
  }
  get speed(): number {
    return this.rate;
  }
  set speed(value: number) {
    tweenFinite(value, "speed");
    if (value < 0)
      throw new EngineError("INVALID_TWEEN", "speed must be nonnegative");
    this.rate = value;
  }
  play(definition: TweenRecipe, options: TweenPlayOptions = {}): TweenPlayback {
    if (this.dead || this.owner?.disposed || options.owner?.disposed)
      throw new EngineError("OWNER_DISPOSED", "Tween owner has been disposed");
    if (
      options.conflict !== undefined &&
      options.conflict !== "replace" &&
      options.conflict !== "error"
    )
      throw new EngineError("INVALID_TWEEN", "Unknown conflict policy");
    for (const callback of [options.onComplete, options.onCancel])
      if (callback !== undefined && typeof callback !== "function")
        throw new EngineError(
          "INVALID_TWEEN",
          "Tween callbacks must be functions",
        );
    const plan = compile(definition),
      p = new TweenPlayback(this, plan, options);
    if (!p.valid(this.scope))
      throw new EngineError(
        "INVALID_TWEEN",
        "Binding is unavailable or belongs to another scope",
      );
    if (options.conflict === "error" && p.conflicts())
      throw new EngineError(
        "TWEEN_CONFLICT",
        "A property channel is already owned",
      );
    const owners = new Set<LifetimeOwner>();
    if (this.owner) owners.add(this.owner);
    if (options.owner) owners.add(options.owner);
    for (const b of plan.bindings)
      if (b.options.owner) owners.add(b.options.owner);
    try {
      p.own(owners);
    } catch (error) {
      p.interrupt("error");
      throw error;
    }
    if (p.state === "cancelled") return p;
    this.entries.add(p);
    this.dirty = true;
    this.roster = [];
    const replaced = p.claim(),
      errors: unknown[] = [];
    for (const old of replaced)
      try {
        old.interrupt("replaced");
      } catch (error) {
        errors.push(error);
      }
    try {
      p.watch();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) {
      try {
        p.interrupt("error");
      } catch (error) {
        errors.push(error);
      }
      throw new AggregateError(errors, "Tween replacement failed");
    }
    return p;
  }
  /** @internal Eligibility snapshot before the Scene input/update phases. */
  beginStep(): void {
    if (this.dirty) {
      this.roster = [...this.entries];
      this.dirty = false;
    }
    this.plan = this.roster;
  }
  advance(seconds: number): void {
    if (this.advancing)
      throw new EngineError(
        "TWEEN_REENTRANT",
        "Scheduler advance is not reentrant",
      );
    this.beginStep();
    this.advanceCaptured(seconds);
  }
  /** @internal */ advanceCaptured(seconds: number): void {
    if (this.dead)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Tween scheduler has been disposed",
      );
    tweenFinite(seconds, "delta");
    if (seconds < 0)
      throw new EngineError("INVALID_TWEEN", "delta must be nonnegative");
    const delta = tweenFinite(seconds * this.rate, "scaled delta");
    if (this.advancing)
      throw new EngineError(
        "TWEEN_REENTRANT",
        "Scheduler advance is not reentrant",
      );
    this.advancing = true;
    const plan = this.plan;
    this.plan = [];
    const errors: unknown[] = [];
    try {
      for (const p of plan) {
        if (this.dead) break;
        try {
          p.advance(delta);
        } catch (error) {
          errors.push(error);
          try {
            p.interrupt("error");
          } catch (error) {
            errors.push(error);
          }
        }
      }
    } finally {
      this.advancing = false;
    }
    if (errors.length) throw new AggregateError(errors, "Tween updates failed");
  }
  /** @internal */ remove(p: TweenPlayback): void {
    this.entries.delete(p);
    this.dirty = true;
    this.roster = [];
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    const plan = [...this.entries],
      errors: unknown[] = [];
    this.entries.clear();
    this.roster = [];
    this.plan = [];
    this.removeOwner?.();
    this.removeOwner = undefined;
    this.owner = undefined;
    for (const p of plan)
      try {
        p.interrupt("scheduler-disposed");
      } catch (error) {
        errors.push(error);
      }
    if (errors.length)
      throw new AggregateError(errors, "Tween scheduler disposal failed");
  }
}
