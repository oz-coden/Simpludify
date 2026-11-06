# Tile trail

```sh
npm run dev -- --example tilemap
npm run build -- --target web --example tilemap --base /Simpludify/
```

Focus the field and move with WASD. The animated explorer slides along stone/tree Solid terrain; blue water is a pass-through Trigger. A 64×48 ground map, a translated tree map and a flower map share one SpriteSheet and keep independent depth/data. CameraFollow observes the corrected player position.

- Move right from spawn to the vertical stone wall. Keep a diagonal direction held to slide along it.
- Toggle wall ahead destroys/generates the cell one step in the last movement direction.
- Paint under player replaces exactly one ground cell; creating Solid terrain under an Actor may push it out. Deep embedding is not guaranteed to resolve.
- Toggle door opens/closes the fixed stone-wall cell (14,7).
- Toggle collision changes ground/tree collisionEnabled without hiding either map.
- Leave/return creates fresh maps/World/Actors and disposes the previous contacts and image leases.

The position label demonstrates worldToTile/tileToWorld. Last tile contact uses the dedicated TileContactEnter event directly, without a target union. Navigation/editing controls support touch; movement requires a keyboard.

The game explicitly adds one CollisionWorld per Scene, and a Solid Collider + CollisionBody to the explorer. Map rules are separate from image IDs: stone/tree are Solid, water is Trigger, absent rules are visual only. No tile Actor/Collider Component is created. The original terrain SVG and reused Sprite garden hero are MIT assets with root/subpath-safe import.meta.url URLs.

The sample opts into `CollisionWorld({tileSearch:"rectangles"})`. The HUD shows cached collision cells, merged candidate rectangles and chunks. Equal complete policies merge inside lazy 16×16 chunks; editing one cell invalidates just its chunk. Cell contacts and the existing shared solver stay authoritative. Direct `tileSearch:"cells"` remains the engine default because small footprints/dense contacts may not benefit. See [candidate search and dynamic-update contracts](../../docs/en/specs/tilemap-collision.md#optional-rectangle-candidate-search).

The controls scroll within the upper 40% of the host, leaving the explorer visible in the field. Scroll the panel to reach all editing/navigation buttons.
