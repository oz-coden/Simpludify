# Implementation status

The first milestone is the experimental Web vertical slice, not the entire long-term engine specification.

## Included

- DOM-free simulation, explicit stepping, seeded PRNG and snapshots.
- Typed character/movement API, normalized delta-time movement and key mappings.
- PixiJS default shapes and image sprites with owned resource cleanup.
- Scene factories, queued asynchronous readiness, failed-setup recovery and cleanup.
- DOM labels/buttons/panels, Flexbox/Grid layouts, two themes and token overrides.
- Fit, Fill and Adaptive world policies; independent responsive overlay.
- Noninteractive scaffold/dev/check/test/build/doctor commands, JSON failure diagnostics.
- Unit tests, browser tests at 1440×900 and 390×844, baseline measurement scripts, MIT and automatic dependency notices.

## Pending and limits

Windows/Electron packaging and a Windows executable smoke test are pending. There is no desktop output, portable executable guarantee or cross-language SDK. The current source scaffold vendors the engine; public npm publication, compiled SDK distribution and automated upgrade management are deferred.

Other unimplemented features include collision/physics, sprite animation, spawning/removal after readiness, camera follow, tilemaps, audio, touch movement, save games, networking, generic ECS, font/asset manifests, a visual editor and C#. Current viewport tests prove bounds and behavior for the examples, not all user layouts or devices. WebGL context recovery and other browser engines need dedicated future verification.

## Next concrete milestone: secure Windows host

1. Add `packages/platform-electron`, keeping its dependency out of core and the Web SDK. Reuse the Web renderer loop and RendererPort/FrameDriver boundary.
2. Load only bundled game output. Configure `nodeIntegration: false`, `contextIsolation: true`, sandbox enabled, a restrictive production CSP, denied unexpected navigation/windows/permissions, and no preload API until a real game feature needs one.
3. Add a noninteractive `build --target windows` path using reviewed Electron/electron-builder versions. Require explicit packaging configuration, bundle dependency notices, and separately report compressed download and extracted runtime size.
4. On Windows CI, launch a built portable artifact, wait for a rendered frame, exercise movement/scene navigation, and close cleanly. Check process cleanup, offline operation, data/temp locations and runtime licenses.
5. Only after that run succeeds, document the supported Windows version and portable-launch extraction behavior. Do not infer support from a Linux cross-build.

Performance improvements should follow measured workloads. Before comparative claims, define equivalent Godot/Phaser scenarios on controlled hardware and preserve results and versions.
