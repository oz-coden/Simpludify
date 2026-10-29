# Tilemap collision

Tilemap collision is optional, synchronous Core simulation. One Scene-owned CollisionWorld handles Actor/Actor and Actor/terrain detection, position correction and contact delivery. Images, Camera and drawing do not participate in collision.

## Minimal use

```ts verify
import {
  Actor,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  Scene,
  SpriteSheet,
  TileContactEnter,
  Tilemap,
  Transform,
} from "@simpludify/core";
const scene = new Scene("field");
const world = new CollisionWorld(scene);
const sheet = SpriteSheet.grid("terrain.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { grass: 0, wall: 1, water: 2 },
});
const terrain = new Tilemap({
  sheet,
  tiles: [["grass", "wall", "water"]],
  tileWidth: 32,
  tileHeight: 32,
  collision: {
    tiles: [
      { tile: "wall", response: CollisionResponse.Solid },
      { tile: "water", response: CollisionResponse.Trigger },
    ],
  },
}).place(scene);
const player = scene.add(new Actor());
player.add(new Transform({ x: 20, y: 16 }));
player.add(new CollisionBody());
const collider = player.add(
  new Collider({
    shape: CollisionShape.Circle,
    radius: 10,
    response: CollisionResponse.Solid,
  }),
);
collider.events.on(TileContactEnter, (contact) => {
  console.log(
    contact.map === terrain,
    contact.tileX,
    contact.tileY,
    contact.response,
  );
});
console.log(world.tileContactsFor(collider));
```

Activate/step the Scene through Engine, or place these objects in a Game Scene factory. Game does not install a CollisionWorld implicitly. Ordinary Motion integrates movement before collision; no manual terrain query or correction is needed per frame. A wall stops a player only when **both** responses are Solid and the player has an enabled dynamic CollisionBody. Existing Collider response still defaults to Trigger. Body absent/disabled/static has zero correction weight.

## Rules, overrides and types

`collision.tiles` is a copied array of `{tile, response, layer?, mask?}`. response is required; layer defaults to 1, mask to 0xffffffff. Both masks must include a bit of the other's layer. Layer is a nonzero uint32; mask is uint32 including zero. Invalid policy/filter values and duplicate tile IDs throw INVALID_VALUE. Sheet names are inferred; rule typos do not widen the inferred union. No explicit generic annotation is normally necessary.

IDs are exact numeric/name values. A name and a number pointing at the same frame do not implicitly share collision rules; numeric 0 and string "0" remain different IDs. Rules validate through existing SpriteSheet metadata without decoding an image. Rendering continues to validate decoded image bounds independently.

| API                           | Meaning                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `getCollision(x,y)`           | Frozen normalized effective cell policy, or null. Ignores enable/visibility gates so configuration can be inspected. |
| `setCollision(x,y,policy)`    | Copy/freeze an explicit cell override. A null image can have a Solid/Trigger override.                               |
| `setCollision(x,y,null)`      | Explicit none, suppressing ID defaults.                                                                              |
| `resetCollision(x,y)`         | Remove override and inherit the current image ID's default again.                                                    |
| `setTileCollision(id,policy)` | Set/copy an ID default; null removes that default. No full-map geometry rebuild.                                     |
| `collisionEnabled`            | Collision gate only, default true; no rules still means visual only.                                                 |
| `collisionRevision`           | Collision configuration/effective content generation, never contact identity.                                        |

undefined is not a policy/override; use reset for inheritance. Cells use existing Grid integer/bounds errors. Disposed placements reject writes; ordinary data/configuration reads remain inspectable, like get/copyTiles. Configuration objects cannot be mutated through returned policies. Scene ownership/placement remains the existing single internal Actor/TilemapLayer; there are no per-cell Actors or Collider Components.

Setting an equal explicit policy/default is a no-op. Establishing an override equal to an inherited value is still a configuration change, since later ID-default edits will no longer affect that cell. Image-only edits with equal effective policy do not advance collisionRevision. Collision-only edits do not advance image revision or rebuild Sprites. fill scans/writes existing image data as before and sends one collision invalidation only when effective content differs. Runtime observers are owner-scoped. World uses direct policy lookup and does not retain a whole-map geometry cache.

| Gate                     | Drawing   | Collision |
| ------------------------ | --------- | --------- |
| `visible=false`          | Hidden    | Unchanged |
| `collisionEnabled=false` | Unchanged | Excluded  |
| `enabled=false`          | Excluded  | Excluded  |

## Separate public events, shared internals

Actor events remain **ContactEnter/ContactStay/ContactExit** and Contact.self/other/selfActor/otherActor. Existing handlers need no union guard or migration.

Terrain events are **TileContactEnter/TileContactStay/TileContactExit**, delivered to the Actor Collider. TileContact has:

- self Collider and selfActor;
- map placement, tileX/tileY, observed tileId (number/string/null);
- observed frozen `policy` (cell response/layer/mask);
- normalX/Y, depth, effective pair response, resolved.

The cell policy response and effective pair response can differ: a Trigger Collider touching a Solid tile still has Trigger pair response. No map-side event bus, fake otherActor, nullable Actor payload, duplicate physics World or public target union is introduced. `contactsFor` remains Actor-only; `tileContactsFor` returns independent scalar/value snapshots with live map/Actor/Collider references and shared immutable policy values. After disposal the query returns an empty list.

normal is the cell's geometric detection normal from self toward terrain, depth the largest recorded pre-correction penetration that pass, and resolved whether this pair actually translated a body. It is not a proof of complete separation. Local cell observations remain independent even when internal response features are suppressed; a recorded normal is not a cumulative solver displacement vector. Callbacks run after all response. Read Transform for live corrected position, remembering an earlier callback can already change it. No additional position/contact-point fields are introduced.

Payload objects are reused between passes: copy numbers/IDs if retaining history. Exit retains the last observation, including its tile ID/policy even if the current map has changed or is disposed. Referenced objects remain live; check disposed before acquiring resources. Changing images during a handler cannot alter later already-captured observations in that pass.

## Events and edits

Contact identity is Collider instance + map placement instance + cell index + **effective pair response**. Image ID, Sprite, geometry object, chunk/rebuild generation and collisionRevision are not identities.

| Observation/change                                                                      | Event                                                                                        |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| New overlap                                                                             | Enter                                                                                        |
| Same cell and effective response remains observed                                       | Stay                                                                                         |
| Image only, equal effective collision; or filters change but still permit same response | Stay                                                                                         |
| Effective pair Solid↔Trigger                                                            | Old observation Exit, then new observation Enter                                             |
| Tile Solid↔Trigger while self is Trigger                                                | Stay: effective pair remains Trigger                                                         |
| Cell becomes none/removed, or mask rejects                                              | Exit to a previously entered surviving Collider                                              |
| Collider/map/placement collision disabled                                               | Suppress later Enter/Stay immediately; matched Exit when that invalid pair is next processed |
| Collider destroyed                                                                      | No delivery to destroyed receiver                                                            |
| Map destroyed                                                                           | Survivor Exit with last map reference; map.disposed is true                                  |
| World/Scene destroyed/replaced                                                          | Stop delivery and silently clear, no synthetic Exit                                          |

Pairs not entered before a callback invalidates them do not get unmatched Exit. Invalid tracked pairs later in the same delivery list can Exit in that pass; a pair invalidated by its own callback is removed on the next pass, matching existing Actor behavior. Tile edits/default/override changes in callbacks affect the **next collision pass**; no mid-delivery geometry rescan or correction is performed. Disables/disposal are immediate lifetime gates. Errors aggregate after remaining eligible contacts; recursive step rejects. No transactional rollback of component updates or corrections is promised.

Actor pairs retain their existing relative discovery order and deliver first. Terrain then orders by Collider discovery, map discovery, row-major cell index. Each pair notifies once per pass, not once per response iteration. Different neighboring cells legitimately have different Enter/Exit histories. Solids encountered during correction remain observed for that pass; Triggers are sampled only at final positions. There are no swept Trigger events.

## Query, response and lifecycle

The World keeps the existing Actor X sweep. Each eligible Actor's world AABB queries each eligible map's clamped local cell rectangle. Closed tolerance-expanded collision bounds include both sides of exact cell seams; worldToTile's half-open point conversion is unchanged. Rotation uses an AABB only for candidates, followed by the real Circle/OBB narrow phase. Filters reject before narrow tests. No Camera, screen, Viewport, texture readiness or visible-cell list is used.

A single iteration budget handles Actor and terrain pairs: Actor corrections in their existing order, then terrain by Actor/map/cell. Geometry recaptures after changed iterations, allowing overlaps introduced by earlier response to be found next iteration. Terrain has inverse mass zero; correctPositions is shared. Static/static still detect; Trigger never corrects. Neighbor topology removes internal response faces/vertices only for equal full policies. Existing exact manifolds are retained at exposed faces and convex corners. Otherwise only a real exposed finite boundary feature can supply a replacement direction (circle projection or OBB segment/slab test). There is no arbitrary normal rounding, full-map rectangle merge or chunk rebuild.

Geometry records exist only for observed cells and are shared by contacting Actors; the last pair releases the record. Scene structural reconciliation finds/removes map placements, including visual-only maps that acquire collision later. World owns its registration hook and clears all pairs/targets on disposal. It acquires no texture/resource lease and adds no async work. Image readiness remains a Web Scene/presentation concern: Game startup/staged Scene commit still awaits its normal visual preparation contract. Collision itself does not await images; an already active Scene and headless Core can collide while presentation is pending. Explicitly moved terrain is sampled next pass as static geometry; there is no platform velocity transfer or CCD guarantee.

## Diagnostics and limits

Existing `world.diagnostics` stays Actor-only: colliders, contacts, X candidates, narrowTests. `responseDiagnostics` now describes the whole shared solver: passes, corrections, unresolved movable Solid overlaps. New `tileDiagnostics` reports reconciled maps (including visual/disabled maps), candidateCells, policyRejected, narrowTests, responseTests, tracked contacts, corrections, unresolved, neighborProbes and retainedCells. Counts include repeated scans/iterations, not unique cells/frame. narrowTests counts query narrow phases, while responseTests counts their response-time recomputations. neighborProbes counts four topology probes per terrain response attempt, including boundary checks. retainedCells is live cached contact geometry, unrelated to rendered Sprites or map data size.

This is discrete finite-budget position correction. Fully embedded interior terrain can have no exposed feature; deep starts, impossible gaps, teleports, dense crowds and low iteration budgets can remain unresolved. There is no general depenetration, rigid-body stability, CCD, friction, bounce, slopes or moving-platform guarantee. Continuous equal-policy walls and exposed/concave corners have explicit Circle/rotated-Box trajectory regressions in both directions and non-square cells. Different policy boundaries deliberately keep separate response features. Normal floating-point precision limits remain at extreme world scales.

Direct search is proportional to local footprint, plus O(Actor×map) map-bound rejection and tracked contact work. Huge shapes/Triggers and many overlapping maps can be expensive. The Actor sweep still has quadratic unfavorable distributions. [Measured full Solver results](collision-performance.md) distinguish query/response/delivery costs from the older isolated search benchmark. [Implementation and validation record](collision-implementation.md) records scope and acceptance evidence.
