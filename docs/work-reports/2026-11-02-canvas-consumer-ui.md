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
