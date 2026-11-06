# Collision, contacts and position correction

Collision is optional and Scene-owned. Add Collider to participating Actors and one CollisionWorld to the Scene. Shapes/filters and response policy are separate from body motion/mass. Visual Triangle/Hexagon shapes do not imply polygon collision.

```ts verify
import {
  Actor,
  BodyType,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  Engine,
  Transform,
} from "@simpludify/core";
const engine = new Engine();
const world = new CollisionWorld(engine.scene);
const actor = engine.scene.add(new Actor());
actor.add(new Transform({ x: 20, y: 20 }));
actor.add(
  new Collider({
    shape: CollisionShape.Circle,
    radius: 10,
    response: CollisionResponse.Solid,
  }),
);
actor.add(new CollisionBody({ motion: BodyType.Dynamic, mass: 1 }));
engine.step(1 / 60);
console.log(world.diagnostics);
engine.dispose();
```

Collider requires Transform. One Collider per Actor is supported; it has independent enabled/filter/geometry/response state. Shapes are Circle or rotated Box, with finite positive dimensions/radius, local offset and layer/mask bit fields. Trigger is the default response. Both masks must include the other layer. Disabled Actors/Colliders do not participate; passive Transform enable state does not select collision policy.

## Trigger and Solid

A pair is Solid only when both colliders request Solid. Otherwise it is a Trigger: observe overlap without correction. A missing CollisionBody is immovable; an attached Body uses Dynamic/Static independently of Collider.response. Dynamic mass must be finite/positive, static bodies do not move, and enable state controls body participation. The bounded solver distributes correction by inverse mass. Unequal masses move proportionally; static/immovable geometry stays fixed.

This is discrete position correction, not impulses, restitution, friction, gravity, angular dynamics, continuous collision or moving-platform velocity transfer. Motion intent is not automatically a rigid-body velocity. Tangent displacement can remain while inward intent is corrected. Deep overlap, crowds, narrow gaps or an insufficient iteration budget may leave penetration/jitter; inspect responseDiagnostics.unresolved. Limit speed/delta, subdivide steps or choose appropriate game geometry. A teleport can still cross a wall.

## Contact events

ContactEnter/Stay/Exit deliver in stable discovery order. A payload contains self/other Collider and Actor, unit normal, depth, effective response and whether that pair was corrected. Contact handlers cannot retroactively change the completed narrow-phase/response pass. Additions/transforms/filters affect the next pass; removal/disable suppresses later deliveries immediately. Exit reaches surviving previously notified participants; disposed participants receive nothing. Scene/world disposal clears silently, without synthetic Exit.

Events and reused payloads are observations, not retained immutable game snapshots. Copy scalar fields when keeping a history. contactsFor(collider) returns independent scalar snapshots of eligible contacts and filters invalid/disposed participants; no unstepped state is promised. Errors are aggregated where documented and do not roll back previous application updates.

## Tilemaps and geometry

Textured Tilemap can supply per-ID/per-cell collision policy. TileContact events identify tile coordinates separately from Actor Contact. Tile and Actor pairs share filtering/response/lifetime behavior; merged rectangle candidate search is optional, while cell search remains the default. Changes invalidate the affected region. GeometryTilemap's square/triangle/hex color layers currently do not add polygon collision.

CollisionWorld normally runs after LateUpdate. Manual world.step requires an active Scene and performs an additional pass; reentrant step is rejected. dispose unregisters the hook and permits a replacement world. Sweep diagnostics describe the actual workload; dense contact work may remain quadratic. Consult [API defaults and detailed contracts](../../docs/api.md#trigger-and-solid-contacts), [Tilemap collision](../../docs/specs/tilemap-collision.md) and [platform limits](limitations.md).
