# Collision, contacts and position correction

Collision detection and position correction in Simpludify approximate entities with circles and oriented bounding boxes. The engine prioritizes predictable game feel and clear lifecycle contracts over heavy rigid-body physics. Collider dimensions and offsets are declared explicitly to fit game controls.

## Trigger and Solid policies

| Combination       | Contact detection & queries | Position correction                     |
| ----------------- | --------------------------- | --------------------------------------- |
| Trigger / Trigger | Yes                         | None                                    |
| Trigger / Solid   | Yes                         | None                                    |
| Solid / Solid     | Yes                         | Performed based on active CollisionBody |

The default response for a Collider is **Trigger**. To stop movement against a wall, mark both participants Solid and attach an active CollisionBody to the moving Actor. Collider defines shape, filters, and response policy; CollisionBody defines correction weight; Motion integrates movement intent.

## Minimal wall collision and contacts

```ts
import {
  Actor,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  ContactEnter,
  Motion,
  Transform,
} from "@simpludify/core";

const world = new CollisionWorld(scene);
const player = scene.add(new Actor());
player.add(new Transform({ x: 100, y: 200 }));
player.add(new Motion({ speed: 120, x: 1 }));
player.add(new CollisionBody());
const collider = player.add(
  new Collider({
    shape: CollisionShape.Circle,
    radius: 13,
    response: CollisionResponse.Solid,
  }),
);

const wall = scene.add(new Actor());
wall.add(new Transform({ x: 150, y: 200 }));
wall.add(
  new Collider({
    width: 18,
    height: 150,
    response: CollisionResponse.Solid,
  }),
);

collider.events.on(
  ContactEnter,
  ({ otherActor, normalX, normalY }) => {
    console.log("Contact with", otherActor.id, normalX, normalY);
  },
  player,
);

// Pull-based inspection after simulation step; event subscription is optional.
const contacts = world.contactsFor(collider);
```

Renderable is not required for collision. A body-less Actor, `BodyType.Static`, or a disabled CollisionBody has zero correction weight (stays fixed). Dynamic bodies (default mass 1) share displacement inversely proportional to their mass. Static is a response weight, not an immutable position lock.

## Shapes and filtering

One Collider per Actor is supported, requiring Transform. Box defaults to width/height 32; Circle to radius 16. Local offsets and rotation follow Transform. Circles require equal absolute scale axes (`COLLIDER_SCALE_UNSUPPORTED` otherwise). Negative scales reflect offsets; zero scale excludes the collider.

`layer` defaults to 1 and `mask` to `0xffffffff`. A pair interacts only when **both** masks include a bit of the other's layer. Actor and Collider `enabled` flags control participation; visual visibility does not affect collision. Shape, response, and filters are immutable; remove and re-add to change them.

## Contact event lifecycle and order

Following Component updates, CollisionWorld runs position correction, delivers `ContactEnter` / `Stay` / `Exit` events, and then advances simulation timers and `Scene.onUpdate`. Events are delivered once per participant per world pass, not once per solver iteration:

- **Enter:** A newly observed overlapping pair in this pass.
- **Stay:** A pair observed again in consecutive passes.
- **Exit:** A previously entered pair that is no longer overlapping or has become invalid/disabled.
- Trigger contacts are sampled after all position corrections. Solid pairs encountered during iterative correction are recorded even if later corrections separate them.
- Delivery follows deterministic discovery-ID order. Removing or disabling an entity immediately suppresses subsequent Enter/Stay in that pass; surviving notified Colliders receive Exit on the next pass.
- Scene or world disposal stops delivery and clears state silently without synthetic Exit events.

Contact payloads carry `normalX/Y` (unit normal from self toward other), `depth` (maximum observed pre-correction penetration), and `resolved` (whether this pair moved a body). Payload objects are reused between passes; copy scalar values when keeping history. `world.contactsFor(collider)` returns an independent scalar snapshot.

## Solver limits and discrete tunneling

`new CollisionWorld(scene, { iterations: 6, tolerance: 1e-7 })` uses bounded iterative depenetration. Tangent velocity is preserved, allowing sliding along walls. It does not calculate forces, restitution, friction, gravity, torque, or angular dynamics.

This is **discrete** collision detection. Fast-moving objects can tunnel through thin geometry between steps. Subdividing `Engine.step` calls or bounding speeds mitigates tunneling, but continuous collision detection (CCD) is not implemented. Deep overlaps, narrow gaps, or dense crowds may leave residual penetration; check `world.responseDiagnostics.unresolved`.

## Games without Colliders

Grid occupancy, line clears, and turn-based checks can be handled with standard integer and array logic in pure game code. Physical Colliders are never mandatory for gameplay logic.

## Tilemap terrain collision

Actor-to-Actor contacts and Actor-to-terrain contacts share the same CollisionWorld, narrow phase, and solver. Terrain contacts use dedicated `TileContact` events:

```ts verify
import {
  CollisionResponse,
  CollisionWorld,
  Scene,
  SpriteSheet,
  Tilemap,
} from "@simpludify/core";

const scene = new Scene("field");
new CollisionWorld(scene);
const sheet = SpriteSheet.grid("terrain.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { wall: 0, water: 1 },
});
const map = new Tilemap({
  sheet,
  tiles: [["wall", "water", null]],
  tileWidth: 32,
  tileHeight: 32,
  collision: {
    tiles: [
      { tile: "wall", response: CollisionResponse.Solid },
      { tile: "water", response: CollisionResponse.Trigger },
    ],
  },
}).place(scene);

map.setCollision(0, 0, null); // Disable collision for this cell
map.resetCollision(0, 0); // Reset to default "wall" collision
```

Moving Actors use a Solid Collider plus dynamic CollisionBody. `TileContact` payloads provide `self`, `selfActor`, `map`, `tileX/Y`, `tileId`, `policy`, `normal`, `depth`, `response`, and `resolved`. Query contacts via `world.tileContactsFor(collider)`.

Continuous walls of equal policy suppress internal edge and corner collisions, eliminating seams where moving circles or rotated boxes could snag. Moving between cells legitimately emits Exit for the old cell and Enter for the new cell. See [Tilemap collision specification](./specs/tilemap-collision.md) and [benchmarks](../benchmarks/collision-performance.md).
