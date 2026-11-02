# Canvas screen consumer integration

## Baseline and scope

- Simpludify main: `a83fb0da63aa78820222023614e5303f3f29f4ec`.
- Run To Exit main: `975feddeb24b90eefdb6ff7f93d59f474900d824`.
- Branch: `feat/canvas-game-ui` in both repositories.
- npm publication is excluded. Package manifests retain 0.1.2 until a separately approved release.

## Confirmed findings

The public SDK already includes Row/Column/Flex, Scroll, Button, Select, text/number editing, checkbox/slider, move/clear ownership, focus/reveal, native IME sessions, routing and bindViewport. Run To Exit can compose its screen without a new widget framework.

CanvasLabel lacked a semantic text mirror. Full Canvas migration would remove previously readable help, status, validation and plan text. Web now mirrors label text in tree reading order without introducing an application DOM API, interactive Tab stops or pointer targets. Label removal, visibility and disposal reuse presentation ownership. Scroll-clipped text stays available to semantic reading; opacity-zero text is hidden from accessibility. Interactive mirror identity and native editing order must remain stable.

Candidate consumer validation will use real npm archives outside the engine workspace. The published 0.1.2 consumer and the candidate must be distinguished. No release workflow will be dispatched.

## Checkpoint

Implementation and browser regression checks are in progress. Standard Chromium download returned invalid/truncated archives locally; CI continues to use its standard Playwright runtime. Physical IME and assistive technology remain separate manual checks.

## Dynamic focus and validation checkpoint

- Confirmed another consumer issue: `focus()` rejected a control immediately after it became visible or was inserted, because its previous bounds were empty. CanvasUI now resolves a dirty layout with the last Host-provided text metrics before explicit focus or traversal. The metrics callback is cleared on disposal. Existing clipping/ownership checks remain active.
- No public API was added, removed or renamed. Both changes improve existing contracts. Core remains DOM-free.
- Local quality checks passed; 809 unit tests passed. A first concurrent test run timed out in the existing Prism Raid soak; an isolated repeat passed all 808 baseline tests, followed by all 809 after the new focus test. The timeout is retained as an observed runner-contention result, not reported as a passed run.
- Native browser regression: 16 desktop tests passed across WebGL and Canvas2D (including label update/order/lifetime and existing IME/selection/clipboard/routing checks). The additional pre-frame focus regression passed in both renderers (2 tests).
- External tarball suite passed before the focus correction: Core-only Node/NodeNext, Web-only automatic Core install, dev and production subpaths, desktop/390/320 layouts, input, Scene transitions and idempotent cleanup. It will be repeated on the final candidate.
- SDK version 0.1.3 is prepared for the next release. Public registry/starter documentation continues to describe published 0.1.2. No tag, npm publish or publication workflow dispatch has occurred.
- Run To Exit PR: https://github.com/oz-coden/Run-To-Exit/pull/7. Engine PR: https://github.com/oz-coden/Simpludify/pull/11.

## Ownership and repeat-focus checkpoint

- Repeating `focus(node)` on the same node now reveals its current geometry after list growth/reorder. The first layout correction alone did not address this early-return path.
- UI invalidation after disposal is now a no-op, so routing release/hover cleanup cannot recursively attempt focus on an already-disposed UI. This fixes an actual external Scene replacement failure observed in Run To Exit.
- 811 unit tests passed after these fixes. The focused/hovered Scene replacement browser regression is added alongside the label and dynamic-focus checks.
- v0.1.3 candidate Core/Web archives were packed; no publication has occurred. Final archive integrity and CI will be recorded after the remaining regression checks.

## Publication authorization and mobile input

The v0.1.3 release is authorized after the implementation and validation complete. The immutable main source, tag, exact archive integrity and successful main CI will be selected before dispatching the existing Core-first OIDC publication workflow. GitHub connector operations do not expose tag creation or workflow dispatch, so the existing GitHub Actions UI is used for those operations. A manual SDK-tag workflow validates the version, exact main SHA and successful push CI, creates only the absent approved tag, and refuses to move an existing tag.

One new public option is justified by the consumer: `CanvasTextInputOptions.inputMode` and exported `CanvasTextInputMode` (`text | numeric | decimal`, default text). Text inputs preserve raw integers for application errors while requesting a numeric mobile keyboard. NumberInput's clamping/snapping semantics are unchanged. This avoids making the game manage a native input element merely to request the proper keyboard. A keyboard hint is not proof of a specific physical soft-keyboard layout. Unit and WebGL/Canvas2D native-attribute/raw-text tests cover the option.

## Final candidate and CI findings

- Local quality and all 812 unit tests passed. Numeric text keyboard hints passed native WebGL and Canvas2D checks. Final external archives passed Node/NodeNext, transitive Core resolution, inputMode declarations/native attributes, label semantics, development and production subpaths at desktop/390/320.
- Run To Exit's isolated final-candidate Canvas2D suite passed all 30 tests across desktop/320/390, with semantic labels and numeric keyboard hints required. The local Chromium 153 full-screen WebGL run timed out; a later subset passed, but that attempted all-renderer run was interrupted after the failure and is not claimed as passing. Standard Playwright Chromium remains required in CI.
- Initial standard CI passed engine quality, all browser shards, production, both site bases and Windows/Linux package consumers. It found a release-cycle error in the starter check: the published starter at 0.1.2 was compared to unpublished source 0.1.3. The check now verifies an exact starter version against its own committed lockfile and actual clean registry installation. README consistency tests continue to use the source candidate version. Starter dependencies will move to 0.1.3 only after publication.

## Clipped rendering performance

Investigation of the long-form WebGL path found that fully scroll-clipped entries still submitted their displays and stencil masks for drawing. Web now suppresses those paint submissions while retaining node identity, text semantics and focus traversal. The same rule excludes offscreen overlay scrollbars. `canvasDiagnostics.visibleNodes` exposes the number of paint-visible UI entries for verification; it does not virtualize or remove the model tree.

A 20-row scroll fixture keeps more than 50 model/semantic nodes while fewer than 10 remain paint-visible, including after focusing the final entry. The WebGL and Canvas2D regression passed and confirms that offscreen semantic text remains present and focus reveals the control. The external full-screen WebGL consumer is being repeated to measure the actual effect; no speedup is assumed from the code alone.

## Verified scroll-screen WebGL cache

Culling alone did not resolve the full-screen software-WebGL test timeout. The unchanged UI still repeated many clipped text/stencil draws during world-only frames. WebGL scroll screens now cache their composed UI until a UI mutation, scroll, focus, layout or scale change. Ordinary HUDs without a visible scroller and Canvas2D retain direct rendering. Caching is skipped above a 4096-physical-pixel host edge; cache resolution follows renderer DPR × UI scale.

The private cache target is GPU-unloaded before returning it to Pixi's pool when the cache is disabled, on resize/DPR/UI-scale change, or UI disposal. No global texture-pool clearing or new game configuration is introduced. Real-pixel tests cover changed backgrounds, UI scaling, persistent caching and a target unload on Scene replacement, separately for WebGL and uncached Canvas2D.

The same desktop editor-driven solution case, previously timing out at 180 seconds locally, passed in about 40 seconds using Chromium 153/software WebGL after the corrected cache implementation. This is a single regression-case observation, not a general engine benchmark. Full standard Chromium CI remains required before release.

Final local cache checks passed for WebGL and Canvas2D (4 tests): culling, actual pixel updates, UI scaling and Scene-target unload. All 812 unit tests, quality checks and the repeated packed-package consumer suite passed on the cache implementation.
