# SDK consumer integration — 2026-11-02

## Baseline and scope

Original main: `536118ea1b5a5fccae216ddbb198e5ac47f734c0`. Documentation review: PR #7, corrected head `fc148e660cd44ae3373e5654f1380dbeae8ef9f3`. Implementation branch: `feat/sdk-consumer-integration-2026-11-02`. The branch is staged on the reviewed documentation head while its CI runs; it must be based on the resulting latest main before integration.

Run To Exit's published-SDK review motivates a small Web-only `Game.bindViewport(ui, node)` adapter. It resolves the existing Flex geometry before world drawing and pointer conversion and uses existing Game frame/resize ownership. No browser primitive or game rule enters Core. The UI and region own cleanup; manual viewport remains the fallback. Collapsed regions use a zero clip while retaining a finite internal coordinate transform. A separate official sample demonstrates immutable integer rules, progress-only Tween, DOM/Canvas Tab navigation and Scene replacement.

## Checkpoint

- PR #7 formatter defects fixed and saved remotely; local `npm ci`, `npm run check`, baseline unit tests (805) passed. PR #7 CI still running at this checkpoint.
- New Web viewport binding, integration sample and focused browser/headless tests implemented locally. The new headless tests initially accessed a disposed Scene's lazy scheduler getter; fix the test to retain the scheduler before disposal, preserving the existing terminal lifecycle contract.
- Viewport browser checks, native composition interruption regression, standalone npm template, license generation and package README release guard remain pending. No new runtime change has been merged or published.
- npm v0.1.1 packages must remain unchanged. New runtime API is for a future release; npm publication is outside this implementation task.

This is a recoverable work checkpoint, not a success report. Record final commands, counts, CI URLs, limitations and integration SHA below after validation.

## Second checkpoint

First implementation checkpoint: `7ab1c6945511232f2d7efe5f59fdccca14dbcd06` (remote). Added the registry-only `templates/npm-vite` with locked 0.1.1 SDK, cross-platform Node build script, explicit CSS, lifecycle, Pages base and production dependency notices. A fixed-version Colord notice includes provenance. Local `npm run test:starter` passed on Linux, including an intentionally empty license text being rejected. Windows validation is configured in CI and remains unrun locally.

Package builds now reject stale README versions/install commands/unpublished wording. External tarball validation now performs `npm ci`, and npm subprocess invocation uses Node + npm's CLI path to avoid Windows `.cmd` spawning issues.

Reproduced a native text bug before fixing it: synthetic composition followed by focus transfer and refocus left Web's composing flag set, so a new Enter could not commit. The regression failed in both WebGL and Canvas2D; resetting that flag and the session reference on blur makes the native suite pass in both renderers and both viewport projects. No new focus API was necessary. Real OS IME remains a manual test limitation.

The three new headless discrete-world tests pass. The first combined focused browser run after the fix passed 37/38 tests: the remaining viewport test read layout before ResizeObserver delivery after a browser resize. Updated it to wait for host/UI widths to agree; retesting is pending. Initial mirror-button click tests were corrected to use keyboard activation: mirrors intentionally do not receive real pointer clicks, which are separately tested on the Canvas surface and through touch.

Official gallery/source integration and a production/live SDK sample check are added. Final full checks, PR/main CI, Windows and published-site verification remain pending. Run To Exit's repository and public game have not been modified.

## Reviewed implementation and local validation

PR #7 passed all CI and merged as `315efb7c83cf9ffa707558322f69d4c74e078ef9` ([CI](https://github.com/oz-coden/Simpludify/actions/runs/41342668958)). The implementation checkpoint `a99483cb1f024f8467c300f9733333ea295111db` includes that main merge as a parent. Separate runtime PR: [#8](https://github.com/oz-coden/Simpludify/pull/8).

Only one public API was added: `Game.bindViewport(ui, node): () => void`, in Web. It is additive; Core and existing `setViewport`/Tween/input signatures are unchanged. New bindings replace old bindings safely, staged UI is isolated, and disposal restores manual projection. Input-transparent slots remain usable world regions. Dedicated slots are supported; arbitrary nested scroll/clip masks are deliberately outside this helper's contract.

Verified locally:

- `npm ci`, `npm run check` (Core boundary, TypeScript, formatting, dependency notices); existing nonfatal lint warnings remain.
- `npm test`: **808 tests / 61 files passed**, including three new headless discrete-state tests.
- Native input regression suite: all 28 desktop/narrow × WebGL/Canvas2D cases passed after the blur fix. The integration lab's initial 10 browser cases passed after waiting for actual resize delivery. Four additional resize/ownership checks passed for both viewports, including staged preparation failure, foreign UI, region removal and transparent slots.
- `npm run test:packages`: external Core-only Node/NodeNext types, Web public declarations, lockfile `npm ci`, CSS, images, development/production subpath behavior and complete cleanup passed. The local-tarball fixture now additionally uses `bindViewport`; its rerun is pending at this checkpoint. Registry-mode fixtures deliberately avoid unreleased API.
- `npm run test:starter`: independent public-registry 0.1.1 installation, typecheck, production `/starter-test/`, CSS, Scene restart and notices passed on Linux. Negative checks reject stale README metadata and empty production license text. Windows validation is an explicit CI matrix job.
- `npm run build -- --target web` passed.
- `npm run site:build -- --base /Simpludify/`, `npm run site:check`: 73 HTML documents, 5091 local references and 65 standalone documentation snippets passed.
- `scripts/site-sdk-integration-live.mjs` passed against the production project-base build at 1440×900 and 390×844 with DPR 2; operations, paused display Tween, Scene reload and disposal had no page errors and zero remaining hosts/active display Tweens. Full site gallery and root-base CI remain pending at this checkpoint.

Deferred deliberately: a CLI generator (copyable independent starter is sufficient), a new discrete-world Tween/command VM (existing Tween APIs work), a generalized DOM focus-restoration API (application row identity is application-owned), and arbitrary nested world masks (no consumer need established). No runtime dependency was added. Core remains browser-free. Run To Exit remains untouched and the standalone registry starter provides an independent real consumer.

Next npm release candidates: corrected package README metadata, `Game.bindViewport`, native text composition/refocus fix. Template/build/distribution checks and official examples are source tooling/docs. Public npm 0.1.1 archives are unchanged, and no npm release/tag was created. Remaining limitations: synthetic IME tests are not OS-level IME certification; the viewport binding supports dedicated unscrolled slots; Windows and final PR/main/site status must be recorded after CI.

Local follow-up: the packed-runtime `bindViewport` fixture rerun passed, including public types and all desktop/narrow development/production checks. Full project-base gallery smoke passed with no failures, startup fallback and Canvas2D fallback included. Two additional screenshot-pixel tests confirmed collapsed viewports actually remove world pixels, beyond inspecting view metadata. The browser suite now contains 360 declared cases across the two viewport projects. Before the final source CI, the Linux starter job passed in the earlier checkpoint CI; Windows is still pending there. These are measured functional checks, not benchmark claims.

## Final review follow-up

The review found one application-sample defect: an already escaped display was faded in again at the beginning of a later step. Its opacity now stays zero once the preceding committed world was already escaped; the headless test asserts immediate and intermediate opacity on the following step. `npm run check` and all 808 unit tests passed again.

CI [41344182253](https://github.com/oz-coden/Simpludify/actions/runs/41344182253) confirmed both Windows and Linux registry starters, packages, quality and both site bases. Its production job failed at the existing Tween lab HP-completion wait (`scripts/site-tween-test.mjs`, 30-second timeout), without recording the HP/Tween state. The identical production Tween exercise passed locally for both desktop/narrow after rebuilding. This does not establish a definite root cause; added failure-only HP/playback/focus diagnostics without loosening the assertion or timeout. Final source CI must pass before merge. The full local browser regression is still running at this checkpoint.

The source repository's final checks now include the future `bindViewport` method through packed declarations/runtime; the independent public-registry starter continues to target only published 0.1.1. New release publication remains out of scope.

Final local browser result: `npm run test:browser` completed with **360 passed** across desktop/narrow, WebGL/Canvas2D, keyboard/touch/IME sessions, viewport pixel clipping, staged failures and existing engine regressions. The fresh production Tween CI check in [41344911811](https://github.com/oz-coden/Simpludify/actions/runs/41344911811) passed. Its quality job caught a formatting error in the added diagnostic block; formatted it and verified `npm run check` exits zero before the next checkpoint.

The documentation-only main merge's [post-merge CI 41343632422](https://github.com/oz-coden/Simpludify/actions/runs/41343632422) passed its build/test jobs and deployed Pages, but its subsequent existing live Tween startup probe timed out. The final implementation's main deployment and live probes still need confirmation; do not equate the historical post-deploy probe failure with a failed Pages upload or an established runtime defect.
