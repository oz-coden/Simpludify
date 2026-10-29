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

## Optional collision integration

[Tilemap collision](tilemap-collision.md) now implements optional ID defaults/cell overrides in the same CollisionWorld. Actor Contact remains unchanged; dedicated TileContact events avoid imposing target-union branches on Actor-only games. The earlier public-union proposal is historical and superseded. Internal pairs share observation, response, filtering and delivery without a second physics world.

Direct local cell queries and equal-policy exposed boundary features avoid full-map geometry rebuilds and internal seam response. Stable contact identity is placement/cell based. No per-cell Actor/Collider Component is introduced. [Implementation decisions and validation](collision-implementation.md) and [Solver measurements](collision-performance.md) distinguish current guarantees from remaining discrete/finite-budget limits.
