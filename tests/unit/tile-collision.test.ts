import {
  Actor,
  BodyType,
  Collider,
  type ColliderOptions,
  CollisionBody,
  CollisionShape,
  CollisionWorld,
  ContactEnter,
  Engine,
  Grid,
  CollisionResponse as R,
  Scene,
  SpriteSheet,
  type TileContact,
  TileContactEnter,
  TileContactExit,
  TileContactStay,
  Tilemap,
  Transform,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";

const sheet = SpriteSheet.grid("never-loaded.png", {
  frameWidth: 16,
  frameHeight: 16,
  names: { wall: 0, stone: 1, water: 2 },
});
function setup(options: ConstructorParameters<typeof CollisionWorld>[1] = {}) {
  const engine = new Engine(),
    scene = engine.scene,
    world = new CollisionWorld(scene, options);
  const map = new Tilemap({
    sheet,
    tiles: [["wall", "stone", "water", null]],
    tileWidth: 32,
    tileHeight: 32,
    collision: {
      tiles: [
        { tile: "wall", response: R.Solid },
        { tile: "stone", response: R.Solid },
        { tile: "water", response: R.Trigger },
      ],
    },
  }).place(scene);
  function add(
    x = -5,
    y = 16,
    options: ColliderOptions = { shape: CollisionShape.Circle, radius: 10 },
    mass: number | null = 1,
  ) {
    const actor = scene.add(new Actor()),
      t = actor.add(new Transform({ x, y }));
    const collider = actor.add(
      new Collider({ ...options, response: options.response ?? R.Solid }),
    );
    if (mass !== null) actor.add(new CollisionBody({ mass }));
    return { actor, t, collider };
  }
  return { engine, scene, world, map, add };
}
const phases = (collider: Collider) => {
  const result: { phase: string; contact: TileContact }[] = [];
  for (const [event, phase] of [
    [TileContactEnter, "enter"],
    [TileContactStay, "stay"],
    [TileContactExit, "exit"],
  ] as const)
    collider.events.on(event, (contact) =>
      result.push({ phase, contact: { ...contact } }),
    );
  return result;
};
describe("dedicated tile contacts through CollisionWorld", () => {
  it("corrects and delivers a typed cell observation after all response without Actor events", () => {
    const { engine, world, map, add } = setup();
    const a = add();
    let actorEvents = 0;
    a.collider.events.on(ContactEnter, () => actorEvents++);
    const calls = phases(a.collider);
    engine.step(0);
    expect(a.t.x).toBe(-10);
    expect(actorEvents).toBe(0);
    expect(calls[0]).toMatchObject({
      phase: "enter",
      contact: {
        self: a.collider,
        selfActor: a.actor,
        map,
        tileX: 0,
        tileY: 0,
        tileId: "wall",
        response: R.Solid,
        resolved: true,
        depth: 5,
        normalX: 1,
      },
    });
    expect(world.contactsFor(a.collider)).toEqual([]);
    expect(world.tileContactsFor(a.collider)).toHaveLength(1);
    engine.step(0);
    a.t.x = -100;
    engine.step(0);
    expect(calls.map((c) => c.phase)).toEqual(["enter", "stay", "exit"]);
    expect(calls[2]?.contact.depth).toBe(0);
    expect(calls[0]?.contact.depth).toBe(5);
    expect(world.tileDiagnostics.retainedCells).toBe(0);
    engine.dispose();
    expect(world.tileDiagnostics).toMatchObject({
      maps: 0,
      contacts: 0,
      retainedCells: 0,
    });
  });
  it.each([R.Solid, R.Trigger])(
    "Trigger combinations do not translate a body (self=%s)",
    (response) => {
      const { engine, world, add } = setup();
      const a = add(80, 16, {
        shape: CollisionShape.Circle,
        radius: 5,
        response,
      });
      engine.step(0);
      expect(a.t.x).toBe(80);
      expect(world.tileContactsFor(a.collider)[0]).toMatchObject({
        response: R.Trigger,
        resolved: false,
      });
      engine.dispose();
    },
  );
  it.each(["absent", "static", "disabled"])(
    "keeps %s correction weight fixed but still detects",
    (weight) => {
      const { engine, world, add } = setup();
      const a = add(-5, 16, {}, null);
      if (weight !== "absent") {
        const b = a.actor.add(
          new CollisionBody({
            motion: weight === "static" ? BodyType.Static : BodyType.Dynamic,
          }),
        );
        if (weight === "disabled") b.enabled = false;
      }
      engine.step(0);
      expect(a.t.x).toBe(-5);
      expect(world.tileContactsFor(a.collider)).toHaveLength(1);
      engine.dispose();
    },
  );
  it("preserves Actor correction and discovers simultaneous terrain contacts in the same budget", () => {
    const { engine, world, map, add } = setup({ iterations: 32 });
    map.x = 40;
    const a = add(35, 16, { width: 20, height: 20 }, 1),
      b = add(20, 16, { width: 20, height: 20 }, 1);
    let actorEnters = 0,
      tileEnters = 0;
    a.collider.events.on(ContactEnter, (c) => {
      expect(c.otherActor).toBe(b.actor);
      actorEnters++;
    });
    a.collider.events.on(TileContactEnter, () => tileEnters++);
    engine.step(0);
    expect(a.t.x).toBeCloseTo(30, 5);
    expect(b.t.x).toBeCloseTo(10, 5);
    expect(actorEnters).toBe(1);
    expect(tileEnters).toBe(1);
    expect(world.responseDiagnostics.unresolved).toBe(0);
    engine.dispose();
  });
  it("checks both masks including high bits, independently of visibility and image readiness", () => {
    const { engine, world, map, add } = setup();
    map.visible = false;
    map.setCollision(0, 0, { response: R.Solid, layer: 0x80000000, mask: 2 });
    const a = add(-5, 16, {
      width: 20,
      height: 20,
      layer: 2,
      mask: 0x80000000,
    });
    engine.step(0);
    expect(a.t.x).toBe(-10);
    map.setCollision(0, 0, { response: R.Solid, layer: 0x80000000, mask: 0 });
    a.t.x = -5;
    engine.step(0);
    expect(a.t.x).toBe(-5);
    expect(world.tileContactsFor(a.collider)).toEqual([]);
    engine.dispose();
  });
  it("handles negative translation, non-square cells and rotated boxes", () => {
    const { engine, world, map, add } = setup();
    map.dispose();
    const terrain = new Tilemap({
      sheet,
      tiles: [["wall"]],
      tileWidth: 48,
      tileHeight: 80,
      x: -100,
      y: -50,
      collision: { tiles: [{ tile: "wall", response: R.Solid }] },
    }).place(engine.scene);
    const a = add(-105, -10, { width: 20, height: 12 });
    a.t.rotation = 0.37;
    const extent = 10 * Math.cos(0.37) + 6 * Math.sin(0.37);
    engine.step(0);
    expect(a.t.x).toBeCloseTo(-100 - extent);
    expect(a.t.y).toBe(-10);
    expect(world.tileContactsFor(a.collider)[0]?.map).toBe(terrain);
    engine.dispose();
  });
  it("uses one placement Actor and footprint-sized queries at every map size", () => {
    for (const size of [32, 100, 256]) {
      const { engine, world, map, add } = setup();
      map.dispose();
      new Tilemap({
        sheet,
        tiles: new Grid(size, size, "water" as const),
        tileWidth: 32,
        tileHeight: 32,
        collision: { tiles: [{ tile: "water", response: R.Trigger }] },
      }).place(engine.scene);
      add(100 * 32 + 16, 100 * 32 + 16, {
        width: 4,
        height: 4,
        response: R.Trigger,
      });
      // Keep the body inside all three finite maps, far from the default camera origin.
      const actor = engine.scene.actors.at(-1);
      const t = actor?.get(Transform.type);
      if (!t) throw Error();
      t.x = t.y = 20 * 32 + 16;
      engine.step(0);
      expect(world.tileDiagnostics.candidateCells).toBe(1);
      expect(world.tileDiagnostics.narrowTests).toBe(1);
      expect(engine.scene.actors).toHaveLength(2);
      engine.dispose();
    }
  });
  it("handles separate maps, independent Actor pairs and multiple simultaneous cells", () => {
    const { engine, world, map, add } = setup();
    map.setTileCollision("wall", { response: R.Trigger });
    map.setTileCollision("stone", { response: R.Trigger });
    const other = new Tilemap({
      sheet,
      tiles: [["water"]],
      tileWidth: 64,
      tileHeight: 32,
      collision: { tiles: [{ tile: "water", response: R.Trigger }] },
    }).place(engine.scene);
    const a = add(32, 16, { width: 20, height: 20, response: R.Trigger }),
      b = add(32, 16, { width: 4, height: 4, response: R.Trigger });
    engine.step(0);
    expect(world.tileContactsFor(a.collider)).toHaveLength(3);
    expect(world.tileContactsFor(b.collider)).toHaveLength(3);
    other.dispose();
    engine.step(0);
    expect(world.tileContactsFor(a.collider)).toHaveLength(2);
    engine.dispose();
  });
});
describe("dynamic terrain observation and lifetime", () => {
  it("keeps image-only/same-policy changes as Stay, and effective response changes Exit then Enter", () => {
    const { engine, world, map, add } = setup();
    const a = add(-5, 16, {
      shape: CollisionShape.Circle,
      radius: 10,
      response: R.Trigger,
    });
    const calls = phases(a.collider);
    engine.step(0);
    map.set(0, 0, "stone");
    engine.step(0);
    map.setCollision(0, 0, { response: R.Solid });
    engine.step(0);
    map.setCollision(0, 0, { response: R.Trigger });
    engine.step(0); // pair remains Trigger
    expect(calls.map((c) => c.phase)).toEqual([
      "enter",
      "stay",
      "stay",
      "stay",
    ]);
    expect(world.tileContactsFor(a.collider)[0]?.tileId).toBe("stone");
    engine.dispose();
    const second = setup();
    const b = second.add();
    const transitions = phases(b.collider);
    second.engine.step(0);
    second.map.setCollision(0, 0, { response: R.Trigger });
    second.engine.step(0);
    expect(transitions.map((c) => c.phase)).toEqual(["enter", "exit", "enter"]);
    expect(transitions[1]?.contact.response).toBe(R.Solid);
    expect(transitions[2]?.contact.policy.response).toBe(R.Trigger);
    second.engine.dispose();
  });
  it("adds/removes invisible cells and honors none/reset independently from images", () => {
    const { engine, world, map, add } = setup();
    const a = add(112, 16, { width: 4, height: 4, response: R.Trigger });
    const calls = phases(a.collider);
    engine.step(0);
    expect(calls).toHaveLength(0);
    map.setCollision(3, 0, { response: R.Trigger });
    engine.step(0);
    expect(calls[0]?.contact.tileId).toBeNull();
    map.setCollision(3, 0, null);
    engine.step(0);
    map.resetCollision(3, 0);
    engine.step(0);
    expect(calls.map((c) => c.phase)).toEqual(["enter", "exit"]);
    expect(world.tileContactsFor(a.collider)).toEqual([]);
    engine.dispose();
  });
  it("freezes observation policy/image values across callback edits until the next pass", () => {
    const { engine, map, add } = setup();
    const a = add(32, 16, { width: 20, height: 20, response: R.Trigger });
    const calls = phases(a.collider);
    let edited = false;
    a.collider.events.on(TileContactEnter, (c) => {
      if (!edited) {
        edited = true;
        map.set(1, 0, "water");
        map.setCollision(1, 0, null);
      } else expect(c.tileId).toBe("stone");
    });
    engine.step(0);
    expect(calls.map((c) => c.contact.tileX)).toEqual([0, 1]);
    engine.step(0);
    expect(calls.map((c) => c.phase)).toEqual([
      "enter",
      "enter",
      "stay",
      "exit",
    ]);
    engine.dispose();
  });
  it.each(["map", "collider", "actor", "collision"])(
    "suppresses remaining Enter/Stay after %s disable and delivers matched exits",
    (target) => {
      const { engine, world, map, add } = setup();
      const a = add(32, 16, { width: 20, height: 20, response: R.Trigger });
      const calls = phases(a.collider);
      a.collider.events.on(TileContactEnter, () => {
        if (target === "map") map.enabled = false;
        if (target === "collision") map.collisionEnabled = false;
        if (target === "collider") a.collider.enabled = false;
        if (target === "actor") a.actor.enabled = false;
      });
      engine.step(0);
      expect(calls.map((c) => c.phase)).toEqual(["enter"]);
      expect(world.tileContactsFor(a.collider)).toEqual([]);
      engine.step(0);
      expect(calls.map((c) => c.phase)).toEqual(["enter", "exit"]);
      engine.dispose();
    },
  );
  it("preserves last observations on map disposal and never notifies a disposed Collider", () => {
    const { engine, world, map, add } = setup();
    const a = add();
    const calls = phases(a.collider);
    a.collider.events.on(TileContactEnter, () => map.dispose());
    engine.step(0);
    engine.step(0);
    expect(calls.map((c) => c.phase)).toEqual(["enter", "exit"]);
    expect(calls[1]?.contact.map.disposed).toBe(true);
    expect(world.tileDiagnostics.retainedCells).toBe(0);
    engine.dispose();
    const second = setup();
    const b = second.add();
    let n = 0;
    b.collider.events.on(TileContactEnter, () => b.collider.dispose());
    b.collider.events.on(TileContactEnter, () => n++);
    second.engine.step(0);
    second.engine.step(0);
    expect(n).toBe(0);
    second.engine.dispose();
  });
  it("aggregates handler failures, rejects recursive World stepping and clears on Scene disposal", () => {
    const { engine, world, scene, add } = setup();
    const a = add();
    let stayed = 0;
    a.collider.events.on(TileContactEnter, () => world.step());
    a.collider.events.on(TileContactStay, () => stayed++);
    expect(() => engine.step(0)).toThrow(AggregateError);
    expect(() => engine.step(0)).not.toThrow();
    expect(stayed).toBe(1);
    scene.dispose();
    expect(world.disposed).toBe(true);
    expect(world.tileContactsFor(a.collider)).toEqual([]);
    engine.activate(new Scene("next"));
    engine.step(0);
    engine.dispose();
  });
  it("reports unresolved deep interior terrain without claiming complete depenetration", () => {
    const { engine, world, map, add } = setup();
    map.dispose();
    new Tilemap({
      sheet,
      tiles: new Grid(10, 10, "wall" as const),
      tileWidth: 32,
      tileHeight: 32,
      collision: { tiles: [{ tile: "wall", response: R.Solid }] },
    }).place(engine.scene);
    add(150, 150, { shape: CollisionShape.Circle, radius: 10 });
    engine.step(0);
    expect(world.tileDiagnostics.unresolved).toBeGreaterThan(0);
    engine.dispose();
  });
});

describe("terrain pass boundaries and recovery", () => {
  it("defers a map created by a contact handler until the next collision pass", () => {
    const { engine, scene, add } = setup();
    const a = add(-5, 16, { width: 20, height: 20, response: R.Trigger });
    let enters = 0;
    a.collider.events.on(TileContactEnter, () => {
      if (++enters === 1)
        new Tilemap({
          sheet,
          tiles: [["water"]],
          tileWidth: 32,
          tileHeight: 32,
          collision: { tiles: [{ tile: "water", response: R.Trigger }] },
        }).place(scene);
    });
    engine.step(0);
    expect(enters).toBe(1);
    engine.step(0);
    expect(enters).toBe(2);
    engine.dispose();
  });
  it("clears silently on Scene replacement and permits independent fresh terrain", () => {
    const { engine, world, map, add } = setup();
    const a = add();
    let exits = 0;
    a.collider.events.on(TileContactExit, () => exits++);
    engine.step(0);
    const next = new Scene("next"),
      nextWorld = new CollisionWorld(next);
    new Tilemap({
      sheet,
      tiles: [["wall"]],
      tileWidth: 32,
      tileHeight: 32,
      collision: { tiles: [{ tile: "wall", response: R.Solid }] },
    }).place(next);
    engine.activate(next);
    engine.step(0);
    expect(world.disposed).toBe(true);
    expect(map.disposed).toBe(true);
    expect(exits).toBe(0);
    expect(world.tileDiagnostics.retainedCells).toBe(0);
    expect(nextWorld.tileDiagnostics.maps).toBe(1);
    engine.dispose();
  });
  it("validates every Actor geometry before terrain correction and recovers after repair", () => {
    const { engine, add } = setup();
    const a = add(),
      bad = add(1000, 1000, { shape: CollisionShape.Circle, radius: 10 });
    bad.t.scaleX = 2;
    expect(() => engine.step(0)).toThrow(
      expect.objectContaining({ code: "COLLIDER_SCALE_UNSUPPORTED" }),
    );
    expect(a.t.x).toBe(-5);
    bad.t.scaleY = 2;
    engine.step(0);
    expect(a.t.x).toBe(-10);
    engine.dispose();
  });
  it("can disable terrain in an old-policy Exit without receiving the replacement Enter", () => {
    const { engine, map, add } = setup();
    const a = add(),
      calls = phases(a.collider);
    engine.step(0);
    map.setCollision(0, 0, { response: R.Trigger });
    a.collider.events.on(TileContactExit, () => {
      map.collisionEnabled = false;
    });
    engine.step(0);
    expect(calls.map((c) => c.phase)).toEqual(["enter", "exit"]);
    map.collisionEnabled = true;
    engine.step(0);
    expect(calls.map((c) => c.phase)).toEqual(["enter", "exit", "enter"]);
    engine.dispose();
  });
  it("terminates remaining delivery when a tile handler destroys its Scene", () => {
    const { engine, world, scene, add } = setup();
    const a = add(32, 16, { width: 20, height: 20, response: R.Trigger });
    let enters = 0;
    a.collider.events.on(TileContactEnter, () => {
      enters++;
      scene.dispose();
    });
    engine.step(0);
    expect(enters).toBe(1);
    expect(world.disposed).toBe(true);
    expect(world.tileDiagnostics.contacts).toBe(0);
    engine.dispose();
  });
  it("samples explicit static-terrain translation on the next pass", () => {
    const { engine, map, add } = setup();
    const a = add(-5, 16, { width: 20, height: 20, response: R.Trigger }),
      calls = phases(a.collider);
    engine.step(0);
    map.x = 100;
    engine.step(0);
    map.x = 0;
    engine.step(0);
    expect(calls.map((c) => c.phase)).toEqual(["enter", "exit", "enter"]);
    engine.dispose();
  });
});
