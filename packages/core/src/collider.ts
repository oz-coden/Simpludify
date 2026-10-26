import type { Actor } from "./actor";
import { Component, type ComponentType, defineComponent } from "./component";
import { Transform } from "./components";
import { EngineError, positive } from "./diagnostics";
import { defineEvent, type EventType } from "./events";
export const CollisionShape = { Box: "box", Circle: "circle" } as const;
export type CollisionShape =
  (typeof CollisionShape)[keyof typeof CollisionShape];
export const CollisionResponse = {
  Trigger: "trigger",
  Solid: "solid",
} as const;
export type CollisionResponse =
  (typeof CollisionResponse)[keyof typeof CollisionResponse];
type ShapeOptions =
  | { shape?: typeof CollisionShape.Box; width?: number; height?: number }
  | { shape: typeof CollisionShape.Circle; radius?: number };
export type ColliderOptions = ShapeOptions & {
  response?: CollisionResponse;
  offsetX?: number;
  offsetY?: number;
  layer?: number;
  mask?: number;
};
export interface Contact {
  /** Unit normal from self toward other at detection, before position correction. */
  readonly normalX: number;
  readonly normalY: number;
  readonly depth: number;
  readonly response: CollisionResponse;
  readonly resolved: boolean;
  readonly self: Collider;
  readonly other: Collider;
  readonly selfActor: Actor;
  readonly otherActor: Actor;
}
export const ContactEnter = defineEvent<Contact>("ContactEnter");
export const ContactStay = defineEvent<Contact>("ContactStay");
export const ContactExit = defineEvent<Contact>("ContactExit");
function finite(value: number, name: string): number {
  if (!Number.isFinite(value))
    throw new EngineError("INVALID_VALUE", `${name} must be finite`, {
      field: name,
    });
  return value;
}
function bits(value: number, name: string, allowZero: boolean): number {
  if (
    !Number.isInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > 0xffffffff
  )
    throw new EngineError(
      "INVALID_VALUE",
      `${name} must be an unsigned 32-bit ${allowZero ? "mask" : "nonzero layer"}`,
    );
  return value;
}
/** Geometry and contact policy. CollisionBody separately controls position correction. */
export class Collider extends Component {
  static readonly type: ComponentType<Collider> = defineComponent<Collider>(
    "Collider",
    [Transform.type],
  );
  readonly type = Collider.type;
  readonly response: CollisionResponse;
  readonly shape: CollisionShape;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly layer: number;
  readonly mask: number;
  constructor(options: ColliderOptions = {}) {
    super();
    this.response = options.response ?? CollisionResponse.Trigger;
    if (!Object.values(CollisionResponse).includes(this.response))
      throw new EngineError("INVALID_VALUE", "Unknown collision response");
    this.shape = options.shape ?? CollisionShape.Box;
    if (
      this.shape !== CollisionShape.Box &&
      this.shape !== CollisionShape.Circle
    )
      throw new EngineError("INVALID_VALUE", "Unknown collider shape");
    this.width =
      options.shape === CollisionShape.Circle
        ? 0
        : positive(options.width ?? 32, "width");
    this.height =
      options.shape === CollisionShape.Circle
        ? 0
        : positive(options.height ?? 32, "height");
    this.radius =
      options.shape === CollisionShape.Circle
        ? positive(options.radius ?? 16, "radius")
        : 0;
    this.offsetX = finite(options.offsetX ?? 0, "offsetX");
    this.offsetY = finite(options.offsetY ?? 0, "offsetY");
    this.layer = bits(options.layer ?? 1, "layer", false);
    this.mask = bits(options.mask ?? 0xffffffff, "mask", true);
  }
  /** @internal */ notify(type: EventType<Contact>, contact: Contact): void {
    this.emit(type, contact);
  }
}
