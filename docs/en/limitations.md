# Platform limits and implemented scope

The public registry SDK is v0.1.7. The source includes the unpublished v0.2.0 candidate. During the 0.x phase, APIs can evolve before reaching 1.0 stability. Use public package roots and exact versions with a committed lockfile.

## Implemented features

- **Finite Tilemap:** Grid/row copy, SpriteSheet frame integration, layer placement, visible-cell culling, cell edits.
- **TileGeometry / GeometryTilemap:** Square, triangle, and hex (two orientations) solid color layers, coordinate projection, polygon picking, edge neighbors, dynamic updates.
- **Terrain collision:** Tile ID defaults, per-cell overrides, dedicated `TileContact` events, local candidate query, position correction via `CollisionWorld`.
- **Core game foundation:** DOM-free Engine, explicit deterministic stepping, seeded PRNG, snapshot inspection.
- **Resources (v0.2.0):** Explicit Web image, JSON, AudioBuffer and FontFace loading, media fallback, and an idle cache bounded by entry count. Audio uses Web Audio and browser autoplay policy.
- **Scene lifecycle:** Synchronous Core states, ownership, Web asynchronous preparation, cancellation, transaction rollback on pre-commit error.
- **Actor and Components:** Structural dependency validation, immediate disable, reverse-order destruction, lazy typed EventBus, owned simulation timers.
- **Movement:** Character preset, Motion integrator, live scale modification, custom movement policies.
- **Live rendering:** Pixi figure and image rendering, zIndex depth ordering, opacity, visibility, single Camera/Viewport, World/Screen projection, CameraFollow, asynchronous image loading and lease sharing.
- **Collision:** Circles and oriented boxes, layer/mask filtering, Trigger/Solid policies, contact lifecycle events (Enter/Stay/Exit), inverse-mass position correction.
- **Sprites:** SpriteSheet grid/rect/named frames, SpriteAnimation playback cursor in LateUpdate, shared image leases.
- **Playable samples:** Character, UI/Scenes, Beacon Field, Signal Run, Blockfall, Prism Raid, Sprite Garden, Tile Trail, Tile Geometry Lab, Canvas UI, Virtual Input, and Input Bindings.
- **SDK & toolchain:** Typechecking, unit tests, Chromium automated browser tests, bundle build, dev/check/doctor CLI, dependency license notice generation, static documentation site generator.
- **Input systems:** Physical binding capture and JSON serialization (v0.1.6), virtual pointer sticks and buttons (v0.1.5), gamepad adapters and unified input (v0.1.4).

## Collision and runtime constraints

Position correction is bounded iterative depenetration, not a full rigid-body physics simulator. There is no restitution, friction, gravity, torque, angular dynamics, continuous collision detection (CCD), or moving-platform velocity transfer. Fast-moving objects can tunnel through thin geometry. Crowds, narrow gaps, or deep interpenetration may leave residual penetration; inspect `world.responseDiagnostics.unresolved`. One Collider per Actor is supported.

Runtime exceptions during updates do not roll back mutated state. Removing an Actor or Component destroys it permanently; entity pooling is outside the runtime. Reactivation requires an opt-in retained Scene. Snapshots are diagnostic inspections, not save-state formats for custom Component state.

## Unimplemented and unverified scope

| Area                                | Current status                                                      |
| ----------------------------------- | ------------------------------------------------------------------- |
| Infinite maps & streaming           | Unimplemented. Tilemaps are bounded rectangular grids               |
| Multiple cameras / viewports        | Unimplemented. A single active camera and viewport is supported     |
| Asset manifests and streaming audio | Outside the v0.2.0 API. Audio is decoded into memory.               |
| Networking & multiplayer            | Unimplemented. No transport, replication, or authority abstractions |
| Polygon collision / SAT             | Unimplemented. Polygon tiles do not generate physics Colliders      |
| Safari, Firefox, iOS/Android        | Unverified in automated CI. Automated tests target Chromium         |
| WebGL context loss recovery         | Unhandled / unverified                                              |
| Native desktop / mobile apps        | Unimplemented. No official Electron, Tauri, or native wrapper       |

## Performance interpretation and benchmarks

In software-rendered environments, Signal Run demonstrates frame intervals of approximately 33 ms (or 16.7 ms with rendering disabled), with simulation CPU p95 between 0.1 and 0.2 ms. These observations describe the specific benchmark environment, not guaranteed mobile hardware performance.

In synthetic microbenchmarks, 1,000 grid Triggers showed p50 query times increase from 0.71 ms to 1.68 ms when scaling entity counts. During a 5-minute real-time soak test, forced-GC heap measured between 3.36 MB and 4.60 MB. Consult [Performance records](../benchmarks/performance.md) for complete hardware specs, harness details, and command logs.
