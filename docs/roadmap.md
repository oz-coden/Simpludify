# Implementation status

Simpludify has an experimental Web runtime and a generic composition-based Core. The long-term specification contains additional targets; they are not all implemented.

## Included

- DOM-free Engine stepping, frozen frame input, managed seeded randomness and generic snapshots.
- Synchronous Scene states, exclusive ownership, lifecycle hooks and aggregate cleanup.
- Dynamic Actors/Components with deterministic membership and update rules, dependency diagnostics and enable flags.
- Transform, Renderable, Motion, KeyboardController and the Character composition preset.
- Optional typed local/external events with owner-scoped subscriptions and simulation timers.
- Single Camera/Viewport, logical resolution, pure World/Screen transforms, pointer/DPR handling and optional bounded CameraFollow.
- Pixi shape/image rendering, dynamic component reconciliation, pending-image cancellation and resource diagnostics.
- Queued/coalesced asynchronous Web scene readiness with before-commit recovery and prompt disposal cancellation.
- DOM labels/buttons/panels, two themes, responsive Flexbox/Grid and independent world aspect policies.
- Scene-owned circle/oriented-box Trigger/Solid contacts, filtering, deterministic events/queries, and bounded inverse-mass position correction through CollisionBody.
- Owned independent input sources, pause/resume, live depth/opacity/visibility, aspect-preserving images and keyboard/touch hold controls.
- Character, UI/scenes, headless, Beacon field and the complete Signal Run collection/survival game.
- Noninteractive source scaffold/dev/check/test/build/doctor, JSON diagnostics, unit/browser/production-subpath tests, baseline scripts and automatic licensing notices.

- Japanese-first static documentation, English technical reference, isolated playable four-sample gallery, integrated root/project-base builds and Pages workflow. See site-validation for deployment evidence.

## Pending and limits

Windows/Electron packaging and Windows executable smoke tests are pending. There is no portable executable guarantee or cross-language SDK. Public npm publication, compiled SDK packages and automated vendored-engine upgrades are deferred.

No impulse/angular rigid-body simulation or continuous collision detection, sprite animation, multiple cameras/viewports, tilemaps, audio, save-game format, networking, generic ECS, asset manifest/font manager or visual editor is implemented. Actors/components are destroyed on removal; reusable pooling and scene reactivation are not implicit features. Dynamic images load asynchronously and can fail independently of logical Actors.

Viewport tests cover the supplied examples on Chromium, not arbitrary user layouts or every browser. WebGL context recovery, controlled hardware testing, native/GPU retained-memory instrumentation and multi-hour real-time soak coverage remain open. The Solid response measurements add a bounded five-minute real-time production run and separate simulation/draw CPU proxies. Production Signal Run measurements, forced-GC heap/DOM samples and accelerated simulation/disposal workloads are reproducible with bench:practical. Existing measurements are local observations, not superiority claims.

## Next milestones

1. Extend the measured disposal cycles into a real-time soak with dynamic images, native/GPU memory tracking and controlled hardware; profile the known continuous resize/font workload.
2. Add further game capabilities only when a concrete example requires them (such as animation or audio), keeping collision response/fast-object detection explicit and preserving ownership/update order.
3. Build a secure Windows host in a separate platform-electron package. Reuse the Web renderer loop without per-frame IPC, loading bundled local output only. Disable nodeIntegration, enable contextIsolation and sandbox, apply a restrictive CSP and deny unexpected navigation/windows/permissions. Add a narrow preload API only for an actual feature.
4. Review Electron/electron-builder/Chromium/Node licenses and support before enabling build --target windows. In Windows CI launch the built portable artifact, verify a rendered frame, movement/navigation, offline behavior, process cleanup and temporary/extracted files. Report compressed and installed/extracted sizes separately before documenting verified OS/portable support.

Before comparative performance claims, implement equivalent Godot/Phaser workloads on controlled hardware and preserve all versions and raw results.
