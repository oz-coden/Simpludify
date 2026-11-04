# Virtual sticks and generic pointer input — v0.1.5

## Baseline and scope

- Baseline main: `02ac22b487912e1403163c92dc35384f9cc44aed`; [CI 41629951815](https://github.com/oz-coden/Simpludify/actions/runs/41629951815) passed all 20 validation jobs plus Pages deployment. Registry Core/Web remain published 0.1.4.
- Work branch: `feat/virtual-input-v0.1.5`.
- Scope: fixed/floating/follow sticks, optional-direction virtual buttons, explicit activation regions, existing ActionSource composition, a two-stick sample, Japanese/English contracts and regression/distribution validation. No npm publication or release/tag creation.
- Initial inspection covered contributor instructions, README, architecture/API, Core PointerRouting/ScenePointer/ActionController/InputSystem, Canvas UI/value controls, Web BrowserPointer/Game/PixiRenderer and the site/SDK validation workflow. `npm ci` succeeded on Node 24.

## Design checkpoint

The existing PointerRouting remains the sole pointer-ID ownership boundary. Canvas UI picks first; a Scene-scoped virtual-input provider supplies virtual buttons before sticks; unmatched gestures retain world routing. Captured ownership never changes when activation regions are crossed. Occupied controls suppress additional pointers rather than falling through to another receiver. Existing scroller/control arbitration remains local to Canvas UI.

Core owns portable activation geometry, gesture state, dead zones, radial normalization, elapsed hold time and ordinary controller-owned ActionSources. Web supplies the current host CSS-pixel viewport, browser Pointer Capture and Pixi presentation. Virtual controls do not create gameplay Controllers, Actors, device detection or game-specific abilities. Visibility and input enablement are independent.

Built-in viewport-relative/screen-space rectangles and circles receive exact overlap checks within each same-priority control group. Custom predicates declare conservative screen-space bounds; intersecting bounds are rejected as ambiguous even if predicates might be disjoint. Canvas UI and virtual-button overrides of broad stick areas are intentional priority rules. Geometry changes are validated before commit and cancel active gestures so resized layouts cannot retain stale axes.

Input reset, pause/replay transitions, blur, pointer cancellation, controller/Scene disposal and explicit disable release the affected source and cancel the captured gesture. Long holds use an explicitly advanced presentation clock; release confirmation contains the final optional direction while the source itself becomes neutral.

Implementation and all feature-specific checks are pending at this checkpoint. Physical hardware, vendor/driver behavior, physical mobile browsers/IME and non-Chromium support must not be inferred from synthetic pointers or emulated viewports.

## Implementation checkpoint 1

Core VirtualInput/VirtualStick/VirtualButton, activation geometry and the existing PointerRouting target port are implemented. The Web Game lazily owns one provider per Scene; Pixi paints the controls beneath Canvas UI with no extra event adapter. Pointer Capture, virtual-only focus interruption, model visibility/enablement, relative viewport updates and cleanup reuse existing lifetime/input boundaries. Source manifests/lock/ENGINE_VERSION are prepared as 0.1.5; public registry/starter pins remain unchanged.

The new unit suite passes 18 tests; targeted Action/pointer regressions pass 42 tests across three files. Initial fixtures incorrectly omitted the Canvas layout measurement callback and used KeyCode.KeyD rather than KeyCode.D; correcting those fixture calls produced the pass. TypeScript passed after implementation/sample corrections. An existing architecture validation pass is recorded when complete below. Four browser behaviors for both WebGL/Canvas2D and both standard viewports are added but not yet executed. Standard Playwright Chromium download failed with truncated ZIP data; a supplemental npm-distributed Chromium is being prepared.

The sample includes separate movement/aim sticks, a central 12% gap, a directionless hold button and directional release button, ordinary Canvas UI precedence, all stick modes, explicit visibility/enablement, program handoff, pause and Scene restart. Browser acceptance, comprehensive units, packaging, bilingual documentation and full CI remain pending.

Core boundary validation initially rejected the interaction module importing the runtime graphics coordinate factory. The portable control now constructs its validated screen-point data locally and imports only coordinate types; architecture and required-file validation pass without relaxing the dependency policy.

## Documentation and browser acceptance checkpoint

Implementation checkpoint `372c2f62d4ca4b20d53f9a6bc1ad0ee51e9a1ce7` is saved remotely. Full local static validation passed. Full units passed 860/860 before the additional Replay fixture; the expanded virtual/pointer/gamepad subset passes 48 tests / 3 files, including 19 virtual-input cases. The Replay fixture initially used different random default seeds; assigning its explicit fixture seed made the recorded-input check pass.

Supplemental Chromium 153 passed all 16 new browser cases: four behaviors × WebGL/Canvas2D × desktop/narrow. They exercised actual CDP finger crossing, third-pointer button coexistence, all mouse modes, hidden-but-enabled input, disable/rearm, Actor-preserving program handoff, Canvas precedence, center gap, real capture release, blur, outside focus, resize and Scene disposal. Initial browser failures were fixture issues: CDP partial touchEnd lists the fingers being released rather than the survivors; lostpointercapture is delivered when the browser processes the next pointer event. The corrected tests preserve the same assertions/deadlines and assert surviving stick identity. No product test, retry or global timeout was relaxed. The old checkpoint CI is not final-head evidence.

Japanese/English virtual-input contracts and a paired site route are added; the playable sample is registered. Current README/API/architecture/Action documentation distinguishes 0.1.5 candidates from registry 0.1.4. Project-base site build/check passed 94 HTML documents, 8,304 references and 82 standalone TypeScript examples. Root-base/browser site verification is pending.

Distribution fixtures now import and execute the virtual API from real external Core/Web tarballs, including strict NodeNext Core execution and Web lifetime cleanup. A new browser case checks actual virtual-control pixels, hiding independently of input, and repeated independent provider/presentation disposal. These latest cases, complete package checks and final-head CI remain pending at this checkpoint.

## Distribution and lifecycle review checkpoint

Checkpoint `add053021cbe013fb2eab40489b325854472f836` preserves the paired docs and corrected pointer fixtures. The complete unit suite now passes 861/861. External package verification passes all archive/export/integrity, NodeNext Core, exact transitive Web, strict declarations, Vite subpath and development/production browser groups using the candidate tarballs. Both site bases pass static checks and all 82 snippets; the latest project-base build has 94 HTML documents and 8,305 references.

The added actual-pixel/visibility/independent-provider lifecycle cases pass 4/4 across both renderers/viewports. A follow-up focused run of those and capture/focus/resize/Scene cases passes 8/8 after the final provider cleanup changes. Provider presentations are owned by the provider lifetime, avoiding retained Scene cleanup closures across explicit provider recreation. Virtual buttons paint above sticks regardless of creation order, consistent with input arbitration. No runtime dependency was added.

The sample now exposes the same live diagnostics/HMR cleanup pattern as existing official labs. Gallery smoke explicitly switches its mode and visibility and verifies iframe stop/restart resource cleanup. A built/published-site acceptance script exercises actual CDP crossing, third-pointer release, neutral cancellation, Actor-preserving program handoff and Scene/final cleanup in four renderer/viewport combinations; it is included in both site-base jobs and post-Pages acceptance. Execution of this latest built-site script and final-head CI are pending. No npm release/tag/publication workflow has run.

## Final validation and support record

### Changed surface

- Core: `interaction/virtual-regions.ts`, `virtual-control.ts`, `virtual-input.ts`, internal target port and existing PointerRouting/InputSystem integration; public barrel exports. No DOM, Node or new runtime dependency enters Core.
- Web: Scene-context/Game access, browser focus/capture release and Pixi presentation/resource diagnostics, below ordinary Canvas UI. Existing ActionController/Character identities remain stable.
- Executable documentation: `examples/virtual-input`, paired English/Japanese guides, API/architecture/Action references and gallery routes. Candidate manifests, lock and ENGINE_VERSION are 0.1.5; registry/starter pins stay 0.1.4.
- Verification: dedicated unit/browser suites, external tarball consumers, gallery and built/live-site acceptance; the latter also runs after Pages deployment.

### Local commands and evidence

| Check                                                      | Result                                                                                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                            | Passed: 630 files; architecture/version/license validation; 116 reviewed dependencies. Existing 16 warnings / 12 informational diagnostics remain.                                          |
| `npm test -- --maxWorkers=2`                               | 861/861 tests, including 19 virtual-input tests.                                                                                                                                            |
| New browser suite and focused follow-up                    | All 20 added cases passed across both renderers and viewports; latest lifecycle/pixel rerun 8/8.                                                                                            |
| `npm run test:packages`                                    | Passed external Core/Web archives, strict NodeNext/types, dependency/export checks and development/production browser consumers.                                                            |
| `site:build` / `site:check`, both bases                    | Passed 94 HTML documents and 82 independent TypeScript examples; latest project-base check resolved 8,305 references.                                                                       |
| `CHROMIUM_PATH=… npm run test:site`                        | Passed built project-base gallery/docs/playables, including mode/visibility and iframe stop/restart cleanup.                                                                                |
| `CHROMIUM_PATH=… node scripts/site-virtual-input-live.mjs` | Passed four renderer/viewport combinations: actual CDP crossing, third-pointer release, neutral cancellation, visibility, same-Actor program handoff and complete disposal; no page errors. |

Durable verification evidence: [successful feature CI summary](assets/v0.1.5-virtual-input/feature-ci.json); supplemental local evidence: [built-site acceptance](assets/v0.1.5-virtual-input/built-site-local.json), [gallery acceptance](assets/v0.1.5-virtual-input/gallery-local.json). These files identify source commit and local browser; their ephemeral localhost URLs are observation origins, not published endpoints. Desktop/narrow screenshots were also visually inspected for the built sample.

The standard local Playwright Chromium 156 download returned truncated ZIP data. Local browser runs therefore used npm-distributed Chromium 153.0.8010.0 with SwiftShader via CHROMIUM_PATH, installed outside the repository; normal CI remains on its pinned Playwright browser. This does not change the lockfile or supported-browser claims.

### Limits

Physical phones/tablets/touch PCs, physical pens/gamepads, browser/OS gesture policies, Safari/Firefox, real GPU performance, pen pressure/tilt and assistive technologies were not hardware-certified. Synthetic CDP touch and emulated viewport tests establish pointer identity/lifecycle behavior, not vendor compatibility. Custom-region bounds are deliberately conservative: intersecting same-priority bounds are rejected even when predicates could be disjoint. Painted virtual buttons do not add separate native keyboard focus targets; provide keyboard/gamepad/Canvas alternatives through the existing Actions. Game-specific skill targeting, cooldowns and damage remain application code.

No v0.1.5 npm package, Git tag or GitHub Release was published. Read-only registry checks during final validation still returned Core/Web latest 0.1.4.

## Integration

- Feature validation: [`daa984010c2718c40fe7cbb5f31c3cd4b4a8862d`](https://github.com/oz-coden/Simpludify/commit/daa984010c2718c40fe7cbb5f31c3cd4b4a8862d), [CI 41817718266](https://github.com/oz-coden/Simpludify/actions/runs/41817718266): all 20 validation jobs passed; branch deployment correctly skipped. The four browser shards passed 111 + 101 + 111 + 101 = 424 cases, with no retry.
- Main fast-forward: `02ac22b487912e1403163c92dc35384f9cc44aed` → `daa984010c2718c40fe7cbb5f31c3cd4b4a8862d`, 2026-11-04 20:11 JST. The expected-head lease confirmed no intervening main change.
- Integration main CI: [41819188872](https://github.com/oz-coden/Simpludify/actions/runs/41819188872); all 20 validation jobs passed. Initial Pages deployment failed before checkout/acceptance because the deployment API returned HTTP 500 (job 126539955988, request F01A:B0055:E21B1C:2EA4A78:6AEB14AC). Only that failed infrastructure job was retried; code, tests, timeouts and retry settings were unchanged. Attempt 2 failed with HTTP 502 before acceptance (job 126540587617, request 1432:1A5196:E9370B:2FFE479:6AEB14E1). Therefore this integration run has overall failure despite all 20 validation jobs passing; it is not evidence of successful Pages deployment or live acceptance.

- At 20:20 JST the [official GitHub status summary](https://www.githubstatus.com/api/v2/summary.json) reported Actions degraded performance and Pages operational. The observed deployment API 500/502 responses are infrastructure errors; a causal connection to the announced incident is not established.
- Final report/roadmap/evidence changes contain no runtime code. Their push uses the unchanged normal main workflow, including Pages and published virtual-input acceptance. [Main CI history](https://github.com/oz-coden/Simpludify/actions/workflows/ci.yml?query=branch%3Amain) identifies the latest report commit and its deployment result; the source validation above remains pinned to the implementation SHA.

### Recovery and acceptance

All implementation files and initial checkpoints are on main, with the complete feature branch retained. To resume after an infrastructure interruption, inspect the latest main workflow and Pages deployment first. When validation jobs are already successful and deployment alone failed with a transient service error, retry only that failed deploy job; do not publish npm, create a release/tag or alter tests to resolve deployment. Published acceptance must run against the deployed sample, not a local build. The CI artifact `published-sample-validation/virtual-input-live.json` records four live cases and exact source SHA after a successful deployment.

Source and built-site implementation acceptance is complete: three stick modes, configurable geometry/dead zone, independent visibility/enablement, pointer identity/priority/lifecycle, optional-direction buttons/holds/release, existing ActionSource composition, resizing, sample and bilingual contracts. Deployment attempts and automated live results are available in main CI history. Physical/non-Chromium limits above remain open.
