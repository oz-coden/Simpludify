# Official site implementation and validation

## Scope and recovery

Source baseline: main `8a07049dab7e9e3901211e4426341a680b5141c9`. The previous main CI completed successfully before this work began. The earlier transient checkout was unavailable; the latest remote source and complete prior commits were recovered with a fresh clone, without overwriting a local working copy. Work is checkpointed on `codex/docs-site` before main integration.

Repository metadata initially reported public visibility and `has_pages: false`. The repository administrator subsequently enabled Pages with GitHub Actions, and metadata then reported `has_pages: true`. The workflow does not enable Pages, change repository visibility, configure DNS, or add a custom domain.

## Build design

`site/config.mjs` is the page/language/sample manifest. `site/ja/` contains Japanese onboarding, concepts, guides and project policies. `site/en.md` explains translation coverage. Existing `docs/api.md`, architecture, roadmap, performance and licensing are rendered directly into `/en/`; they are not copied into another maintained source.

VitePress was considered. The available stable 1.6.4 adds a separate Vite 5/Vue/theme dependency graph to this Vite 8 workspace. The chosen generator uses existing Vite plus one exact development dependency, markdown-it 15.0.3 (seven lockfile additions including transitives). It emits static HTML; shared client code handles only theme, mobile navigation and the trusted sample iframe. No framework runtime, remote font, analytics, cloud API or server component is required. Code fences remain plain readable monospaced text rather than shipping a syntax-highlighter runtime.

`site:build` validates the absolute base, replaces only dedicated generated `.site-build/` and `site-dist/`, builds all document HTML and four independent sample roots, and adds notices/inventory. The game CLI keeps its existing `dist/` and defaults. The source-scaffold command also copies site sources so its copied package scripts remain usable.

One sample iframe is mounted on explicit request. Restart/switch/stop dispatches the trusted same-origin disposal event, then removes the iframe; sample bootstrap calls public Game.dispose. Direct sample navigation uses pagehide disposal and reloads on a restored back/forward-cache document. Parent and child CSS/input stay separate. The same-origin sandbox is document isolation for first-party examples, not a security boundary for arbitrary code. Character/Beacon movement remains keyboard-only; UI buttons and Signal Run movement support touch.

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
- `npm run check`: passed, including DOM-free Core, strict TypeScript, boundaries, formatting and all 116 locked dependency licenses/notices. Nonblocking existing template-style and disjoint CSS specificity suggestions remain.
- `npm test`: 128 passed. `npm run test:browser`: 52 passed.
- Integrated site production build and local smoke: passed at both `/Simpludify/` and `/`, with 19 documentation pages and four sample entry points. Local href/src and anchor checks passed. Six complete `ts verify` code examples compile with the real project TypeScript CLI; contextual fragments are not claimed to be standalone programs.
- Each sample starts, visibly responds to keyboard/game controls, restarts and closes. Signal Run touch movement, pause/resume and replay entry passed. Actual restart/stop buttons trigger disposal before frame removal: owned hosts disappear for all four examples, while the existing UI/Scenes and Signal Run inspection hooks additionally confirm disposed Engine and zero InputSources. Theme persistence, narrow navigation and focus restoration passed.
- A forced no-WebGL/no-WebGPU Character startup selected the pinned Pixi Canvas2D fallback. This is limited evidence, not complete fallback-renderer support. Disabling all canvas contexts produced the explicit startup help and released the failed host.
- Existing game-only production smoke builds for UI/Scenes and Signal Run passed under `/Simpludify/` at both viewport sizes; the original CLI output/meaning remains unchanged.
- `npm audit` reported zero known vulnerabilities in the current registry response. This is a dated observation, not a security guarantee.

## Remote validation and deployment checkpoint

The initial `23b09b6` work-branch checkpoint passed strict checks, all 128 unit tests, site build/reference checks and all 52 existing browser tests. Its new site test failed because the initial synthetic pointer event did not represent a browser touch. The corrected harness uses CDP touch input and scrolls the control into view; local root/project-base runs pass. Narrow prose overflow was also corrected. The subsequent commit contains these validated fixes and the standalone code-example check.

At this checkpoint, the corrected Actions run and the live Pages deployment are pending. No local result in this document is evidence of a public-site test. Main integration will use a fresh remote-head check and a non-forced ref update; deployment evidence will be recorded after the actual URL is checked.

## Hosting and language limits

Japanese guides cover the current public capabilities, while English pages retain the detailed technical contracts and measurements. Full translation, built-in search, generated symbol-level TypeDoc pages and translated sample UI are not included. Exact public signatures remain in source and the detailed English API; code examples must track them. The public website does not make experimental APIs stable.

Validation targets Chromium/software WebGL on desktop and a narrow viewport with synthetic touch, not all mobile hardware or Safari/Firefox. WebGL context restoration and offline-installable PWA behavior remain unsupported. Static hosting still requires initial HTTP delivery; networking transport, simulation host and state authority remain future independent design choices.
