# Tilemap foundation design

Base: Sprite branch eb61494e5f3275ba1593bb5989cb8f3b9cdce312. Tilemap is an optional placed image grid, not the definition of a game's world.

## Ownership choice

| Candidate                                                    | Consequence                                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Scene directly owns a new Tilemap collection                 | Duplicates membership, IDs, lifecycle, renderer reconciliation and disposal. Rejected for this scope.                          |
| One Actor/Component per cell                                 | Excess simulation/lifecycle objects; prohibited and unnecessary.                                                               |
| One placement Actor with an internal Component               | Selected: reuses ownership and allows the facade get(x,y) without colliding with Actor.get(ComponentType).                     |
| One Tilemap placement extending Actor, holding a copied Grid | Rejected: Actor.get(ComponentType) conflicts with the desired map.get(x,y); overloading it would complicate a simple tile API. |

Tilemap.place(scene) inserts one internal Actor with one passive TilemapLayer Component and no simulation update. The Web renderer recognizes Tilemap placements and owns their visible Sprite collection and one sheet-image lease. The internal Actor is not exposed as a customization surface. Position is translation-only; keep game Actors separate from map placements. Ground/walls/decorations are independent placements, ordered with ordinary Renderables by zIndex then Actor insertion order. A map's cells form one draw group; an Actor can be between maps, not between individual cells of one map.

Input rows and Grid values are copied/validated; mutation goes through set/fill. copyTiles returns independent reusable data, including after Scene disposal. No external Grid can invalidate presentation caches. Sheet metadata is immutable and reusable. Map placement cannot be transferred/reactivated after removal, following Actor rules.

## Rendering choice

Evaluate a bounded visible-cell Sprite renderer first: use the pinned Pixi 8 Sprite batch path and the existing SharedImages crop Texture cache, which already have WebGL and Canvas2D fixtures. Sprites are backend display objects only; no per-cell Actor or Component exists. The visible tile rectangle is obtained by inverting the existing view.clip, not by changing Camera/Viewport/DPR. A stable visible rectangle and unchanged cells perform zero cell visits. Individual edits notify presentations and only visible edited indices are refreshed; offscreen edits are applied on entry. Range changes revisit the visible rectangle and discard outgoing Sprites. Bulk fill invalidates the visible range. No full-map scan or chunk buffer upload occurs on ordinary rendering.

An alternative reviewed was @pixi/tilemap 5.0.2: its package declares pixi.js >=8.5.0 (compatible semver with pinned 8.22.0), MIT, packed 105.9kB/unpacked 521.9kB. The inspected entrypoint registers Gl/Gpu adaptors and a tilemap pipe, with no Canvas adaptor in that artifact. Its README's historical canvas statement is not proof of current Canvas2D operation with Pixi 8.22. This candidate was not adopted or benchmarked; the retained Sprite path avoids another rendering pipeline/dependency and reuses tested crop/lease behavior. No superiority claim is made. Sources: https://github.com/pixijs-userland/tilemap/blob/main/package.json and https://github.com/pixijs-userland/tilemap; reviewed npm artifact 5.0.2 (shasum a2542d133cb00c52dc42b3cf7720732b07fef525). A GPU mesh/chunk path is a future option if all-visible measurements justify it.

## Collision extension proposal (not implemented)

Current Collider requires Transform and models one box/circle per Actor. CollisionBody controls inverse-mass correction independently from Trigger/Solid policy. Contact currently hard-codes other Collider/Actor; adding Tilemap collisions without a public contact-target change would require fake per-cell Actors. Do not do that.

Future tile collision data should be separate from image IDs: optional ID-to-policy definitions (response, layer/mask), plus sparse cell overrides including explicit none. Absence of all collision data means rendering only. Visibility and collisionEnabled are independent. A separate collision-data revision can invalidate spatial data without redrawing. Data should be copied/validated through APIs rather than exposing a mutable collision Grid. No speculative collision API is public in this foundation.

Compare these implementations before selecting an optimizer:

- Direct lookup of cells intersecting an Actor's world AABB: simple local work, no merge rebuild; many narrow-phase tests for large bodies or large tilesets.
- Adjacent Solid rectangle merging: fewer geometric tests in uniform terrain, but rebuild/fragmentation costs for frequent edits; it must not define public contact identity.
- Chunk-local geometry rebuild: bounds dirty work for large maps, but adds a tunable chunk size and cross-chunk edges; compare measured workloads rather than fixing it prematurely.

A shared narrow-phase target abstraction should represent either an Actor Collider or `{map, tileX, tileY}`. Keep Trigger/Solid, normal/depth/resolved, layer/mask and inverse-mass semantics; tile terrain is initially fixed. Preserve existing Actor/Actor payloads through a discriminated target addition or explicit tile-contact event family, with migration/type tests; do not silently pretend a tile is an Actor. Contact identity should be collider + placement + cell (or a documented semantic region) independent of merged-rectangle IDs, so merge/split alone creates no Enter/Exit. For the first integration prefer stable per-cell identity even if geometric tests use merged rectangles: report affected cells in deterministic row-major order. Decide and measure the cost of per-cell contact bookkeeping for wide bodies.

If effective response changes between Trigger and Solid, define an old-policy Exit followed by a new-policy Enter; changing only an image with unchanged effective collision policy should remain Stay.

Apply tile edits at the next collision pass: unchanged overlapping cells Stay, removed/disabled cells produce survivor Exit, new cells Enter. Deliver only after position correction, suppress callbacks to disposed recipients immediately, and clear silently on Scene disposal as current contacts do. Actor/Tilemap removal, failed staged preparation, pending visual loads and collision teardown stay owner-scoped. Visual readiness must never control collision time. Fast crossing/CCD remains a separate solver problem. This requires targeted CollisionWorld target/narrow-phase/contact storage changes, not a collision-system rewrite in this task.
