# Documentation reorganization, cleanup and direct docs site build — 2026-11-06

## Baseline and objectives

- Baseline branch: `flash/docs/reorganization` at `26c1e8599f8ac3e32edfc1b557ea9f4a7d1e7aa1`.
- Task: Thoroughly reorganize, clean up, and consolidate Simpludify's documentation structure:
  1. Remove obsolete kickoff artifact `CODEX-START.md`.
  2. Update stale version references across `README.md`, `site/` and `docs/` reflecting that Core/Web v0.1.6 are published on npm, and the next development milestone is v0.1.7.
  3. Archive historical checkpoints (`docs/archive/`) and benchmark measurements (`docs/benchmarks/`).
  4. Provide matching Japanese and English documentation mirrors directly under `docs/` (`docs/ja/` and `docs/en/`), completely eliminating the duplicate `site/` directory.
  5. Consolidate and enrich content towards the **more detailed version** between Japanese and English documentation (e.g. enriching Japanese with full contracts/types/tables from English, enriching English with practical usage/troubleshooting/code from Japanese).
  6. Move static site presentation assets from `site/assets/` to `scripts/site-assets/`.
  7. Drive official site generation directly from `docs/` via `scripts/site-config.mjs`, ensuring identical routes for backward compatibility without redirects.
  8. Update all relative links across `README.md`, `AGENTS.md`, `examples/**/README.md`, and all docs.
  9. Pass all checks: `npm run site:build` (both `--base /Simpludify/` and `--base /`), `npm run site:check`, `npm run check`, and `npm test`.

## Architecture and directory structure

All user-facing documentation is now unified under `docs/`:

```
docs/
├── ja/                      # Complete Japanese documentation mirror
│   ├── index.md             # Onboarding & guide index
│   ├── getting-started.md   # Step-by-step tutorial & setup
│   ├── concepts.md          # Engine architecture & actor-component model
│   ├── api.md               # Detailed public API contracts & TypeScript examples
│   ├── architecture.md      # Engine lifecycle, tick sequence & ownership rules
│   ├── collision.md         # Trigger/Solid collision & tilemap collision
│   ├── scenes-ui.md         # Scene navigation & UI components
│   ├── layout.md            # Canvas Flex layout
│   ├── hosting.md           # Deployment & static site generation
│   ├── limitations.md       # Implemented vs unverified features & benchmarks
│   ├── npm.md               # NPM SDK installation & project setup
│   ├── npm-publishing.md    # NPM publishing & Trusted Publishing (OIDC)
│   ├── roadmap.md           # Implemented scope & future milestones
│   ├── licensing.md         # Dependency review & license notices
│   ├── host-boundary.md     # Core vs Web host responsibilities
│   ├── examples.md          # Sample catalog & descriptions
│   └── specs/               # 19 feature-level specifications
│       ├── action-input.md
│       ├── canvas-controls.md
│       ├── canvas-ui.md
│       ├── gamepads.md
│       ├── grid.md
│       ├── input-bindings.md
│       ├── movement.md
│       ├── rendering.md
│       ├── replay.md
│       ├── scrolling.md
│       ├── sdk-consumer-patterns.md
│       ├── sprites.md
│       ├── text-input-design.md
│       ├── tile-geometry.md
│       ├── tilemap.md
│       ├── tilemap-collision.md
│       ├── tween.md
│       ├── unified-input.md
│       └── virtual-input.md
├── en/                      # Complete English documentation mirror (identical paths)
│   ├── index.md
│   ├── getting-started.md
│   ├── concepts.md
│   ├── api.md
│   ├── architecture.md
│   ├── collision.md
│   ├── scenes-ui.md
│   ├── layout.md
│   ├── hosting.md
│   ├── limitations.md
│   ├── npm.md
│   ├── npm-publishing.md
│   ├── roadmap.md
│   ├── licensing.md
│   ├── host-boundary.md
│   ├── examples.md
│   └── specs/               # 19 feature-level specifications (identical names)
├── benchmarks/              # Performance methodologies and measurements
├── archive/                 # Historical design reviews and validation logs
└── work-reports/            # Task implementation checkpoints
```

## Content consolidation & enrichment

Content was systematically consolidated towards the most detailed version available:
- **`docs/ja/api.md` & `docs/en/api.md`**: Enriched Japanese with the full contract tables, TypeScript code examples, error types (`CollisionConfigError`, `DependencyError`, `LifecycleError`), and update orders from English.
- **`docs/ja/architecture.md` & `docs/en/architecture.md`**: Enriched Japanese with complete lifecycle state machine tables, transaction commit boundaries, ownership rules, and rendering phase diagrams.
- **`docs/ja/roadmap.md` & `docs/en/roadmap.md`**: Unified particles, camera modes, optional multiplayer stage definitions, spatial hash expansion, and deferred items.
- **`docs/ja/licensing.md` & `docs/en/licensing.md`**: Enriched Japanese with dependency review tables, SBOM specifications, Lightning CSS MPL-2.0 analysis, and distribution checklists.
- **`docs/ja/specs/*` & `docs/en/specs/*`**:
  - `movement.md`: Synchronized `SprintScale`, `CustomMovement` code, and execution order tables.
  - `tween.md`: Synchronized standalone test verification code, `actorTween`, `canvasTween`, and playback state tables.
  - `replay.md`: Synchronized PCG32/splitmix PRNG math, FNV-1a constants, and `parseReplayData` verification code.
  - `scrolling.md`: Synchronized settings tables, gesture arbitration, momentum math, and overlay bar metrics.
  - `canvas-controls.md`: Synchronized value/event contract tables, Slider key mapping, and Settings lab code.
  - `text-input-design.md`: Synchronized native session contracts, IME composition rules, and draft/commit state tables.
  - `action-input.md`: Synchronized `CanvasTextInput` integration code, Component dependency code, and validation data.
  - `tile-geometry.md`: Synchronized coordinate transformation tables, `screenToTile` code, and `Shape.Hexagon` Actor code.
  - `tilemap-collision.md`: Synchronized contact identity tables, solver diagnostics, and rectangle search code.
  - `sdk-consumer-patterns.md`: Synchronized `game.bindViewport` and `showCommittedWorld` discrete Tween interpolation code.
- **`docs/en/getting-started.md` & `docs/en/npm.md`**: Enriched English onboarding with step-by-step tutorials, `index.html`, `tsconfig.json`, `npm run create` usage, Canvas UI setup, and troubleshooting.
- **`docs/en/concepts.md` & `docs/en/collision.md`**: Enriched English with responsibilities table, custom components, optional events, Trigger vs Solid comparisons, and Tilemap collision code.
- **`docs/en/limitations.md`**: Enriched English with full implemented feature lists, unverified scope tables, and benchmark figures.

## Site generator integration

- `site/` directory was completely removed.
- Static assets moved to `scripts/site-assets/` (`site.css`, `site.js`, `theme-init.js`).
- `scripts/site-config.mjs` was created, mapping all 86 pages directly to `docs/ja/...`, `docs/en/...`, `docs/benchmarks/...`, `docs/archive/...`, and `examples/...`.
- `scripts/site-build.mjs`, `scripts/site-check.mjs`, `scripts/site-smoke.mjs`, `scripts/site-snippets.mjs`, `scripts/site-unified-input-live.mjs` were updated to import from `./site-config.mjs` and use `scripts/site-assets/`.
- `scripts/validate.mjs` was updated to verify `docs/en/api.md`, `docs/ja/api.md`, `docs/en/architecture.md`, `docs/ja/architecture.md`.

## Verification results

- `npm run site:build -- --base /Simpludify/`: Passed cleanly (101 HTML pages, 8 interactive player examples built in `site-dist/play/`).
- `npm run site:check`: Passed cleanly:
  - 101 HTML documents verified.
  - 9,488 links/assets verified with 0 broken links or missing anchors.
  - 97 standalone documentation code snippets typechecked with `tsc` without errors.
- `npm run site:build -- --base /` and `npm run site:check`: Passed cleanly for root base.
- `npm run check`: Passed cleanly (Biome checks passed, required-file and architectural boundary checks passed, SDK version 0.1.6 consistent, license allowlist and notices verified for 116 dependencies).
- `npm test`: Passed (66/66 test files passed, 891/891 unit tests passed).

## Commit history on branch

- `195e8d4`: `docs: remove CODEX-START and align documentation to published v0.1.6`
- `f8443b4`: `docs: categorize docs into specs, benchmarks, and archive with updated links`
- `167ee44`: `docs: translate core specs and unify roadmap into site structure`
- `757c8e8`: `docs: consolidate site into docs with unified ja/en mirrors and enriched content`

