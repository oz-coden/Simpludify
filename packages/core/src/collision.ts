import type { Actor } from "./actor";
import {
  Collider,
  CollisionResponse,
  type Contact,
  ContactEnter,
  ContactExit,
  ContactStay,
} from "./collider";
import { CollisionBody } from "./collision-body";
import {
  contactManifold,
  createGeometry,
  type Geometry,
  type Manifold,
  updateGeometry,
} from "./collision-geometry";
import { correctPositions } from "./collision-response";
import { Transform } from "./components";
import { EngineError } from "./diagnostics";
import type { EventType } from "./events";
import { Lifetime } from "./lifetime";
import { type Scene, SceneState } from "./scene";

export * from "./collider";
export * from "./collision-body";

type MutableContact = { -readonly [K in keyof Contact]: Contact[K] };
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
  readonly aContact: MutableContact;
  readonly bContact: MutableContact;
  seen: number;
  aEntered: boolean;
  bEntered: boolean;
}
export interface CollisionWorldOptions {
  iterations?: number;
  tolerance?: number;
}
const sceneWorlds = new WeakMap<Scene, CollisionWorld>();
/** Scene-owned post-update contact pass with a one-axis sweep broad phase. */
export class CollisionWorld {
  private readonly lifetime = new Lifetime();
  private readonly entries = new Map<Collider, Entry>();
  private readonly pairs = new Map<Entry, Map<Entry, Pair>>();
  private readonly sorted: Entry[] = [];
  private readonly delivery: Pair[] = [];
  private readonly solving: Pair[] = [];
  private readonly manifold: Manifold = { normalX: 0, normalY: 0, depth: 0 };
  private readonly iterations: number;
  private readonly tolerance: number;
  private corrections = 0;
  private solverPasses = 0;
  private unresolved = 0;
  private revision = -1;
  private serial = 0;
  private pass = 0;
  private stepping = false;
  private contactCount = 0;
  private candidates = 0;
  private tests = 0;
  constructor(
    readonly scene: Scene,
    options: CollisionWorldOptions = {},
  ) {
    this.iterations = options.iterations ?? 6;
    this.tolerance = options.tolerance ?? 1e-7;
    if (
      !Number.isInteger(this.iterations) ||
      this.iterations < 1 ||
      this.iterations > 32 ||
      !Number.isFinite(this.tolerance) ||
      this.tolerance < 0
    )
      throw new EngineError(
        "INVALID_VALUE",
        "Collision iterations must be 1..32 and tolerance must be finite and nonnegative",
      );
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
  get responseDiagnostics() {
    return {
      passes: this.solverPasses,
      corrections: this.corrections,
      unresolved: this.unresolved,
    };
  }
  contactsFor(collider: Collider): readonly Contact[] {
    const contacts: Contact[] = [];
    for (const group of this.pairs.values())
      for (const pair of group.values())
        if (pair.seen === this.pass && this.valid(pair)) {
          if (pair.a.collider === collider) contacts.push({ ...pair.aContact });
          else if (pair.b.collider === collider)
            contacts.push({ ...pair.bContact });
        }
    return contacts;
  }
  private inverseMass(entry: Entry): number {
    const body = entry.actor.get(CollisionBody.type);
    return body?.enabled ? body.inverseMass : 0;
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
          geometry: createGeometry(),
        });
    }
  }
  private pair(a: Entry, b: Entry, manifold: Manifold): Pair {
    let sign = 1;
    if (a.id > b.id) {
      const swap = a;
      a = b;
      b = swap;
      sign = -1;
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
          normalX: 0,
          normalY: 0,
          depth: 0,
          response: CollisionResponse.Trigger,
          resolved: false,
          self: a.collider,
          other: b.collider,
          selfActor: a.actor,
          otherActor: b.actor,
        },
        bContact: {
          normalX: 0,
          normalY: 0,
          depth: 0,
          response: CollisionResponse.Trigger,
          resolved: false,
          self: b.collider,
          other: a.collider,
          selfActor: b.actor,
          otherActor: a.actor,
        },
      };
      group.set(b, pair);
      this.contactCount++;
    }
    if (pair.seen !== this.pass) {
      pair.aContact.depth = -1;
      pair.aContact.resolved = false;
      pair.bContact.resolved = false;
    }
    if (manifold.depth >= pair.aContact.depth) {
      pair.aContact.normalX = sign * manifold.normalX;
      pair.aContact.normalY = sign * manifold.normalY;
      pair.aContact.depth = manifold.depth;
      pair.bContact.normalX = -pair.aContact.normalX;
      pair.bContact.normalY = -pair.aContact.normalY;
      pair.bContact.depth = manifold.depth;
    }
    pair.aContact.response = pair.bContact.response =
      a.collider.response === CollisionResponse.Solid &&
      b.collider.response === CollisionResponse.Solid
        ? CollisionResponse.Solid
        : CollisionResponse.Trigger;
    pair.seen = this.pass;
    return pair;
  }
  private remove(pair: Pair): void {
    const group = this.pairs.get(pair.a);
    if (group?.delete(pair.b)) this.contactCount--;
    if (!group?.size) this.pairs.delete(pair.a);
  }
  private capture(): void {
    this.sorted.length = 0;
    for (const entry of this.entries.values())
      if (this.eligible(entry) && updateGeometry(entry))
        this.sorted.push(entry);
    this.sorted.sort(
      (a, b) => a.geometry.minX - b.geometry.minX || a.id - b.id,
    );
  }
  private scan(solidOnly: boolean): void {
    for (let i = 0; i < this.sorted.length; i++) {
      const a = this.sorted[i];
      if (!a) continue;
      for (let j = i + 1; j < this.sorted.length; j++) {
        const b = this.sorted[j];
        if (!b || b.geometry.minX > a.geometry.maxX + this.tolerance) break;
        this.candidates++;
        const solid =
          a.collider.response === CollisionResponse.Solid &&
          b.collider.response === CollisionResponse.Solid;
        if (
          (solidOnly && !solid) ||
          a.geometry.maxY + this.tolerance < b.geometry.minY ||
          b.geometry.maxY + this.tolerance < a.geometry.minY ||
          !(a.collider.mask & b.collider.layer) ||
          !(b.collider.mask & a.collider.layer)
        )
          continue;
        this.tests++;
        if (contactManifold(a, b, this.manifold, this.tolerance)) {
          if (
            !Number.isFinite(this.manifold.depth) ||
            !Number.isFinite(this.manifold.normalX) ||
            !Number.isFinite(this.manifold.normalY)
          )
            throw new EngineError(
              "INVALID_VALUE",
              "Contact geometry overflowed",
            );
          const pair = this.pair(a, b, this.manifold);
          if (solidOnly) this.solving.push(pair);
          else if (
            solid &&
            this.manifold.depth > this.tolerance &&
            (this.inverseMass(a) > 0 || this.inverseMass(b) > 0)
          )
            this.unresolved++;
        }
      }
    }
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
      this.corrections = 0;
      this.solverPasses = 0;
      this.unresolved = 0;
      this.capture(); // Validate every participating geometry before any position correction.
      if (
        this.sorted.some(
          (entry) =>
            entry.collider.response === CollisionResponse.Solid &&
            this.inverseMass(entry) > 0,
        )
      ) {
        for (let iteration = 0; iteration < this.iterations; iteration++) {
          this.solving.length = 0;
          this.scan(true);
          this.solving.sort((a, b) => a.a.id - b.a.id || a.b.id - b.b.id);
          let changed = false;
          this.solverPasses++;
          for (const pair of this.solving) {
            updateGeometry(pair.a);
            updateGeometry(pair.b);
            if (
              !contactManifold(pair.a, pair.b, this.manifold, this.tolerance) ||
              this.manifold.depth <= this.tolerance
            )
              continue;
            if (
              correctPositions(
                pair.a.transform,
                pair.b.transform,
                this.manifold,
                this.inverseMass(pair.a),
                this.inverseMass(pair.b),
              )
            ) {
              changed = true;
              this.corrections++;
              pair.aContact.resolved = pair.bContact.resolved = true;
            }
          }
          if (!changed) break;
          this.capture();
        }
      }
      // Triggers observe corrected positions; solids also retain contacts encountered by the solver.
      this.scan(false);
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
      this.solving.length = 0;
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
      this.solving.length = 0;
      this.delivery.length = 0;
      this.contactCount = 0;
      this.solving.length = 0;
    }
  }
}
