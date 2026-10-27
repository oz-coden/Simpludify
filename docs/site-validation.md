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

The site smoke suite crawls every document, checks root overflow, theme persistence, narrow navigation, all sample startups, visible keyboard-driven rendering changes, UI scene switching, synthetic touch movement, pause/resume, restart, explicit host/source disposal, focus return and WebGL failure messaging. It records screenshots and a machine-readable report under test-results/site. The static checker verifies local href/src destinations, anchors, sample entry points, required notices and base containment. It does not assert every external website's availability.

## Validation status at checkpoint

- Implementation and static build: complete; /Simpludify/ link validation passed (23 HTML documents).
- Strict checks, unit tests, browser/site tests: in progress; final results will replace this section before main integration.
- Root-path build, Actions, deployment and actual public URL: not yet verified at this checkpoint.

## Hosting and language limits

Japanese guides cover the current public capabilities, while English pages retain the detailed technical contracts and measurements. Full translation, built-in search, generated symbol-level TypeDoc pages and translated sample UI are not included. Exact public signatures remain in source and the detailed English API; code examples must track them. The public website does not make experimental APIs stable.

Validation targets Chromium/software WebGL on desktop and a narrow viewport with synthetic touch, not all mobile hardware or Safari/Firefox. WebGL context restoration and offline-installable PWA behavior remain unsupported. Static hosting still requires initial HTTP delivery; networking transport, simulation host and state authority remain future independent design choices.
