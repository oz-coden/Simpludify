import {
  Actor,
  Collider,
  CollisionBody,
  CollisionShape,
  CollisionWorld,
  Engine,
  Grid,
  Motion,
  CollisionResponse as R,
  SpriteSheet,
  Tilemap,
  Transform,
} from "@simpludify/core";
export interface WallScenarioOptions {
  circle: boolean;
  rotation: number;
  horizontal: boolean;
  side: -1 | 1;
  tangent: -1 | 1;
  tileWidth: number;
  tileHeight: number;
}
/** The same movement against placed terrain and a single ordinary static Actor wall. */
export function runWallScenario(options: WallScenarioOptions) {
  const {
    circle,
    rotation,
    horizontal,
    side,
    tangent,
    tileWidth: w,
    tileHeight: h,
  } = options;
  const tiled = new Engine(),
    reference = new Engine();
  const world = new CollisionWorld(tiled.scene),
    refWorld = new CollisionWorld(reference.scene);
  new Tilemap({
    sheet: SpriteSheet.grid("unused.png", { frameWidth: 16, frameHeight: 16 }),
    tiles: Grid.generate(horizontal ? 24 : 5, horizontal ? 5 : 24, (x, y) =>
      (horizontal ? y : x) === 2 ? 0 : null,
    ),
    tileWidth: w,
    tileHeight: h,
    collision: { tiles: [{ tile: 0, response: R.Solid }] },
  }).place(tiled.scene);
  const wall = reference.scene.add(new Actor());
  wall.add(
    new Transform({
      x: horizontal ? 12 * w : 2.5 * w,
      y: horizontal ? 2.5 * h : 12 * h,
    }),
  );
  wall.add(
    new Collider({
      width: horizontal ? 24 * w : w,
      height: horizontal ? h : 24 * h,
      response: R.Solid,
    }),
  );
  const extent = circle
    ? 10
    : horizontal
      ? Math.abs(Math.sin(rotation)) * 10 + Math.abs(Math.cos(rotation)) * 6
      : Math.abs(Math.cos(rotation)) * 10 + Math.abs(Math.sin(rotation)) * 6;
  const normal =
    side > 0
      ? (horizontal ? 2 * h : 2 * w) - extent
      : (horizontal ? 3 * h : 3 * w) + extent;
  const along =
    tangent > 0 ? (horizontal ? w : h) / 2 : 23 * (horizontal ? w : h);
  function body(engine: Engine) {
    const actor = engine.scene.add(new Actor());
    const transform = actor.add(
      new Transform({
        x: horizontal ? along : normal,
        y: horizontal ? normal : along,
        rotation,
      }),
    );
    actor.add(
      new Motion({
        speed: 120,
        x: horizontal ? tangent : side,
        y: horizontal ? side : tangent,
      }),
    );
    actor.add(
      new Collider(
        circle
          ? { shape: CollisionShape.Circle, radius: 10, response: R.Solid }
          : { width: 20, height: 12, response: R.Solid },
      ),
    );
    actor.add(new CollisionBody());
    return transform;
  }
  const a = body(tiled),
    b = body(reference);
  let maxError = 0,
    maxUnresolved = 0;
  for (let step = 0; step < 60; step++) {
    tiled.step(1 / 60);
    reference.step(1 / 60);
    maxError = Math.max(maxError, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    maxUnresolved = Math.max(maxUnresolved, world.tileDiagnostics.unresolved);
  }
  const result = {
    ...options,
    maxError,
    maxUnresolved,
    final: { x: a.x, y: a.y },
    reference: { x: b.x, y: b.y },
    tileDiagnostics: world.tileDiagnostics,
    referenceResponse: refWorld.responseDiagnostics,
  };
  tiled.dispose();
  reference.dispose();
  if (
    world.tileDiagnostics.retainedCells !== 0 ||
    world.tileDiagnostics.contacts !== 0
  )
    throw Error("Terrain contacts survived disposal");
  return result;
}
