import {
  Actor,
  BodyType,
  Collider,
  CollisionBody,
  CollisionShape,
  CollisionWorld,
  Grid,
  CollisionResponse as R,
  Scene,
  SpriteSheet,
  Tilemap,
  Transform,
} from "@simpludify/core";
import { expect, it } from "vitest";

function setup() {
  const scene = new Scene("query"),
    world = new CollisionWorld(scene);
  function add(
    x: number,
    y: number,
    options: ConstructorParameters<typeof Collider>[0] = {},
  ) {
    const actor = scene.add(new Actor());
    const transform = actor.add(new Transform({ x, y }));
    const collider = actor.add(
      new Collider(
        options.shape === CollisionShape.Circle
          ? { response: R.Solid, ...options }
          : { width: 2, height: 2, response: R.Solid, ...options },
      ),
    );
    return { actor, transform, collider };
  }
  return { scene, world, add };
}
const segment = (x: number, y: number, x2: number, y2: number) => ({
  from: { x, y },
  to: { x: x2, y: y2 },
});
const sheet = SpriteSheet.grid("test.png", { frameWidth: 1, frameHeight: 1 });

it("keeps a shallow ray's closed corner hit before the next wall", () => {
  const { scene, world } = setup();
  const tiles = new Grid<number | null>(20, 12, null);
  tiles.set(9, 4, 0);
  tiles.set(11, 4, 0);
  new Tilemap({
    sheet,
    tiles,
    tileWidth: 32,
    tileHeight: 32,
    collision: { tiles: [{ tile: 0, response: R.Solid }] },
  }).place(scene);
  const query = segment(208, 80, 656, 272);
  const nearest = world.raycast(query);
  expect(nearest).toMatchObject({ kind: "tile", tile: { x: 9, y: 4 } });
  expect(nearest?.distance).toBeCloseTo(Math.hypot(112, 48), 10);
  expect(world.raycastAll(query)[0]).toEqual(nearest);
});

it("orders nearest hits and filters bodies, layers, triggers and ownership before testing geometry", () => {
  const { add, world, scene } = setup();
  const a = add(8, 0, { layer: 1 }),
    b = add(4, 0, { layer: 2 }),
    c = add(4, 0, { response: R.Trigger });
  b.actor.add(new CollisionBody({ motion: BodyType.Dynamic }));
  a.actor.add(new CollisionBody({ motion: BodyType.Static }));
  const ray = {
    origin: { x: 0, y: 0 },
    direction: { x: 200, y: 0 },
    maxDistance: 10,
  };
  expect(world.raycast(ray)).toMatchObject({
    kind: "collider",
    collider: b.collider,
    distance: 3,
    point: { space: "world", x: 3, y: 0 },
    normal: { x: -1, y: 0 },
  });
  expect(
    world.raycastAll(ray, { includeTriggers: true }).map((h) => h.distance),
  ).toEqual([3, 3, 7]);
  expect(
    world.raycast(ray, { layers: 1, includeTriggers: true }),
  ).toMatchObject({ actor: c.actor });
  expect(
    world.raycast(ray, {
      includeTriggers: true,
      exclude: [c.actor, b.collider],
    }),
  ).toMatchObject({ actor: a.actor });
  expect(world.raycast(ray, { layers: 0 })).toBeUndefined();
  expect(world.raycast({ ...ray, maxDistance: 2 })).toBeUndefined();
  b.transform.x = 12;
  expect(world.raycast(ray)).toMatchObject({ actor: a.actor });
  a.collider.enabled = false;
  expect(world.raycast(ray)).toBeUndefined();
  a.collider.enabled = true;
  a.actor.dispose();
  expect(world.raycast(ray)).toBeUndefined();
  scene.dispose();
  expect(() => world.raycast(ray)).toThrow(
    expect.objectContaining({ code: "COLLISION_WORLD_DISPOSED" }),
  );
});

it("supports closed endpoints, boundary normals, point queries and rotated or scaled collision geometry", () => {
  const { add, world } = setup();
  const a = add(3, 0, { width: 2, height: 4 });
  a.transform.rotation = Math.PI / 2;
  expect(world.raycast(segment(0, 0, 1, 0))?.distance).toBeCloseTo(1);
  a.transform.rotation = 0;
  expect(world.raycast(segment(3, 0, 3, 0))).toMatchObject({
    distance: 0,
    normal: null,
  });
  expect(world.raycast(segment(2, 0, 0, 0))).toMatchObject({
    distance: 0,
    normal: { x: -1, y: 0 },
  });
  expect(world.raycast(segment(1, -2, 2, -1))).toMatchObject({
    normal: { x: -1, y: 0 },
  });
  a.transform.scaleX = 0;
  expect(world.raycast(segment(0, 0, 5, 0))).toBeUndefined();
  const c = add(5, 2, { shape: CollisionShape.Circle, radius: 2 });
  expect(world.raycast(segment(0, 0, 10, 0))).toMatchObject({
    actor: c.actor,
    distance: 5,
    normal: { x: 0, y: -1 },
  });
  expect(world.raycast(segment(5, 2, 5, 2))).toMatchObject({
    distance: 0,
    normal: null,
  });
  expect(world.raycast(segment(5, 4, 5, 4))).toMatchObject({
    distance: 0,
    normal: { x: 0, y: 1 },
  });
});

it("gives colliders priority and returns tiles in placement and row-major order on corner ties", () => {
  const { scene, world, add } = setup();
  const map = new Tilemap({
    sheet,
    tileWidth: 2,
    tileHeight: 2,
    x: -2,
    y: -2,
    tiles: [
      [null, 0],
      [0, 0],
    ],
    collision: { tiles: [{ tile: 0, response: R.Solid, layer: 4 }] },
  }).place(scene);
  const a = add(1, 1, { layer: 4 });
  const query = segment(-1, -1, 1, 1);
  expect(world.raycast(query)).toMatchObject({
    kind: "collider",
    collider: a.collider,
  });
  const tiles = world.raycastAll(query, { targets: "tiles" });
  expect(tiles.map((h) => h.kind === "tile" && h.tile)).toEqual([
    { space: "tile", x: 1, y: 0 },
    { space: "tile", x: 0, y: 1 },
    { space: "tile", x: 1, y: 1 },
  ]);
  expect(world.raycast(query, { targets: "tiles" })).toEqual(tiles[0]);
  expect(
    world.raycast(segment(0, 0, -1, -1), { targets: "tiles" }),
  ).toMatchObject({ tile: { x: 1, y: 0 } });
  expect(world.raycast(query, { exclude: [map, a.actor] })).toBeUndefined();
  map.setCollision(1, 0, { response: R.Trigger, layer: 4 });
  expect(world.raycast(query, { targets: "tiles" })).toMatchObject({
    tile: { x: 0, y: 1 },
  });
  expect(
    world.raycast(query, { targets: "tiles", includeTriggers: true }),
  ).toMatchObject({ tile: { x: 1, y: 0 } });
  expect(world.raycast(query, { targets: "tiles", layers: 1 })).toBeUndefined();
  map.visible = false;
  expect(world.raycast(query, { targets: "tiles" })).toBeDefined();
  map.collisionEnabled = false;
  expect(world.raycast(query, { targets: "tiles" })).toBeUndefined();
});

it("rejects invalid queries and treats a valid zero-distance ray as a point", () => {
  const { world, add } = setup();
  add(0, 0);
  const origin = { x: 0, y: 0 },
    direction = { x: 1, y: 0 };
  expect(world.raycast({ origin, direction, maxDistance: 0 })?.distance).toBe(
    0,
  );
  for (const ray of [
    { origin, direction, maxDistance: -1 },
    { origin, direction, maxDistance: Infinity },
    { origin, direction: origin, maxDistance: 4 },
    { origin, direction: { x: NaN, y: 1 }, maxDistance: 4 },
    segment(NaN, 0, 0, 0),
  ])
    expect(() => world.raycast(ray)).toThrow(
      expect.objectContaining({ code: "INVALID_VALUE" }),
    );
});

it("visits a diagonal strip of a large tilemap and gives repeatable nearest and all-hit results", () => {
  const { world, scene } = setup();
  const map = new Tilemap({
    sheet,
    tileWidth: 1,
    tileHeight: 1,
    tiles: new Grid<number | null>(256, 256, 0),
    collision: { tiles: [{ tile: 0, response: R.Solid }] },
  }).place(scene);
  const get = map.getCollision.bind(map);
  let probes = 0;
  map.getCollision = (x, y) => {
    probes++;
    return get(x, y);
  };
  const ray = segment(-1, -1, 257, 257);
  const first = world.raycastAll(ray);
  expect(first).toHaveLength(766);
  expect(probes).toBeLessThan(800);
  const count = probes;
  expect(world.raycast(ray)).toEqual(first[0]);
  expect(probes - count).toBeLessThan(5);
  expect(world.raycastAll(ray)).toEqual(first);
});
