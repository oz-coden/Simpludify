# Implementation status

Simpludify has an experimental Web runtime and a generic composition-based Core. The long-term specification contains additional targets; they are not all implemented.

## Included

- DOM-free Engine stepping, frozen frame input, managed seeded randomness and generic snapshots.
- Synchronous Scene states, exclusive ownership, lifecycle hooks and aggregate cleanup.
- Dynamic Actors/Components with deterministic membership and update rules, dependency diagnostics and enable flags.
- Transform, Renderable, Motion, KeyboardController and the Character composition preset.
- Optional typed local/external events with owner-scoped subscriptions and simulation timers.
- Single Camera/Viewport, logical resolution, pure World/Screen transforms and pointer/DPR handling.
- Pixi shape/image rendering, dynamic component reconciliation, pending-image cancellation and resource diagnostics.
- Queued/coalesced asynchronous Web scene readiness with before-commit recovery and prompt disposal cancellation.
- DOM labels/buttons/panels, two themes, responsive Flexbox/Grid and independent world aspect policies.
- Character, UI/scenes, headless and Beacon field composition examples.
- Noninteractive source scaffold/dev/check/test/build/doctor, JSON diagnostics, unit/browser/production-subpath tests, baseline scripts and automatic licensing notices.

## Pending and limits

Windows/Electron packaging and Windows executable smoke tests are pending. There is no portable executable guarantee or cross-language SDK. Public npm publication, compiled SDK packages and automated vendored-engine upgrades are deferred.

No collision/physics, sprite animation, camera follow, multiple cameras/viewports, tilemaps, audio, touch controls, save-game format, networking, generic ECS, asset manifest/font manager or visual editor is implemented. Actors/components are destroyed on removal; reusable pooling and scene reactivation are not implicit features. Dynamic images load asynchronously and can fail independently of logical Actors.

Viewport tests cover the supplied examples on Chromium, not arbitrary user layouts or every browser. WebGL context recovery, a production performance baseline, detailed retained-memory instrumentation, controlled hardware testing and a long-running soak remain open. Existing measurements are local observations, not superiority claims.

## Next milestones

1. Harden long-running dynamic-asset and scene cycles with retained-memory measurements; profile component dispatch and resize costs against the recorded before/after workloads.
2. Add only game capabilities demonstrated by examples (for example a small collision/interaction component) while maintaining explicit ownership and update order.
3. Build a secure Windows host in a separate platform-electron package. Reuse the Web renderer loop without per-frame IPC, loading bundled local output only. Disable nodeIntegration, enable contextIsolation and sandbox, apply a restrictive CSP and deny unexpected navigation/windows/permissions. Add a narrow preload API only for an actual feature.
4. Review Electron/electron-builder/Chromium/Node licenses and support before enabling build --target windows. In Windows CI launch the built portable artifact, verify a rendered frame, movement/navigation, offline behavior, process cleanup and temporary/extracted files. Report compressed and installed/extracted sizes separately before documenting verified OS/portable support.

Before comparative performance claims, implement equivalent Godot/Phaser workloads on controlled hardware and preserve all versions and raw results.
