# Standard Canvas input controls

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
