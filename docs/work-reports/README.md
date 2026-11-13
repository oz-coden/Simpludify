# Work reports

This directory contains persistent engineering reports, implementation logs, verification metrics, and publication audit trails for Simpludify developers and contributors.

> [!NOTE]
> **CHANGELOGとの役割分担 / Role Separation**:
> - **[CHANGELOG.md](../../CHANGELOG.md)**: 利用者向けの公式変更履歴（バージョン別の機能追加・変更・修正・互換性情報）。
> - **`docs/work-reports/`**: 開発者・メンテナー向けの技術作業日誌（実装詳細、検証メトリクス、コミットSHA、CI実行ログ、既知の制約）。過去の報告書本文は歴史的記録としてそのまま保持されます。

---

## Release & publication records

| Version    | Publication date (JST) | Report                                                                                  | Status & verification                                                                                                                                                                                              |
| ---------- | ---------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **v0.1.7** | 2026-11-10             | [v0.1.7 publication and Run To Exit adoption](2026-11-10-v0.1.7-publication.md)         | **Complete**: Core/Web 0.1.7 published with signed provenance from `2ee6eb4`. Clean npm package and starter acceptance passed.                                                                                     |
| **v0.1.6** | 2026-11-05             | [v0.1.6 publication and registry verification](2026-11-05-v0.1.6-publication.md)        | **Complete**: Core/Web 0.1.6 published via GitHub Actions Trusted Publishing (OIDC) from `a137594`; signed provenance recorded in Sigstore; clean public-registry consumer tests passed.                           |
| **v0.1.5** | 2026-11-04             | [v0.1.5 publication and registry verification](2026-11-04-v0.1.5-publication.md)        | **Complete**: Core/Web 0.1.5 published via OIDC from `ed3ccc6`; immutable tag `v0.1.5`, exact registry archives, clean consumers, and four virtual-input browser cases passed.                                     |
| **v0.1.4** | 2026-11-03             | [v0.1.4 publication and public-registry verification](2026-11-03-v0.1.4-publication.md) | **Complete**: Core/Web 0.1.4 published via OIDC from `84a5f1b`; exact registry archives, clean consumers, TypeScript, production build, and gamepad API checks passed.                                             |
| **v0.1.3** | 2026-11-03             | [v0.1.3 publication and Canvas adoption](2026-11-03-v0.1.3-publication.md)              | **Complete**: Core/Web 0.1.3 published via OIDC from `1164b77`; clean registry consumer and Run To Exit game adoption passed.                                                                                      |
| **v0.1.2** | 2026-11-02             | [v0.1.2 publication and registry adoption](2026-11-02-v0.1.2-publication.md)            | **Complete**: First official npm release via Trusted Publishing OIDC from `8122a6d`; bindViewport and clean registry consumer tests passed. (See also [v0.1.2 release preparation](2026-11-02-v0.1.2-release.md)). |
| **v0.1.0** | 2026-11-01             | [Experimental npm SDK packaging](2026-11-01-npm-packaging.md)                           | **Complete (Packaging)**: Initial modular packaging and external tarball consumer verification from `b7951e9`; 805 unit tests and 346 browser tests passed.                                                        |

---

## Technical implementation reports (by date)

### 2026-11-13

- [v0.3.0 world queries, masks and input activity](2026-11-13-v0.3.0-world-queries.md).

### 2026-11-10

- [Independent v0.2.0 code review, fixes and verification](2026-11-10-v0.2.0-independent-review.md): Independent post-release audit of v0.2.0 on `argon/review/v0.2.0` for v0.2.1 incorporation — `AssetHandle.reload()` preemption and failure propagation during fallback retries, `ASSET_TIMEOUT` normalization before fallback commit, immediate `TilemapVisual` sprite texture swap on managed atlas reload, `Logger` deduplication of prototype-getter `Error`/`DOMException` fields, zero-duration looping `AudioBuffer` guard, and `Game.setFont()` Canvas UI re-render.

- [v0.2.0 resource and lifecycle integration](2026-11-10-v0.2.0-assets-audio-logger.md)

- [Independent v0.1.7 review and consumer CI recovery](2026-11-10-v0.1.7-independent-review.md)

- [Comprehensive code review, design audit and quality improvements — v0.1.7](2026-11-10-v0.1.7-quality-review.md): Full Core/Web source audit, `game.goTo()` → `game.changeScene()` API migration, queued scene transition and `onActivate` self-restart fixes, `TilemapLayer` / `GeometryTilemapLayer` visual reconciliation fixes, gamepad button binding deduplication, `CanvasVisual` zero-rect wheel guard, `Tilemap.worldToTile(-0, -0)` normalization, and full verification records.

### 2026-11-09

- [SDK candidate CI and registry acceptance](2026-11-09-ci-sdk-candidates.md)

### 2026-11-07

- [Documentation cleanup and CHANGELOG establishment](2026-11-07-docs-cleanup-and-changelog.md): Archived initial `SPEC.md` to `docs/archive/initial-spec.md`, created user-facing `CHANGELOG.md`, modernized `README.md`, generalized version numbers and release examples, updated `work-reports/README.md` index, and verified site builds on both `/Simpludify/` and `/` bases.

### 2026-11-06

- [Documentation site syntax highlighting and bilingual navigation separation](2026-11-06-site-improvements.md): Integrated Shiki-based build-time syntax highlighting (dual light/dark theme, copy button), bilingual navigation separation with isolated sidebars, fallback banners, and consolidated site validations into `site:check`.
- [Documentation reorganization, consolidation and direct docs site build](2026-11-06-docs-reorganization.md): Removed `CODEX-START.md`, reorganized documentation into `docs/ja/` and `docs/en/` mirrors, migrated site assets into `scripts/site-assets`, and verified direct documentation site build.

### 2026-11-05

- [Input bindings v0.1.6 final review and integration](2026-11-05-input-bindings-final-review-v0.1.6.md): Final integration review for physical input bindings, capture API, persistence schema, 891 unit tests, and 448 browser tests.

### 2026-11-04

- [Input bindings and single-input capture — v0.1.6](2026-11-04-input-bindings-v0.1.6.md): Implementation of physical keyboard/mouse/gamepad bindings, runtime rebinding, and single-input capture.
- [Virtual sticks and generic pointer input — v0.1.5](2026-11-04-virtual-input-v0.1.5.md): Implementation of `VirtualStick` (fixed, floating, follow), `VirtualButton`, multi-touch pointer routing, and interactive `virtual-input` lab.

### 2026-11-03

- [Unified input, gamepads and bilingual documentation — v0.1.4](2026-11-03-unified-input-v0.1.4.md): Implementation of `ActionController`, Gamepad API integration, local multiplayer source gating, and two-player lab.
- [Security audit integration](2026-11-03-security-integration.md): Integration of security hardening fixes (PR #14, 827 unit / 392 browser tests).
- [Security audit and input-validation hardening](2026-11-03-security-audit.md): Path traversal boundaries, input sanitization, and style injection prevention.

### 2026-11-02

- [Canvas screen consumer integration](2026-11-02-canvas-consumer-ui.md): Canvas UI accessibility (labels, headings, status live regions), numeric keyboard hints, and GPU pooling.
- [SDK consumer integration](2026-11-02-sdk-consumer-integration.md): Consumer patterns and adoption verification.
- [npm SDK documentation review](2026-11-02-sdk-docs-review.md): Documentation review for SDK distribution.

### 2026-11-01

- [Tile geometry and polygon rendering](2026-11-01-tilemap-geometry.md): Square, triangle, and axial hexagonal tilemap geometry.
- [Tilemap collision and rectangle search](2026-11-01-tilemap-collision.md): Terrain collision, Solid walls, and Trigger contacts through spatial indexing.
- [Tween and animation foundation](2026-11-01-tween-animation.md): Deterministic simulation Tweens, Scene clocks, Easing functions, and Actor/UI adapters.

### 2026-10-31

- [Hover, keyboard and focus](2026-10-31-ui-focus-input.md): Pointer hover routing, keyboard focus navigation, and active element styling.
- [Select and native text editing](2026-10-31-native-input.md): Canvas `Select`, `TextInput`, and native keyboard editing contracts.
- [Standard Canvas input controls](2026-10-31-canvas-controls.md): Canvas buttons, checkboxes, sliders, and panel layout.

### 2026-10-30

- [Canvas scroll input](2026-10-30-scroll-input.md): Scrollable viewports, inertia, and draggable overlay scrollbars.
- [Core modules and host-independent Canvas UI](2026-10-30-core-host-ui.md): Platform-independent scene graph and Canvas UI primitives.
