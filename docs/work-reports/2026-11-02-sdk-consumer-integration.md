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
