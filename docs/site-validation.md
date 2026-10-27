# Official site implementation and validation

## Source history

The static documentation and playable gallery were introduced in `23b09b6` and validated further in `5426013e49eae2ac1f6e9d26d62357e0ce8833dd`. Both remain in main history. Theme activation was corrected in `c758b168d96f1dc04b57767107bc7c5b5d2a9507`; Blockfall was added in `f85dbfeb72485e1f920b8654d65611170400014f`.

Pages is enabled with GitHub Actions. Deployment uses the existing hosting configuration and does not enable visibility, configure DNS or add a custom domain. The GitHub Pages address redirects to the account's existing domain, `https://github.oz-coden.com/Simpludify/`.

## Build design

`site/config.mjs` is the page/language/sample manifest. `site/ja/` contains Japanese onboarding, concepts, guides and project policies. `site/en.md` explains translation coverage. Existing `docs/api.md`, architecture, roadmap, performance and licensing are rendered directly into `/en/`; they are not copied into another maintained source.

VitePress was considered. The available stable 1.6.4 adds a separate Vite 5/Vue/theme dependency graph to this Vite 8 workspace. The chosen generator uses existing Vite plus one exact development dependency, markdown-it 15.0.3 (seven lockfile additions including transitives). It emits static HTML; shared client code handles only theme, mobile navigation and the trusted sample iframe. No framework runtime, remote font, analytics, cloud API or server component is required. Code fences remain plain readable monospaced text rather than shipping a syntax-highlighter runtime.

`site:build` validates the absolute base, replaces only dedicated generated `.site-build/` and `site-dist/`, builds all document HTML and five independent sample roots, and adds notices/inventory. The game CLI keeps its existing `dist/` and defaults. The source-scaffold command also copies site sources so its copied package scripts remain usable.

One sample iframe is mounted on explicit request. Restart/switch/stop dispatches the trusted same-origin disposal event, then removes the iframe; sample bootstrap calls public Game.dispose. Direct sample navigation uses pagehide disposal and reloads on a restored back/forward-cache document. Parent and child CSS/input stay separate. The same-origin sandbox is document isolation for first-party examples, not a security boundary for arbitrary code. Character/Beacon movement remains keyboard-only; UI buttons, Signal Run movement and all Blockfall controls support touch.

## Reproduction

```sh
npm ci
npm run check
npm test
npm run site:build -- --base /Simpludify/
npm run site:check
npm run test:site
npm run site:build -- --base /
npm run site:check
npm run test:site
npm run test:browser
npm run test:build
npm run test:build:game
```

Install the Playwright Chromium headless shell first, or set CHROMIUM_PATH to a compatible binary. `site:serve` reads the built manifest and prints the correct preview URL. `SITE_URL=https://host/path/ npm run test:site` checks an actual deployed site rather than local output.

The site smoke suite crawls every document, checks root overflow, theme persistence, narrow navigation, all sample startups, visible keyboard-driven rendering changes, UI scene switching, synthetic touch movement, pause/resume, restart, explicit host/source disposal, focus return and renderer-unavailability messaging, plus a limited no-WebGL Character Canvas2D startup. It records screenshots and a machine-readable report under test-results/site. The static checker verifies local href/src destinations, anchors, sample entry points, required notices and base containment. It does not assert every external website's availability.

## Local validation (2026-10-27)

- Node 24.22.1, Linux, Playwright 1.64.1, Chrome headless shell 156.0.8078.4 with SwiftShader. Desktop 1440×900 and narrow 390×844; synthetic browser touch, not physical devices. Noto CJK was installed on the QA host to inspect Japanese glyphs; no font is bundled in the site.
- `npm run check`: passed, including DOM-free Core, strict TypeScript, boundaries, formatting and all 116 locked dependency licenses/notices. Nonblocking style suggestions remain; test fixtures also use explicit known-index assertions.
- `npm test`: 152 passed, including 24 Blockfall tests. `npm run test:browser`: 52 passed.
- Integrated site production build and local smoke: passed at both `/Simpludify/` and `/`, with 20 documentation pages and five sample entry points. Local href/src and anchor checks passed. Six complete `ts verify` code examples compile with the real project TypeScript CLI; contextual fragments are not claimed to be standalone programs.
- Each sample starts, visibly responds to keyboard/game controls, restarts and closes. Signal Run touch movement, pause/resume and replay entry passed. Actual restart/stop buttons trigger disposal before frame removal: owned hosts disappear for all five examples, while the UI/Scenes, Signal Run and Blockfall inspection hooks additionally confirm disposed Engine and zero input source handles. Both themes on all documents, narrow navigation and focus restoration passed. Blockfall keyboard/touch commands, pause/resume, repeated Scene restarts and button-operated game over/restart passed.
- A forced no-WebGL/no-WebGPU Character startup selected the pinned Pixi Canvas2D fallback. This is limited evidence, not complete fallback-renderer support. Disabling all canvas contexts produced the explicit startup help and released the failed host.
- Existing game-only production smoke builds for UI/Scenes and Signal Run passed under `/Simpludify/` at both viewport sizes; the original CLI output/meaning remains unchanged.
- Blockfall unit fixtures cover all seven pieces, occupied cells, wall kicks, one to four cleared lines, scoring/levels, lock delay, hold limits, terminal states, sub-frame command queues, gravity changes, pause and disposal. Identical seeded Engine input/time sequences produce identical snapshots. A 100,000-step headless test advances 1,666.7 simulated seconds through more than 100 rounds and 5,000 fixed pieces, without a renderer. This is functional/performance-feasibility evidence, not a cross-engine benchmark.

## Theme regression coverage

Theme initialization writes `data-theme` on the root HTML element. The former generic `[data-theme]` query selected that element before the button, so bubbled clicks from any descendant toggled the theme. The button now has its own `data-theme-toggle` selector; it retains native button activation and a stable accessible name, with `aria-pressed` reflecting dark mode. Optional storage failures still initialize from the OS color scheme.

`site-theme-test.mjs` checks both OS defaults, body/whitespace/navigation/sample-button clicks, button-only activation, persistence across reload/navigation, Enter/Space and blocked storage. Injecting the original site script into the browser test fails at the ordinary body-click assertion. `site-blockfall-test.mjs` checks the actual built game in both gallery viewports; all iframe restart/stop cases observe disposal before frame removal. Browser waits are bounded so missing input/render progress becomes a CI failure.

## Remote validation and deployment

Main commit [`c69429703bea94a2c368aa85cea0d6d24e7b426a`](https://github.com/oz-coden/Simpludify/commit/c69429703bea94a2c368aa85cea0d6d24e7b426a) passed [CI](https://github.com/oz-coden/Simpludify/actions/runs/40446215093) and [Documentation and Pages](https://github.com/oz-coden/Simpludify/actions/runs/40446214989), including a successful deploy job. The same work is saved on `codex/site-recovery-blockfall`.

The full site smoke suite then passed independently against **https://github.oz-coden.com/Simpludify/**, with Chrome 156.0.8078.4, desktop 1440×900 and narrow 390×844. It crawled all 20 documentation pages, exercised both themes and all five sample games, checked keyboard/synthetic touch controls, pause/restart, Blockfall game over, iframe disposal and focus return, and observed no failed requests, HTTP errors or uncaught page errors. Renderer-unavailable startup messaging and the limited no-WebGL Character fallback also passed at the published URL. This is live browser evidence, not a conclusion inferred from Actions alone.

Verified public entry points:

- [Documentation](https://github.oz-coden.com/Simpludify/)
- [Sample gallery](https://github.oz-coden.com/Simpludify/examples.html)
- [Blockfall directly](https://github.oz-coden.com/Simpludify/play/blockfall/index.html)
- [Blockfall rules and implementation](https://github.oz-coden.com/Simpludify/guides/blockfall.html)

Additional local Blockfall layout/cleanup checks passed at 320×568, 844×390 and 1440×900. Every Blockfall control met a 44×44 CSS-pixel minimum; these are browser viewport checks, not physical-device tests.

## Hosting and language limits

Japanese guides cover the current public capabilities, while English pages retain the detailed technical contracts and measurements. Full translation, built-in search, generated symbol-level TypeDoc pages and translated sample UI are not included. Exact public signatures remain in source and the detailed English API; code examples must track them. The public website does not make experimental APIs stable.

Validation targets Chromium/software WebGL on desktop and a narrow viewport with synthetic touch, not all mobile hardware or Safari/Firefox. WebGL context restoration and offline-installable PWA behavior remain unsupported. Static hosting still requires initial HTTP delivery; networking transport, simulation host and state authority remain future independent design choices.
