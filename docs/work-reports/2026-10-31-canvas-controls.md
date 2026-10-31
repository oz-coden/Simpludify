# Standard Canvas input controls

## Accepted candidate — 2026-10-31 15:52 JST

Candidate source: [fce8896](https://github.com/oz-coden/Simpludify/commit/fce8896c6d51621f4d43cbd6463126d5484c97ab). Checkbox, Slider, value/input foundation, portable settings sample, docs and regression fixtures are implemented. Local checks passed: **658 unit tests / 48 files**, Core/Host/type/license checks, both site bases **62 HTML / 3968 references / 56 typed snippets**. Full [CI 41177814782](https://github.com/oz-coden/Simpludify/actions/runs/41177814782) completed successfully: **266 browser tests / 17 files**, quality, production and both site bases passed. The earlier pixel-sampling failure below is not hidden or treated as success. Final review accepts this scope for integration through [PR #3](https://github.com/oz-coden/Simpludify/pull/3); main CI/deployment/live verification are pending. Select, NumberInput, TextInput/IME and physical-device/assistive-technology validation remain deferred, with no unfinished factories exported.

## Baseline and scope

Phase A is complete, including live sample/document verification. Start: main `495216b55809eb1e9146a224aea72bc0d0fbc7cc`. Dedicated branch: `feat/canvas-controls-2026-10-31`. No Phase B implementation is added to the scroll branch.

## Investigation and decisions

- CanvasNode owns tree/style/enablement/lifetime and one EventBus; CanvasUI owns layout/focus/reveal. PointerRouting owns capture semantics and scroll arbitration; Web CanvasVisual owns exact text metrics, Pixi objects and native focus mirrors. Reuse these instead of introducing a second UI/input tree.
- First completed target is Checkbox and horizontal Slider. A small value-node base supplies typed value/change/commit/cancel subscriptions and read-only state; Button/HoldButton/Scroll do not inherit it.
- Program updates notify changes but do not represent user commits. Read-only blocks user editing, while program updates remain allowed. Slider changes are immediate (e.g. audio volume); cancellation retains the last value and emits cancellation, without a commit or implicit rollback. Applying/reverting a complete settings form belongs to the sample/application.
- Continuous pointer editing has one owner. An initially pending slider press can transfer to vertical scrolling; a horizontal slider drag locks to the slider. Existing scroll ancestry/threshold/physical-release suppression is reused. Range/program/read-only changes invalidate active editing. No polling or per-control frame loop is added.
- Core defines value/input/draw semantics and geometry; Web bridges keys, semantic ARIA state and Pixi paint. No DOM/Pixi/Core host dependency or new runtime package is planned.
- Select/NumberInput/TextInput share future focus/edit needs but are not exposed prematurely. Text/IME design will specify native Host editing/selection/composition/clipboard/soft-keyboard ownership and cleanup; actual Japanese IME cannot be certified by synthetic events. This checkpoint contains design only, not completed controls or IME support.

## Checkpoints and validation

- Initial checkpoint before implementation. Existing baseline CI: 622 unit / 254 browser tests and Pages deployment passed (Phase A report).
- Main site rebuild at dd2eb0e and live guide/sample comparison passed during Phase A closure. No Phase B tests have run yet.
- Next: implement value semantics and two controls, Core routing/geometry, Web paint/semantics, portable settings screen, unit/browser regressions, docs and review. Save checkpoints before long test/CI sessions. Main integration is conditional on successful verification.

## Core/Host implementation checkpoint

- Added a narrow CanvasControlPort (draw model, key/pointer commands, revision) and CanvasInputNode value subscriptions. Checkbox and horizontal Slider are now implemented in Core; Web paints their data and mirrors checkbox/range ARIA state through the existing semantic button lifecycle. Slider uses shared Core geometry for paint/hits.
- Program/range/read-only commands invalidate pending pointer/key input; cancellation retains immediate values without a commit. Horizontal slider intent locks its owner; vertical scrolling can cancel a pending slider interaction. Independent sliders use distinct pointer owners. Existing Button/HoldButton routing remains.
- TypeScript compilation passed for the first connected implementation. Full check/unit/browser verification and the settings sample are still pending; this is not a completion claim. Save this source before running regressions.

## Settings screen and Core regression checkpoint

- Added Core-only `settings-screen.ts`: bilingual sound/grid checkboxes, volume/speed sliders, read-only toggle, separate Apply snapshot, Reset and Back, within a scroll viewport. Canvas trail exposes Settings lab; application definitions use no DOM/Pixi APIs.
- Added 30 passing Core tests covering program/user value semantics, decimal ranges, invalid configuration, input ownership, multiple controls/pointers, scroll transfer, focus, paint-only value changes, disabled/read-only/hidden/scale/removal commands, callback errors and Scene disposal. Focused command: `npx vitest run tests/unit/canvas-controls.test.ts` (30/30, 681ms).
- Pinned local browser download failed again. Real browser verification will use GitHub Actions. No browser/IME/physical-device success is claimed yet. Full check/regression tests and actual sample validation remain required.

## Browser regression and documentation checkpoint

- Full local unit suite at bb3bd34: **652 passed / 48 files**, 4.39s. Static check caught the settings snapshot's inferred literal type; corrected it to an explicit typed snapshot. Subsequent TypeScript compilation including new browser fixtures passed. Added a pending-checkbox program/read-only cancellation regression and corrected revision pruning to cover one-shot controls as well as sliders.
- Added permanent WebGL/Canvas2D browser cases (desktop/narrow): native key/focus/ARIA/pixel output, mouse horizontal ownership, real CDP touch vertical transfer, Apply/Reset/read-only/range/style updates and Scene cleanup. They share the actual portable settings definition. Browser execution is pending Actions; local pinned Chromium download failed.
- Added official control API guide, Japanese entry point, native editing/IME design (explicitly future), Host/architecture/API/roadmap/sample links. No unfinished TextInput/NumberInput/Select factories are exported. New docs state all event/cancellation/range/default/lifetime semantics and physical validation limits.
- Save this checkpoint before full checks/site builds and CI. Main integration/publication is still pending successful browser and final review results.

## Review and WebGL readback correction

- Local fe1e98b checks passed: **653 unit tests / 48 files**, static/Core-boundary/license checks (unchanged 12 warnings / 11 infos), default production compilation, project site **62 HTML / 3967 references / 56 typed snippets**. CI [41177449987](https://github.com/oz-coden/Simpludify/actions/runs/41177449987) passed quality, production, both site paths and narrow shard 2, but narrow shard 1 failed the new WebGL slider pixel comparison (both samples `[0,0,0]`). All three new Canvas2D/narrow cases and the WebGL pointer/lifecycle cases in that job passed; the run is not accepted as full success.
- Pixel samples were taken in browser tasks after a previous render/protocol round trip. The new fixture now renders and reads its WebGL back buffer in the same task, matching the existing permanent scroll pixel fixture. Original pixel difference checks remain and now additionally require a bright filled track and a visible checkbox-mark contrast. This corrects a sampling hazard; no engine/driver performance fix is claimed. Exact-source rerun must verify it.
- Review added invalid-command-during-edit and reentrant program-replacement tests, headless Apply snapshot/lifetime coverage, and large finite keyboard endpoints. Range validation rejects steps that cannot change either endpoint at floating-point precision. Focused suite is now **36/36** (421ms). Browser and full final-source results remain pending.
- The initial implementation CI 41176849664 was superseded/cancelled by the next checkpoint; intermediate 41177043404 included the settings snapshot type error and was superseded. Keep their history as intermediate evidence, not final verification.

## Final-source local verification

- `npm run check`: passed; baseline 12 warnings / 11 infos unchanged, DOM-free Core/module directions/license checks passed.
- `npm test`: **658 passed / 48 files**, 4.34s; focused value/control suite **36 passed**. No assertions, retries, existing timeouts or GPU flags were weakened.
- `npm run site:build -- --base /` + `npm run site:check`: passed. Independent project-base build/check also passed: **62 HTML / 3968 references / 56 typed snippets** for each base. `npm run build -- --target web` compiled successfully at the previous code checkpoint; candidate site builds compile all nine samples including Settings lab. Production smoke is passing in candidate Actions.
- `npx playwright test --list`: **266 tests / 17 files**. Local pinned browser install failed, so enumeration is not execution. Exact-source Actions results are required. Candidate CI: https://github.com/oz-coden/Simpludify/actions/runs/41177814782 .
- Changed code: Core `ui/canvas-control.ts`, `ui/canvas-input.ts`, `ui/canvas-node.ts`, routing and exports; Web `canvas-visual.ts`; portable settings definition/entry; unit/browser fixtures. Docs: control/IME design guides, Japanese entry, API/Host/architecture/roadmap/sample/README and site routes. Existing UI tree, lifetime, focus, input systems and renderer resource accounting are reused. No new package/dependency, native target or separate input frame chain.
- Public API additions are CanvasCheckbox/CanvasCheckboxNode, CanvasSlider/CanvasSliderNode, CanvasInputNode value/event contracts and portable control model/geometry. Existing APIs remain source-compatible; custom Hosts need the new control paint/measure/semantic/key mappings before claiming Checkbox/Slider support.

## Accepted full CI and final review

- Exact source [fce8896](https://github.com/oz-coden/Simpludify/commit/fce8896c6d51621f4d43cbd6463126d5484c97ab) passed full [CI 41177814782](https://github.com/oz-coden/Simpludify/actions/runs/41177814782). Desktop **69+64**, narrow **69+64**: **266 passed / 0 failed**; all 12 new control/renderer/viewport cases passed, including strengthened checkbox/slider pixels. Quality, both site bases and production smoke passed. The previous zero-buffer pixel result is resolved by synchronous fixture readback, not by an engine/driver performance change.
- [PR #3](https://github.com/oz-coden/Simpludify/pull/3) is conflict-free against main `495216b`. Later report commits change no runtime/sample/test/site/API sources. Final review covered Core-only imports, value/range validation, one-shot and continuous cancellation, key/pointer supersession, nested scrolling, read-only/disabled focus, paint-only updates, renderer resource ownership and Scene disposal. No blocking defect found in completed Checkbox/Slider scope.
- Existing Action/Button/HoldButton/Scroll suites remain part of the passing full regression. No normal CI workflow, launch flags, retries or existing test timeouts were changed. New WebGL fixtures reuse the previously measured 60s setup budget; Canvas2D retains the default budget.
- Integration is permitted for the completed two controls and foundation only. Select, NumberInput, TextInput/native IME bridge remain unimplemented and documented as future work. No physical touch/other browser/OS IME/assistive-technology certification or new GPU performance claim.
- This acceptance receipt is saved before merge. Record the merge SHA, exact main CI/deployment and live Settings lab/docs comparison after integration.
