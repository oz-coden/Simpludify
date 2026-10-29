# Tile trail

```sh
npm run dev -- --example tilemap
npm run build -- --target web --example tilemap --base /Simpludify/
```

Focus the field and move with WASD. The animated explorer slides along stone/tree Solid terrain; blue water is a pass-through Trigger. A 64×48 ground map, a translated tree map and a flower map share one SpriteSheet and keep independent depth/data. CameraFollow observes the corrected player position.

- Move right from spawn to the vertical stone wall. Keep a diagonal direction held to slide along it.
- Toggle wall ahead destroys/generates the cell one step in the last movement direction.
- Paint under player replaces exactly one ground cell; creating Solid terrain under an Actor may push it out. Deep embedding is not guaranteed to resolve.
- Toggle collision changes ground/tree collisionEnabled without hiding either map.
- Leave/return creates fresh maps/World/Actors and disposes the previous contacts and image leases.

The position label demonstrates worldToTile/tileToWorld. Last tile contact uses the dedicated TileContactEnter event directly, without a target union. Navigation/editing controls support touch; movement requires a keyboard.

The game explicitly adds one CollisionWorld per Scene, and a Solid Collider + CollisionBody to the explorer. Map rules are separate from image IDs: stone/tree are Solid, water is Trigger, absent rules are visual only. No tile Actor/Collider Component is created. The original terrain SVG and reused Sprite garden hero are MIT assets with root/subpath-safe import.meta.url URLs.
