# Changelog

All notable changes to the Simpludify engine (`@simpludify/core` and `@simpludify/web`) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.3.0] - 2026-11-13

[GitHub Release](https://github.com/oz-coden/Simpludify/releases/tag/v0.3.0) · [Publication record](docs/work-reports/2026-11-13-v0.3.0-world-queries.md#publication)

### Added

- Query the nearest or all intersections with Colliders and collision tiles through `CollisionWorld.raycast()` and `raycastAll()`.
- Clip Scene world visuals to rectangles, circles and simple polygons with `Game.setWorldMask()` on WebGL and Canvas2D.
- Read the most recent physical input kind through `Game.lastInputDevice` for optional game-specific prompts.

## [0.2.1] - 2026-11-11

This patch preserves the v0.2.0 public API. See the [GitHub Release](https://github.com/oz-coden/Simpludify/releases/tag/v0.2.1) and [publication record](docs/work-reports/2026-11-10-v0.2.0-independent-review.md#v021-publication) for verification details.

### Fixed

- Explicit asset reloads supersede background retries, validate options and report failures to the caller. Concurrent owners can share a reload without interrupting one another.
- Tilemaps replace stale textures when a managed atlas changes, including while layers are hidden or disabled.
- Consecutive diagnostic deduplication preserves distinct errors with inherited names or messages and avoids calling custom getters.
- Asset fallback observers and diagnostics receive a consistent `ASSET_TIMEOUT` error that preserves the original cause.
- Looping playback of a zero-duration audio buffer finishes cleanly and releases its playback slot.
- `Game.setFont()` refreshes Canvas UI when the default font changes or finishes loading, including with a manual frame driver.

## [0.2.0] - 2026-11-10

Release details and verification: [GitHub Release v0.2.0](https://github.com/oz-coden/Simpludify/releases/tag/v0.2.0) · [Publication Record](docs/work-reports/2026-11-10-v0.2.0-assets-audio-logger.md)

### Added

- Scoped Image, JSON, AudioBuffer and FontFace loading in Web, with shared resources, progress, retries and media fallbacks.
- Independent audio playback and hierarchical groups, plus a Game-wide font for Canvas and DOM UI.
- Opt-in Scene retention with resumed simulation state and rebuilt browser presentation.
- A Core Logger with structured diagnostics, and separate Console controls in Web.

### Changed

- `GameOptions.onError` is deprecated. Use `game.logger.subscribe()` for structured diagnostics. See the [v0.2.0 migration guide](docs/en/migrate-0.2.0.md).

- The default Scene disposal policy, `game.changeScene()` and URL-based image loading remain compatible with v0.1.7.

### Fixed

- Asset progress subscribers receive ordered updates during reentrant loads. Recovery notifications clear the previous error.
- Managed atlas replacements validate live Tilemap frame requirements before changing the current image.
- Pending audio selects the current buffer at first playback. Started voices retain their buffer through pause, resume and reload.
- A Scene disposed by its activation hook causes the transition to reject and the Game to dispose its retained Scenes.

## [0.1.7] - 2026-11-10

Release details and verification: [GitHub Release v0.1.7](https://github.com/oz-coden/Simpludify/releases/tag/v0.1.7) · [Publication Record](docs/work-reports/2026-11-10-v0.1.7-publication.md)

### Changed

- Renamed `Game.goTo(id)` to `Game.changeScene(id)` without a compatibility alias.
- Consecutive pending requests for the same scene share a Promise. Requests separated by another scene retain their queue positions.
- Unified documentation under `docs/ja/` and `docs/en/`, with benchmarks in `docs/benchmarks/` and the original specification in `docs/archive/`.
- Refocused the README on quick start, key concepts, and live examples. Installation and publishing guides use commands and version placeholders that apply across releases.

### Fixed

- Fixed scene activation and disposal edge cases, including rejected transitions and failed visual attachment cleanup.
- Fixed tilemap and geometry tilemap layer replacement, coexistence, ordering, and resource lease handling.
- Fixed gamepad button binding normalization and conflict detection.
- Guarded Canvas UI wheel and pointer handling for zero-sized hosts.
- Validated scene registration arguments and normalized tile coordinates at negative zero.

### Added

- **Build-time Syntax Highlighting (Shiki)**: Added syntax highlighting to the official documentation site generated during `site:build`. Supports TypeScript, JavaScript, JSON, HTML, CSS, Bash, PowerShell, YAML, Diff, and Markdown with zero client-side JavaScript or external CDN requirements.
- **Dual-Theme Code Blocks**: Syntax highlighting connects seamlessly with light and dark themes using CSS custom properties (`--shiki-light`, `--shiki-dark`) and includes an accessible copy-to-clipboard button.
- **Bilingual Navigation Separation**: The documentation site now separates Japanese and English navigation. The English sidebar shows only English guides and records; the Japanese sidebar includes an explicit fallback section for untranslated technical documents.
- **Language Continuity & Fallback Banners**: Preserves active language when navigating via the brand logo, header, or footer. Added bilingual fallback banners for unpaired technical records with safe return links.
- **User-Facing Changelog**: Created this `CHANGELOG.md` consolidating release history across all published SDK versions.

---

## [0.1.6] - 2026-11-05

Release details and verification: [GitHub Release v0.1.6](https://github.com/oz-coden/Simpludify/releases/tag/v0.1.6) · [Publication Record](docs/work-reports/2026-11-05-v0.1.6-publication.md)

### Added

- **Physical Input Bindings**: Added physical device bindings for keyboards (`KeyboardBindings`), mice (`MouseBindings`), and gamepads (`GamepadBindings`), unified under `UnifiedBindings`.
- **Single-Input Capture API**: Added `captureNextInput` and `InputCaptureListener` to record the next user action from keyboard, mouse, or gamepad for interactive key-configuration screens without third-party libraries.
- **Binding Persistence & Serialization**: Added `serializeBindings` and `deserializeBindings` (schema v1) for storing and restoring custom player control mappings as JSON.
- **Runtime Reconfiguration**: Added `InputBindingsController` supporting live binding updates, reset to defaults, and device-specific diagnostics.
- **Input Bindings Lab**: Added interactive `input-bindings` sample (`examples/input-bindings/`) demonstrating runtime rebinding, single-input capture, and JSON export/import.

### Changed

- Action controller seamlessly resolves physical bindings alongside legacy action bindings with zero breaking changes for existing setups.

---

## [0.1.5] - 2026-11-04

Release details and verification: [GitHub Release v0.1.5](https://github.com/oz-coden/Simpludify/releases/tag/v0.1.5) · [Publication Record](docs/work-reports/2026-11-04-v0.1.5-publication.md)

### Added

- **Virtual Sticks**: Added `VirtualStick` component supporting three positioning policies:
  - `fixed`: Remains at a fixed screen coordinate.
  - `floating`: Appears at the touch point within an activation zone.
  - `follow`: Dynamically slides along with pointer movement when dragged past stick boundaries.
- **Directional Virtual Buttons**: Added `VirtualButton` with support for optional 4-way and 8-way directional swipe gestures, hold states, and customizable visual styling.
- **Multi-Touch Pointer Routing**: Dedicated pointer-ID ownership preventing cross-talk between multiple simultaneous touches, with configurable screen activation zones.
- **Programmatic Input Handoff**: Added programmatic coordinate mapping and clean input release on touch cancel or scene change.
- **Virtual Input Lab**: Added interactive `virtual-input` sample (`examples/virtual-input/`) for testing mobile on-screen controls.

---

## [0.1.4] - 2026-11-03

Release details and verification: [GitHub Release v0.1.4](https://github.com/oz-coden/Simpludify/releases/tag/v0.1.4) · [Publication Record](docs/work-reports/2026-11-03-v0.1.4-publication.md)

### Added

- **Unified Action Input**: Introduced `ActionController`, `ActionSource`, and `ActionReader` to cleanly decouple physical device events from game simulation logic.
- **Standard Gamepad Integration**: Added first-class Gamepad API support with `GamepadInput`, `GamepadSource`, `GamepadBindings`, and helper utilities like `gamepadButtonLabel`.
- **Multi-Source Input & Local Multiplayer**: Added input source gating, allowing multiple players or autonomous programs to control separate actors independently (e.g. Player 1 on keyboard/WASD, Player 2 on gamepad).
- **Two-Player Lab**: Added interactive `unified-input` sample (`examples/unified-input/`).

### Fixed

- **Security Hardening**:
  - Sanitized input handling and prevented CSS/style injection in UI labels.
  - Added strict path traversal and symlink escape boundaries in local static preview server (`scripts/path-boundary.mjs`).

---

## [0.1.3] - 2026-11-03

Release details and verification: [GitHub Release v0.1.3](https://github.com/oz-coden/Simpludify/releases/tag/v0.1.3) · [Publication Record](docs/work-reports/2026-11-03-v0.1.3-publication.md)

### Added

- **Accessible Canvas UI**:
  - Added hidden DOM mirrors for readable text output.
  - Added configurable semantic heading levels (`h1`–`h6`) on Canvas labels.
  - Added ARIA-like status and alert live regions for assistive technologies.
- **Keyboard Input Hints**: Added portable `inputMode: "numeric" | "decimal"` hints to Canvas `TextInput` and `NumberInput` for mobile keyboards.
- **Render Optimizations**: Added internal caching for visible scroll views and GPU texture pooling with automatic reclamation on disposal.

### Fixed

- **Focus Resolution**: Resolved focus tracking issues when Canvas control geometry updates dynamically or when repeat focus is granted.
- **Disposal Safety**: Prevented invalidation leaks and retained texture references during scene replacement.

---

## [0.1.2] - 2026-11-02

Release details and verification: [GitHub Release v0.1.2](https://github.com/oz-coden/Simpludify/releases/tag/v0.1.2) · [Publication Record](docs/work-reports/2026-11-02-v0.1.2-publication.md)

### Added

- **First Official npm Publication**: First public release of `@simpludify/core` and `@simpludify/web` published to npm registry via GitHub Actions Trusted Publishing (OIDC) with SLSA v1 provenance.
- **Viewport Binding API**: Added `bindViewport` to `Game` and `Engine` to separate fixed HUD/UI viewports from dynamic world camera viewports.
- **Independent Vite Starter**: Created standalone npm/Vite starter template at `templates/npm-vite`.
- **Registry Consumer Validation**: Added automated external package validation test suite (`npm run test:packages:registry`).

---

## [0.1.1] - 2026-11-02

Release details and verification: [Git tag v0.1.1](https://github.com/oz-coden/Simpludify/releases/tag/v0.1.1)

### Fixed

- **Windows Packaging**: Fixed cross-platform path handling for npm packaging in `scripts/pack-packages.mjs`.

### Changed

- Synchronized package metadata and aligned engine versioning across workspaces.

---

## [0.1.0] - 2026-11-02

Release details and verification: [Publication Record](docs/work-reports/2026-11-01-npm-packaging.md)

### Added

- **Modular Monorepo Packaging**: Initial modular packaging of Simpludify as dual packages:
  - `@simpludify/core`: Platform-independent 2D engine simulation, actor/component model, spatial mathematics, tilemaps, collision solver, and deterministic tweens and timers.
  - `@simpludify/web`: Browser runtime with PixiJS 2D rendering (WebGL/Canvas2D), DOM UI overlay, Canvas UI, and input adapters.
- **CLI Tooling**: Added noninteractive command-line tool (`scripts/cli.mjs`) supporting `dev`, `check`, `test`, `build`, `pack:packages`, and `test:packages`.
- **Documentation Site**: Added static documentation generator (`scripts/site-build.mjs`) integrating Markdown guides and interactive sample galleries.
