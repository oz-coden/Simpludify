# Canvas Select and native text editing

## Baseline and recovery

- Baseline main: `c7a3fbc18e340470e422acc43a662e3de900c0a8` (previous controls merge `ff39721`).
- Work branch: `feat/canvas-native-input-2026-10-31`.
- Baseline [CI 41178455505](https://github.com/oz-coden/Simpludify/actions/runs/41178455505) succeeded with 658 unit / 266 browser tests and Pages deployment. No new verification has run at this checkpoint.
- Read contributor instructions, architecture/API, existing controls, scrolling/focus/routing, native keyboard mirrors, browser gameplay exclusion and `text-input-design.md` before implementation.

## Design decisions

- Reuse CanvasInputNode values/events, CanvasUI focus/traversal/reveal, existing pointer routing and Host presentation lifetime. Core must remain DOM/Pixi-free.
- Select uses typed copied options with separate labels and values. A native Host single-choice element supplies browser/OS popup, scrolling, disabled options and viewport placement, escaping Canvas ancestor masks. No custom window manager. Core owns accepted value and cancellable selection sessions; Host owns native popup UI. Exact popup keyboard conventions remain platform-specific.
- A narrow, generation-checked native editing port will carry full draft/UTF-16 selection/composition snapshots, never physical-key text reconstruction. Native editors own caret/selection/clipboard/grapheme movement and IME painting; Pixi paints inactive text and the control background. One editor must never paint over a second independent Canvas caret.
- Accepted values and drafts are separate: text and number publish accepted changes on valid commit; intermediate/composing drafts have their own typed notification. Escape cancels a draft; blur commits a noncomposing valid draft, while composition/lifecycle/program supersession cancels. Program commands invalidate sessions even for equal writes.
- NumberInput reuses finite Slider range/step normalization and the same native text session, preserving incomplete numeric drafts until commit. Invalid numeric commit restores accepted text and sends cancellation; no NaN/Infinity state.
- Native activation is synchronous from the actual native pointer target. Text-selection gestures belong to the editor, while wheel scrolling and existing Canvas/Slider gestures retain the shared route. Native bounds/clip/typography follow UI geometry and scale.
- Tests will distinguish actual browser editing from synthetic composition and unverified OS IME/mobile behavior. Windows/macOS Japanese IME and physical mobile keyboards are unavailable here and will not be claimed verified.

## Progress and remaining work

Initial investigation/design complete. Select, text session, TextInput, NumberInput, sample/docs, regression tests, review, PR/main integration and Pages verification remain pending. No unfinished factory has been added.

## Select checkpoint

- Implemented copied typed options, label/value separation, program/options replacement, disabled options, read-only, accepted change/commit/cancel transactions and stale-session rejection. Empty options have undefined value; missing values fall back predictably; duplicate values are rejected.
- Added a narrow native session/port shape and native single-choice Host presentation. Native browser/OS popup handles option scrolling, edge placement and escape from Canvas clips. Existing CanvasUI traversal/blur and CanvasInputNode events are reused.
- Focused Core verification: **46 passed / 0 failed** across new Select cases and existing control cases. TypeScript passes after correcting the test Scene fixture to provide its required ID. Browser execution is pending; local pinned Chromium download returns a truncated/non-ZIP archive. No native popup or IME certification yet.
- Shell git push cannot authenticate; checkpoints use the connected GitHub tree/commit/ref API with normal fast-forward updates and expected-head checks. Initial remote design commit: [5678c02](https://github.com/oz-coden/Simpludify/commit/5678c029075f60b2dd0ba9ab99de9df53f2617cb).
- Next: harden Host generation replacement, implement native text snapshots/drafts and TextInput/NumberInput, add browser regressions and sample/docs.

## Native text contract checkpoint

- Select implementation saved remotely as [da83240](https://github.com/oz-coden/Simpludify/commit/da8324039bd392dc80605aceb318fd1e5332706d).
- Added a shared Core text editor abstraction carrying immutable single-line draft/UTF-16 selection/direction/composition snapshots and typed draft notifications. Accepted values remain separate; sessions have monotonic identities, generation/availability checks, explicit commit/cancel, blur policy and disposal invalidation.
- Existing value foundation now retains the actual activation source for edit-end events. Slider's immediate-value behavior remains unchanged. Numeric range normalization was named/exported for reuse; DOM-free compilation and all existing focused control cases still pass.
- TypeScript compilation passed for this contract checkpoint. Concrete TextInput/NumberInput and Web text adapter/tests remain pending. Actual OS IME is unverified.
