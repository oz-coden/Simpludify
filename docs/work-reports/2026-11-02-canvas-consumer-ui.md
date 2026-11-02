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
