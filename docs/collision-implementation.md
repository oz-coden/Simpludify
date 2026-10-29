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

## Integrated World checkpoint

The existing World now discovers placed TilemapLayer objects and queries only Actor AABB cell ranges. Actor and tile pairs share one registry, observation reducer, correction loop/iteration budget, ordered delivery/lifetime checks and response/filter helpers. Only the payload/token boundary differs. Tile geometry records are plain data created for observed cells, shared across contacting Actors, and evicted with the last pair; they are not Actors or Components.

Contact and contactsFor remain Actor-only. TileContactEnter/Stay/Exit and tileContactsFor are direct typed terrain APIs. No target union is exposed. Policy-change Exit uses a copied old observation before the new Enter; image IDs and frozen policy values are captured before callbacks. Response, filtered bounds, map/collision gates and Scene lifetime are independent of Camera/images/rendering.

Integrated focused regression passed 107 tests (60 pre-existing Actor geometry/response plus 47 formal terrain/continuous-wall cases). The exact former circle slide counterexample is included in the real World comparison, alongside rotated boxes, both axes/directions and non-square cells. Further browser, full-suite and performance validation remains pending.

## Sample/browser fixture checkpoint (validation pending)

Tile trail now has stone/tree walls, pass-through water, a Solid/body-equipped explorer, a dedicated TileContact label, wall creation/destruction ahead, collision toggling and Scene recreation. Three independent maps still share their image pool. Existing Paint under player and gallery hooks remain available.

New browser fixtures cover actual stopped pixels, hidden/offscreen terrain, policy-only edits without Sprite visits, dynamic gaps/regeneration, pending-image collision and release, plus real sample WASD/sliding/Trigger/edit/Scene controls. These fixtures are saved before the longer browser run; success is not claimed until executed. Continuous-wall tests were extended to exposed convex corners, bringing the formal wall/corner matrix to 50 unit cases (each straight/convex trajectory also tests both cell aspect ratios).

## Browser result and measurement checkpoint

All 12 new terrain browser tests passed, retries disabled: WebGL/forced Canvas2D × desktop/narrow. Actual pixels show the player stopped beside the wall; WASD sliding, water Trigger, wall destruction/regeneration, collision toggling and Scene recreation work. Hidden/offscreen maps still collide; collision before a gated image completes and subsequent pending-map cleanup pass. Collision-only policy edits caused zero renderer cell visits. Browser headless Core reproduces the original wall scenario at (54,136), matching the Node reference without the historical +3.43 tangent drift.

The narrow screenshot exposed an overly tall control panel; controls were grouped into a sample-scoped grid, without changing engine UI APIs. Full browser regression will verify this layout update. A full Solver harness is saved before measurement, separating plain Engine.step from independently instrumented query/response/delivery runs. responseTests was added to tileDiagnostics to count response-time narrow-phase recomputations separately from scan tests. Actor diagnostic schema stays unchanged.

## Formal Solver measurement result

Measured clean source 12255c346f3ce0da5f4313c7ca2206e1041543a2 with no concurrent local tests/builds: 72 plain + 72 instrumented runs, 2880 recorded passes. Six raw files retain timings and actual query/recompute/correction/contact/event/unresolved/resource counts. The 96 straight/convex trajectory comparisons have maximum error 1.5631940186722204e-13 against a single Actor wall; threshold stays 1e-6. Controlled performance workloads have zero unresolved contacts and zero retained owners/cell geometry after disposal. General deep embedding remains explicitly unsupported and has a diagnostic regression.

Additional tests cover callback-created maps, silent Scene replacement, pre-response geometry validation/recovery, disabling terrain during old-policy Exit, Scene destruction during delivery, static terrain translation, and every stored Solver sample. Full regression/site validation follows this saved measurement checkpoint.

## Full regression checkpoint

All 509 unit tests and all 178 browser tests passed, retries disabled (full browser run 4.0 minutes). Strict check passed with the same existing 12 warnings/11 infos and 116 locked dependency licenses. Native completion tests use the real Actor Contact and TileContact APIs, with no Actor target branch. Site build/check at /Simpludify/ passed 51 documents, 2753 references/assets and 50 standalone TypeScript snippets.

Production gallery smoke is strengthened to wait for the actual stone-wall stop at x=434 and verify live terrain contact/candidate/unresolved counters, alongside the existing real pixels, one-cell renderer update, Scene controls and resource checks. Production game smoke and site browser smoke at both /Simpludify/ and / are the remaining checks. No Core runtime code changed after measured source 12255c346f3ce0da5f4313c7ca2206e1041543a2.

The control-grid stylesheet is imported by the sample module so both standalone pages and browser fixtures share it. The post-adjustment WebGL/Canvas2D × desktop/narrow actual-sample tests passed 4/4. Physics/Core code remains identical to the measured runtime.
