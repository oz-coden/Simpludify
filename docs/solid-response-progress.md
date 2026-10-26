# Solid response validation

Work branch: `codex/solid-response`, based on main at `3f3d935`. Validated commits are retained on the work branch so implementation can resume from a published checkpoint. Read the branch log and this document before replacing any local changes.

## Implemented scope

- Collider defaults to CollisionResponse.Trigger. Solid is explicit; CollisionBody separately chooses dynamic or fixed inverse-mass participation.
- Existing circle/oriented-box geometry, filters and contact ownership are reused. Minimum translation, bounded deterministic response, post-response events and independent query snapshots are included.
- Signal Run composes a dynamic player, fixed blue walls, nonblocking amber pickups and red hazards. It retains the original collection route, HP, timeout, pause and replay.
- CameraFollow operates in world units with zoom-aware bounds and optional exponential smoothing. Zoom updates follow position immediately to keep pointer conversion coherent.

## Reproduce

```sh
npm ci
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm run test:build
npm run test:build:game
npm run bench:response -- --out benchmarks/solid-response/after-core.json
npm run build -- --target web --example signal-run --base /Simpludify/
npm run bench:response -- --mode browser --soak-seconds 300 --out benchmarks/solid-response/browser-profile.json
```

CHROMIUM_PATH may select an existing compatible browser. Core mode runs under exposed Node GC through the npm script. Browser mode samples normal application RAF, then stops its automatic scheduling and explicitly drives RAF-only, simulation-only, draw-only and combined workloads. Its draw proxy calls the public Game.setViewport method and includes projection/update plus synchronous draw submission. Deferred layout, compositor and GPU execution are outside these JavaScript CPU clocks.

The optional soak is actual wall-clock operation, with alternating movement input, fresh rounds every 20 seconds and forced-GC heap/DOM samples every 30 seconds. The recorded five-minute checkpoint predates the final interior-wall placement adjustment; the final-placement profile uses a separate 60-second run. Both raw reports retain their source revisions. The recorded duration is bounded; it does not establish multi-hour or native/GPU memory stability. The benchmark then verifies repeated scene cycles and disposal. Run measurements separately from other local tests/builds.

## Behavioral coverage and limits

Unit checks include Trigger/Solid combinations, fixed/dynamic and mass ratios, masks, circle containment, rotated walls, repeated corner pressure, introduced contacts, invalid geometry, event exceptions, participant deletion, disposal, snapshots, deterministic replay and deliberate discrete tunneling. Smaller explicit Engine steps are tested as a mitigation, not a continuous-collision guarantee.

Browser checks cover both 1440×900 and 390×844: real input, wall contact, sliding, Enter/Stay/Exit, Trigger collection, full route completion, result/replay, pause, camera/pointer conversion, rendering and teardown. A zoom-coordinate race found during integration is covered by the destination-click fixture. Focus-sensitive input tests run sequentially without retrying failures.

Response is translation-only, with no forces, angular dynamics, friction, impulses or moving-platform velocity transfer. Fixed iteration budgets cannot guarantee all dense stacks, impossible gaps or deep interlocking shapes. Inspect responseDiagnostics.unresolved. The sweep retains quadratic worst cases; no spatial-index rewrite or general performance superiority is claimed. API contracts and measured observations are maintained in [API](api.md) and [Performance](performance.md).

## Recorded validation state

The completed extension has 128 passing unit checks. Browser coverage comprises 52 desktop/narrow cases, including focused reruns for zoom conversion and Solid walls. Production smoke checks pass for both UI/scenes and Signal Run under /Simpludify/. Core before/after workloads, pair churn, 500 disposal cycles, a 300-second checkpoint run and a separate 60-second final-layout run are recorded in benchmarks/solid-response. Final CI reruns the complete suite, production checks and Core response workload against committed sources.
