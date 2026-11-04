import { EngineError, positive } from "../foundation/diagnostics";
import { defineEvent, EventBus } from "../foundation/events";
import {
  cleanupAll,
  Lifetime,
  type LifetimeOwner,
} from "../foundation/lifetime";
import type { Point, ScreenPoint } from "../graphics/coordinates";
import type { PointerInfo } from "./pointer-routing";
import type { PointerTarget } from "./pointer-target";
import {
  checkedVirtualRegion,
  type VirtualPosition,
  type VirtualRegion,
  virtualFinite,
} from "./virtual-regions";

export const VirtualStickMode = {
  Fixed: "fixed",
  Floating: "floating",
  Follow: "follow",
} as const;
export type VirtualStickMode =
  (typeof VirtualStickMode)[keyof typeof VirtualStickMode];
export interface VirtualControlOptions {
  readonly region: VirtualRegion;
  readonly position?: VirtualPosition;
  /** Host CSS pixels, independent of Camera, DPR and Canvas UI scale. */
  readonly radius?: number;
  /** Radial fraction, 0 <= deadZone < 1; the remaining magnitude is rescaled. */
  readonly deadZone?: number;
  readonly enabled?: boolean;
  readonly visible?: boolean;
  /** Presentation seconds to the one-shot onHold notification. Default 0.5. */
  readonly holdDelay?: number;
  readonly color?: number;
}
export interface VirtualStickOptions extends VirtualControlOptions {
  readonly mode?: VirtualStickMode;
}
export interface VirtualButtonOptions extends VirtualControlOptions {
  /** Direction is optional; false by default. The Action remains an ordinary Button. */
  readonly direction?: boolean;
}
export interface VirtualGesture {
  readonly control: VirtualControl;
  readonly pointerId: number;
  readonly pointerType: string;
  readonly origin: ScreenPoint;
  readonly position: ScreenPoint;
  readonly center: ScreenPoint;
  /** Final direction is retained in end/cancel payloads after the live Action is cleared. */
  readonly direction: Point;
  readonly inside: boolean;
  readonly elapsed: number;
}
/** @internal */
export interface VirtualControlHost {
  available(): boolean;
  center(control: VirtualControl): Point;
  contains(control: VirtualControl, data: PointerInfo): boolean;
  region(control: VirtualControl, value: VirtualRegion): void;
  remove(control: VirtualControl): void;
}
/** @internal */
export interface VirtualBinding extends LifetimeOwner {
  write(direction: Point, pressed: boolean): void;
  clear(): void;
  dispose(): void;
  active(): boolean;
}
interface GestureState {
  last: PointerInfo;
  origin: ScreenPoint;
  center: ScreenPoint;
  elapsed: number;
  held: boolean;
}
const screenPoint = (x: number, y: number): ScreenPoint => ({
  space: "screen",
  x: virtualFinite(x, "screen.x"),
  y: virtualFinite(y, "screen.y"),
});
const zero: Point = Object.freeze({ x: 0, y: 0 });
const Start = defineEvent<VirtualGesture>("VirtualStart"),
  Change = defineEvent<VirtualGesture>("VirtualChange"),
  End = defineEvent<VirtualGesture>("VirtualEnd"),
  Cancel = defineEvent<VirtualGesture>("VirtualCancel"),
  Hold = defineEvent<VirtualGesture>("VirtualHold");
function flag(value: boolean): boolean {
  if (typeof value !== "boolean")
    throw new EngineError(
      "INVALID_VIRTUAL_INPUT",
      "Virtual control flags must be boolean",
    );
  return value;
}
function zone(value: number): number {
  virtualFinite(value, "deadZone");
  if (value < 0 || value >= 1)
    throw new EngineError(
      "INVALID_VIRTUAL_INPUT",
      "Dead zone must satisfy 0 <= value < 1",
    );
  return value;
}
function mode(value: VirtualStickMode): VirtualStickMode {
  if (!Object.values(VirtualStickMode).includes(value))
    throw new EngineError(
      "INVALID_VIRTUAL_INPUT",
      "Unknown virtual stick mode",
    );
  return value;
}
/** @internal Validate before allocating ActionSources or registering a target. */
export function checkVirtualOptions(
  options: VirtualStickOptions & VirtualButtonOptions,
): void {
  checkedVirtualRegion(options.region);
  positive(options.radius ?? 64, "radius");
  zone(options.deadZone ?? 0.15);
  flag(options.enabled ?? true);
  flag(options.visible ?? true);
  flag(options.direction ?? false);
  mode(options.mode ?? VirtualStickMode.Fixed);
  if (virtualFinite(options.holdDelay ?? 0.5, "holdDelay") < 0)
    throw new EngineError(
      "INVALID_VIRTUAL_INPUT",
      "Hold delay must be nonnegative",
    );
  if (options.position) {
    virtualFinite(options.position.x, "position.x");
    virtualFinite(options.position.y, "position.y");
    if (
      options.position.space !== undefined &&
      options.position.space !== "screen" &&
      options.position.space !== "viewport"
    )
      throw new EngineError("INVALID_VIRTUAL_INPUT", "Unknown position space");
  }
  const color = options.color ?? 0x66cbb5;
  if (!Number.isInteger(color) || color < 0 || color > 0xffffff)
    throw new EngineError("INVALID_VIRTUAL_INPUT", "Virtual color must be RGB");
}

/** Portable gesture state. Routing, Action composition and rendering retain their existing owners. */
export abstract class VirtualControl implements PointerTarget {
  private readonly life = new Lifetime();
  private readonly events = new EventBus();
  private readonly observers = new Set<() => void>();
  private activation: VirtualRegion;
  private activeFlag: boolean;
  private shown: boolean;
  private size: number;
  private deadZoneValue: number;
  private version = 0;
  private gesture: GestureState | undefined;
  private vector: Point = zero;
  private dragMode: VirtualStickMode;
  readonly position: VirtualPosition | undefined;
  readonly holdDelay: number;
  readonly color: number;
  readonly directional: boolean;
  protected constructor(
    readonly kind: "stick" | "button",
    options: VirtualStickOptions & VirtualButtonOptions,
    private readonly host: VirtualControlHost,
    private readonly binding: VirtualBinding,
  ) {
    checkVirtualOptions(options);
    this.activation = checkedVirtualRegion(options.region);
    this.position = options.position
      ? Object.freeze({ ...options.position })
      : undefined;
    this.activeFlag = options.enabled ?? true;
    this.shown = options.visible ?? true;
    this.size = options.radius ?? (kind === "stick" ? 64 : 28);
    this.deadZoneValue = options.deadZone ?? 0.15;
    this.dragMode = mode(options.mode ?? VirtualStickMode.Fixed);
    this.holdDelay = options.holdDelay ?? 0.5;
    this.color = options.color ?? 0x66cbb5;
    this.directional = kind === "stick" || (options.direction ?? false);
    this.life.onDispose(binding.onDispose(() => this.dispose()));
  }
  get disposed(): boolean {
    return this.life.disposed;
  }
  get available(): boolean {
    return (
      !this.disposed &&
      this.activeFlag &&
      this.host.available() &&
      this.binding.active()
    );
  }
  get revision(): number {
    return this.version;
  }
  get enabled(): boolean {
    return this.activeFlag;
  }
  set enabled(value: boolean) {
    this.alive();
    const next = flag(value);
    if (next === this.activeFlag) return;
    this.activeFlag = next;
    this.interrupt();
  }
  get visible(): boolean {
    return this.shown;
  }
  set visible(value: boolean) {
    this.alive();
    this.shown = flag(value);
  }
  get radius(): number {
    return this.size;
  }
  set radius(value: number) {
    this.alive();
    const next = positive(value, "radius");
    if (next === this.size) return;
    this.size = next;
    this.interrupt();
  }
  get deadZone(): number {
    return this.deadZoneValue;
  }
  set deadZone(value: number) {
    this.alive();
    const next = zone(value);
    if (next === this.deadZoneValue) return;
    this.deadZoneValue = next;
    this.interrupt();
  }
  get region(): VirtualRegion {
    return this.activation;
  }
  set region(value: VirtualRegion) {
    this.alive();
    const next = checkedVirtualRegion(value);
    this.host.region(this, next);
    this.activation = next;
    this.interrupt();
  }
  protected get stickMode(): VirtualStickMode {
    return this.dragMode;
  }
  protected set stickMode(value: VirtualStickMode) {
    this.alive();
    const next = mode(value);
    if (next === this.dragMode) return;
    this.dragMode = next;
    this.interrupt();
  }
  get pointerId(): number | undefined {
    return this.gesture?.last.pointerId;
  }
  get pressed(): boolean {
    return this.gesture !== undefined;
  }
  get elapsed(): number {
    return this.gesture?.elapsed ?? 0;
  }
  get direction(): Point {
    return this.vector;
  }
  get center(): ScreenPoint {
    const p = this.gesture?.center ?? this.host.center(this);
    return Object.freeze(screenPoint(p.x, p.y));
  }
  get knob(): ScreenPoint {
    const center = this.center,
      last = this.gesture?.last.screen;
    if (!last || !this.directional) return center;
    const origin =
      this.kind === "button" ? (this.gesture?.origin ?? center) : center;
    const dx = last.x - origin.x,
      dy = last.y - origin.y,
      length = Math.hypot(dx, dy);
    const scale = length > this.size ? this.size / length : 1;
    return Object.freeze(
      screenPoint(center.x + dx * scale, center.y + dy * scale),
    );
  }
  onDispose(callback: () => void): () => void {
    return this.life.onDispose(callback);
  }
  /** @internal Geometry/availability invalidation, not a per-frame observer. */
  subscribe(callback: () => void): () => void {
    this.alive();
    this.observers.add(callback);
    return () => {
      this.observers.delete(callback);
    };
  }
  onStart(
    callback: (event: VirtualGesture) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(Start, callback, owner);
  }
  onChange(
    callback: (event: VirtualGesture) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(Change, callback, owner);
  }
  onEnd(
    callback: (event: VirtualGesture) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(End, callback, owner);
  }
  onCancel(
    callback: (event: VirtualGesture) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(Cancel, callback, owner);
  }
  onHold(
    callback: (event: VirtualGesture) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(Hold, callback, owner);
  }
  /** Release/cancel only; the captured physical ID stays suppressed until its release. */
  cancel(): void {
    this.alive();
    this.interrupt();
  }
  /** @internal */
  invalidate(): void {
    this.interrupt();
  }
  private alive(): void {
    if (this.disposed)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Virtual control has been disposed",
      );
  }
  private interrupt(): void {
    this.version++;
    cleanupAll(
      [
        ...[...this.observers],
        () => {
          if (this.gesture) this.finish(true);
          else this.binding.clear();
        },
      ],
      "Virtual gesture interruption failed",
    );
  }
  contains(data: PointerInfo): boolean {
    return this.host.contains(this, data);
  }
  private snapshot(g: GestureState): VirtualGesture {
    return Object.freeze({
      control: this,
      pointerId: g.last.pointerId,
      pointerType: g.last.pointerType,
      origin: g.origin,
      position: Object.freeze(screenPoint(g.last.screen.x, g.last.screen.y)),
      center: g.center,
      direction: this.vector,
      inside: this.contains(g.last),
      elapsed: g.elapsed,
    });
  }
  private update(g: GestureState): void {
    if (!this.directional) {
      this.vector = zero;
      return;
    }
    const start = this.kind === "button" ? g.origin : g.center;
    const dx = g.last.screen.x - start.x,
      dy = g.last.screen.y - start.y;
    const length = Math.hypot(dx, dy);
    if (
      this.kind === "stick" &&
      this.dragMode === VirtualStickMode.Follow &&
      length > this.size
    )
      g.center = Object.freeze(
        screenPoint(
          g.last.screen.x - (dx * this.size) / length,
          g.last.screen.y - (dy * this.size) / length,
        ),
      );
    const magnitude = Math.min(1, length / this.size);
    const output =
      magnitude <= this.deadZoneValue
        ? 0
        : (magnitude - this.deadZoneValue) / (1 - this.deadZoneValue);
    this.vector =
      output === 0
        ? zero
        : Object.freeze({
            x: (dx / length) * output,
            y: (dy / length) * output,
          });
  }
  deliver(type: "down" | "move" | "up" | "cancel", data: PointerInfo): void {
    if (type === "cancel") {
      if (this.gesture?.last.pointerId === data.pointerId) this.finish(true);
      return;
    }
    if (type === "down") {
      if (!this.available || this.gesture) return;
      const center =
        this.kind === "stick" && this.dragMode !== VirtualStickMode.Fixed
          ? data.screen
          : this.host.center(this);
      const g: GestureState = {
        last: data,
        origin: Object.freeze(screenPoint(data.screen.x, data.screen.y)),
        center: Object.freeze(screenPoint(center.x, center.y)),
        elapsed: 0,
        held: false,
      };
      this.gesture = g;
      this.update(g);
      this.binding.write(this.vector, true);
      const event = this.snapshot(g);
      cleanupAll(
        [
          () => this.events.emit(Start, event),
          () => {
            if (this.gesture === g) this.events.emit(Change, event);
          },
        ],
        "Virtual start handlers failed",
      );
      return;
    }
    const g = this.gesture;
    if (!g || g.last.pointerId !== data.pointerId) return;
    if (!this.available) {
      this.interrupt();
      return;
    }
    if (
      data.screen.x !== g.last.screen.x ||
      data.screen.y !== g.last.screen.y
    ) {
      g.last = data;
      this.update(g);
      this.binding.write(this.vector, true);
      this.events.emit(Change, this.snapshot(g));
    }
    if (type === "up" && this.gesture === g) {
      g.last = data;
      this.finish(false);
    }
  }
  /** @internal Explicit presentation clock; no browser/OS timer in Core. */
  advance(seconds: number): void {
    const g = this.gesture;
    if (!g) return;
    if (!this.available) {
      this.interrupt();
      return;
    }
    g.elapsed += seconds;
    if (!g.held && g.elapsed >= this.holdDelay) {
      g.held = true;
      this.events.emit(Hold, this.snapshot(g));
    }
  }
  private finish(cancelled: boolean): void {
    const g = this.gesture;
    if (!g) return;
    let event: VirtualGesture | undefined;
    try {
      event = this.snapshot(g);
    } finally {
      this.gesture = undefined;
      this.vector = zero;
      this.binding.clear();
    }
    this.events.emit(cancelled ? Cancel : End, event);
  }
  dispose(): void {
    if (this.disposed) return;
    cleanupAll(
      [
        () => this.life.dispose(),
        () => this.interrupt(),
        () => this.binding.dispose(),
        () => this.events.dispose(),
        () => this.observers.clear(),
        () => this.host.remove(this),
      ],
      "Virtual control cleanup failed",
    );
  }
}
export class VirtualStick extends VirtualControl {
  /** @internal Use VirtualInput.stick. */
  constructor(
    options: VirtualStickOptions,
    host: VirtualControlHost,
    binding: VirtualBinding,
  ) {
    super("stick", options, host, binding);
  }
  get value(): Point {
    return this.direction;
  }
  get mode(): VirtualStickMode {
    return this.stickMode;
  }
  set mode(value: VirtualStickMode) {
    this.stickMode = value;
  }
}
export class VirtualButton extends VirtualControl {
  /** @internal Use VirtualInput.button. */
  constructor(
    options: VirtualButtonOptions,
    host: VirtualControlHost,
    binding: VirtualBinding,
  ) {
    super("button", options, host, binding);
  }
  get value(): boolean {
    return this.pressed;
  }
  /** Confirmation on normal release, including a drag outside the activation region; never on cancel. */
  onCommit(
    callback: (event: VirtualGesture) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.onEnd(callback, owner);
  }
}
