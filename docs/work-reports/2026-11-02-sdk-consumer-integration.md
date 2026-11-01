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
