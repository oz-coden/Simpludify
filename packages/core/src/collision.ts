import type { Actor } from "./actor";
import { Component, type ComponentType, defineComponent } from "./component";
import { Transform } from "./components";
import { EngineError, positive } from "./diagnostics";
import { defineEvent, type EventType } from "./events";
import { Lifetime } from "./lifetime";
import { type Scene, SceneState } from "./scene";
export const CollisionShape = { Box: "box", Circle: "circle" } as const;
export type CollisionShape =
  (typeof CollisionShape)[keyof typeof CollisionShape];
type ShapeOptions =
  | { shape?: typeof CollisionShape.Box; width?: number; height?: number }
  | { shape: typeof CollisionShape.Circle; radius?: number };
export type ColliderOptions = ShapeOptions & {
  offsetX?: number;
  offsetY?: number;
  layer?: number;
  mask?: number;
};
export interface Contact {
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
/** Trigger geometry only: detection never moves an Actor or simulates a rigid body. */
export class Collider extends Component {
  static readonly type: ComponentType<Collider> = defineComponent<Collider>(
    "Collider",
    [Transform.type],
  );
  readonly type = Collider.type;
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
interface Geometry {
  x: number;
  y: number;
  hx: number;
  hy: number;
  radius: number;
  cos: number;
  sin: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
interface Entry {
  readonly id: number;
  readonly collider: Collider;
  readonly actor: Actor;
  readonly transform: Transform;
  readonly geometry: Geometry;
}
interface Pair {
  readonly a: Entry;
  readonly b: Entry;
  readonly aContact: Contact;
  readonly bContact: Contact;
  seen: number;
  aEntered: boolean;
  bEntered: boolean;
}
function updateGeometry(entry: Entry): boolean {
  const t = entry.transform,
    c = entry.collider,
    g = entry.geometry;
  finite(t.x, "transform.x");
  finite(t.y, "transform.y");
  finite(t.rotation, "transform.rotation");
  finite(t.scaleX, "transform.scaleX");
  finite(t.scaleY, "transform.scaleY");
  const sx = Math.abs(t.scaleX),
    sy = Math.abs(t.scaleY);
  if (sx === 0 || sy === 0) return false;
  if (
    c.shape === CollisionShape.Circle &&
    Math.abs(sx - sy) > 1e-9 * Math.max(sx, sy)
  )
    throw new EngineError(
      "COLLIDER_SCALE_UNSUPPORTED",
      "Circle colliders require uniform absolute scale",
      { actorId: entry.actor.id },
    );
  g.cos = Math.cos(t.rotation);
  g.sin = Math.sin(t.rotation);
  g.x = t.x + g.cos * c.offsetX * t.scaleX - g.sin * c.offsetY * t.scaleY;
  g.y = t.y + g.sin * c.offsetX * t.scaleX + g.cos * c.offsetY * t.scaleY;
  g.hx = (c.width * sx) / 2;
  g.hy = (c.height * sy) / 2;
  g.radius = c.radius * sx;
  const ex =
    c.shape === CollisionShape.Circle
      ? g.radius
      : Math.abs(g.cos) * g.hx + Math.abs(g.sin) * g.hy;
  const ey =
    c.shape === CollisionShape.Circle
      ? g.radius
      : Math.abs(g.sin) * g.hx + Math.abs(g.cos) * g.hy;
  g.minX = g.x - ex;
  g.maxX = g.x + ex;
  g.minY = g.y - ey;
  g.maxY = g.y + ey;
  return true;
}
function boxCircle(box: Geometry, circle: Geometry): boolean {
  const dx = circle.x - box.x,
    dy = circle.y - box.y;
  const x = dx * box.cos + dy * box.sin,
    y = -dx * box.sin + dy * box.cos;
  const ox = Math.max(Math.abs(x) - box.hx, 0),
    oy = Math.max(Math.abs(y) - box.hy, 0);
  return ox * ox + oy * oy <= circle.radius * circle.radius;
}
function separates(a: Geometry, b: Geometry, x: number, y: number): boolean {
  const distance = Math.abs((b.x - a.x) * x + (b.y - a.y) * y);
  const ar =
    a.hx * Math.abs(a.cos * x + a.sin * y) +
    a.hy * Math.abs(-a.sin * x + a.cos * y);
  const br =
    b.hx * Math.abs(b.cos * x + b.sin * y) +
    b.hy * Math.abs(-b.sin * x + b.cos * y);
  return distance > ar + br;
}
function overlaps(a: Entry, b: Entry): boolean {
  const ag = a.geometry,
    bg = b.geometry;
  if (a.collider.shape === CollisionShape.Circle) {
    if (b.collider.shape === CollisionShape.Circle) {
      const dx = ag.x - bg.x,
        dy = ag.y - bg.y,
        r = ag.radius + bg.radius;
      return dx * dx + dy * dy <= r * r;
    }
    return boxCircle(bg, ag);
  }
  if (b.collider.shape === CollisionShape.Circle) return boxCircle(ag, bg);
  return (
    !separates(ag, bg, ag.cos, ag.sin) &&
    !separates(ag, bg, -ag.sin, ag.cos) &&
    !separates(ag, bg, bg.cos, bg.sin) &&
    !separates(ag, bg, -bg.sin, bg.cos)
  );
}
const sceneWorlds = new WeakMap<Scene, CollisionWorld>();
/** Scene-owned post-update contact pass with a one-axis sweep broad phase. */
export class CollisionWorld {
  private readonly lifetime = new Lifetime();
  private readonly entries = new Map<Collider, Entry>();
  private readonly pairs = new Map<Entry, Map<Entry, Pair>>();
  private readonly sorted: Entry[] = [];
  private readonly delivery: Pair[] = [];
  private revision = -1;
  private serial = 0;
  private pass = 0;
  private stepping = false;
  private contactCount = 0;
  private candidates = 0;
  private tests = 0;
  constructor(readonly scene: Scene) {
    if (sceneWorlds.has(scene))
      throw new EngineError(
        "COLLISION_WORLD_DUPLICATE",
        "Only one automatic collision world may own a scene",
      );
    const off = scene.onPostUpdate(() => this.step());
    const removeOwner = scene.onDispose(() => this.dispose());
    this.lifetime.onDispose(off);
    this.lifetime.onDispose(removeOwner);
    sceneWorlds.set(scene, this);
    this.lifetime.onDispose(() => {
      sceneWorlds.delete(scene);
    });
  }
  get disposed(): boolean {
    return this.lifetime.disposed;
  }
  get diagnostics() {
    return {
      colliders: this.entries.size,
      contacts: this.contactCount,
      candidates: this.candidates,
      narrowTests: this.tests,
    };
  }
  private eligible(entry: Entry): boolean {
    return (
      !entry.collider.disposed &&
      entry.collider.enabled &&
      !entry.actor.disposed &&
      entry.actor.enabled &&
      entry.actor.scene === this.scene &&
      entry.actor.get(Collider.type) === entry.collider
    );
  }
  private valid(pair: Pair): boolean {
    return this.eligible(pair.a) && this.eligible(pair.b);
  }
  private reconcile(): void {
    if (this.revision === this.scene.revision) return;
    this.revision = this.scene.revision;
    for (const [collider, entry] of this.entries)
      if (
        collider.disposed ||
        entry.actor.scene !== this.scene ||
        entry.actor.get(Collider.type) !== collider
      )
        this.entries.delete(collider);
    for (const actor of this.scene.actors) {
      const collider = actor.get(Collider.type);
      if (collider && !this.entries.has(collider))
        this.entries.set(collider, {
          id: ++this.serial,
          collider,
          actor,
          transform: actor.require(Transform.type),
          geometry: {
            x: 0,
            y: 0,
            hx: 0,
            hy: 0,
            radius: 0,
            cos: 1,
            sin: 0,
            minX: 0,
            maxX: 0,
            minY: 0,
            maxY: 0,
          },
        });
    }
  }
  private pair(a: Entry, b: Entry): Pair {
    if (a.id > b.id) {
      const swap = a;
      a = b;
      b = swap;
    }
    let group = this.pairs.get(a);
    if (!group) {
      group = new Map();
      this.pairs.set(a, group);
    }
    let pair = group.get(b);
    if (!pair) {
      pair = {
        a,
        b,
        seen: this.pass,
        aEntered: false,
        bEntered: false,
        aContact: {
          self: a.collider,
          other: b.collider,
          selfActor: a.actor,
          otherActor: b.actor,
        },
        bContact: {
          self: b.collider,
          other: a.collider,
          selfActor: b.actor,
          otherActor: a.actor,
        },
      };
      group.set(b, pair);
      this.contactCount++;
    }
    pair.seen = this.pass;
    return pair;
  }
  private remove(pair: Pair): void {
    const group = this.pairs.get(pair.a);
    if (group?.delete(pair.b)) this.contactCount--;
    if (!group?.size) this.pairs.delete(pair.a);
  }
  step(): void {
    if (this.disposed)
      throw new EngineError(
        "COLLISION_WORLD_DISPOSED",
        "Collision world has been disposed",
      );
    if (this.stepping)
      throw new EngineError(
        "COLLISION_REENTRANT",
        "Contact delivery cannot recursively step the same world",
      );
    if (this.scene.state !== SceneState.Active)
      throw new EngineError(
        "SCENE_STATE",
        "Contact detection requires an active scene",
      );
    this.stepping = true;
    this.pass++;
    this.candidates = 0;
    this.tests = 0;
    const errors: unknown[] = [];
    try {
      this.reconcile();
      this.sorted.length = 0;
      for (const entry of this.entries.values())
        if (this.eligible(entry) && updateGeometry(entry))
          this.sorted.push(entry);
      this.sorted.sort(
        (a, b) => a.geometry.minX - b.geometry.minX || a.id - b.id,
      );
      for (let i = 0; i < this.sorted.length; i++) {
        const a = this.sorted[i];
        if (!a) continue;
        for (let j = i + 1; j < this.sorted.length; j++) {
          const b = this.sorted[j];
          if (!b || b.geometry.minX > a.geometry.maxX) break;
          this.candidates++;
          if (
            a.geometry.maxY < b.geometry.minY ||
            b.geometry.maxY < a.geometry.minY ||
            !(a.collider.mask & b.collider.layer) ||
            !(b.collider.mask & a.collider.layer)
          )
            continue;
          this.tests++;
          if (overlaps(a, b)) this.pair(a, b);
        }
      }
      this.delivery.length = 0;
      for (const group of this.pairs.values())
        for (const pair of group.values()) this.delivery.push(pair);
      this.delivery.sort((a, b) => a.a.id - b.a.id || a.b.id - b.b.id);
      const notify = (
        collider: Collider,
        type: EventType<Contact>,
        contact: Contact,
      ) => {
        try {
          collider.notify(type, contact);
        } catch (error) {
          errors.push(error);
        }
      };
      for (const pair of this.delivery) {
        if (this.disposed) break;
        if (pair.seen !== this.pass || !this.valid(pair)) {
          this.remove(pair);
          if (pair.aEntered && !pair.a.collider.disposed)
            notify(pair.a.collider, ContactExit, pair.aContact);
          if (!this.disposed && pair.bEntered && !pair.b.collider.disposed)
            notify(pair.b.collider, ContactExit, pair.bContact);
          continue;
        }
        const aType = pair.aEntered ? ContactStay : ContactEnter;
        pair.aEntered = true;
        notify(pair.a.collider, aType, pair.aContact);
        if (this.disposed || !this.valid(pair)) continue;
        const bType = pair.bEntered ? ContactStay : ContactEnter;
        pair.bEntered = true;
        notify(pair.b.collider, bType, pair.bContact);
      }
      if (errors.length)
        throw new AggregateError(errors, "Contact handlers failed");
    } finally {
      this.stepping = false;
      this.sorted.length = 0;
      this.delivery.length = 0;
    }
  }
  dispose(): void {
    if (this.disposed) return;
    try {
      this.lifetime.dispose();
    } finally {
      this.entries.clear();
      this.pairs.clear();
      this.sorted.length = 0;
      this.delivery.length = 0;
      this.contactCount = 0;
    }
  }
}
