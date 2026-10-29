# Collision implementation work record

Status: in progress, based on collision review `bd5c4834fa827d8ca62ded82a563772024165d0d`. Work is saved on `codex/working-collision`; main, Sprite, Tilemap and review branches are not write targets.

## Public boundary decision

Keep Actor ContactEnter/Stay/Exit and Contact.self/other/selfActor/otherActor unchanged. Add TileContactEnter/Stay/Exit with a direct map/tileX/tileY payload. The review's public other-target union is superseded: it would require an otherwise Actor-only game to branch solely because terrain is supported by the engine. Separate typed event tokens add a second subscription only to games that actually use both kinds; they do not require a second CollisionWorld, narrow phase, solver or lifecycle.

`tests/types/collision-usage.ts` first records Actor-only, terrain-only and mixed usage before the formal implementation. The two handlers in mixed usage reflect different game rules and need no target branch. No significant boilerplate problem was found in those sketches. They will be switched from declarations to real exported APIs once available.

## First checkpoint

Shared internal policy validation/filter/response functions and contact observation/phase functions are extracted without changing Actor behavior or public types. Actor regression and the full existing unit suite must pass before terrain response is added. Detection, response and delivery remain ordered by the existing Scene-owned CollisionWorld. No additional ownership/scheduler framework is introduced.

Next: copied ID policies and sparse overrides, cell query, dedicated payloads, common pair orchestration, neighbor-feature response, sample/browser validation and full Solver measurements. No formal Tilemap collision completion is claimed at this checkpoint.

## Actor baseline and data checkpoint

The refactor checkpoint passed all 391 existing unit tests and strict TypeScript before terrain response was introduced. Tilemap now has optional copied/frozen ID defaults, sparse overrides, explicit none/reset, collisionEnabled and independent collisionRevision/notifications. Ordinary edits do not build any spatial geometry or change Renderable/Texture state. No collision scheduling is attached yet at this checkpoint.

## Exposed-feature isolation

The boundary probe compares 60-step trajectories against one continuous rectangular wall, for circles and boxes rotated by +0.37/-0.64 radians, horizontal/vertical walls, both sides, both tangent directions, and 32×32/48×20 cells. All 27 test cases pass; trajectory differences stay below 1e-6 world units. This is an isolated geometry checkpoint, not yet the integrated Solver acceptance result.

Four neighbor lookups identify faces internal to **equal full normalized policies**. The exact existing manifold is retained for exposed faces and convex vertices. A manifold using an internal feature is accepted for response only if a real exposed finite face intersects the body (circle projection or OBB segment/slab test); then that geometric face supplies its separation direction. Arbitrary normal rounding is not used. Different response/layer/mask neighbors retain their own boundaries. Fully embedded interior cells can have no exposed response feature, so deep terrain embedding still requires unresolved diagnostics rather than an escape guarantee.
