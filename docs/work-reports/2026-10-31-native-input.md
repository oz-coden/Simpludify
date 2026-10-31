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

## TextInput checkpoint

- Shared text contract saved as [2901301](https://github.com/oz-coden/Simpludify/commit/29013011e210ce856ff2c0771a7afc5cf83b8004).
- Added CanvasTextInput with accepted values, immutable drafts/selection/composition, placeholder, validated native UTF-16 maxLength, program replacement, read-only/disabled cancellation, Enter/blur acceptance and Escape rollback. Native focused input supplies browser caret/selection/clipboard/grapheme handling; inactive text remains Canvas-painted.
- Host surfaces are bound to the Core control revision and replaced on program/options/read-only changes. Detached editor callbacks cannot begin sessions on another generation. Native pointer focus is synchronous; editor gestures are distinct from Canvas drags. Shared CanvasUI handles Tab/reveal; wheel input reaches existing Core scroll routing.
- Focused Core suites: **58 passed / 0 failed**. TypeScript passed. The new reentrant-change test was corrected to expect the existing EventBus recursive-delivery diagnostic while verifying program replacement wins and stale commit is suppressed; existing behavior/assertions were retained.
- Local Chromium installation failed after all download attempts (invalid/truncated ZIP). Browser caret/clipboard/IME adapter cases are not yet executed. NumberInput, browser regressions, sample/docs and full CI remain pending.

## NumberInput checkpoint

- TextInput implementation saved as [78a0998](https://github.com/oz-coden/Simpludify/commit/78a09987b1575356f153e4cad3714adf0cb78d7d).
- Added CanvasNumberInput using shared text editing and Slider's finite range/step normalization. Decimal/exponent parsing is locale-independent; empty/sign/dot/partial-exponent/nonfinite drafts remain editable but cancel on invalid commit. Arrow/Page keys step finite accepted values and do not interfere with composition.
- Dynamic range changes validate first and supersede drafts; native text presentation exposes spinbutton semantics. Slider/NumberInput can share state using onChange with equality guards before reflected program writes.
- TypeScript passed; focused suites **71 passed / 0 failed**. Added disposal cleanup aggregation and a single presentation-owned window/visibility interruption listener. These last lifecycle changes still need browser regression execution.
- Next: Settings lab, browser WebGL/Canvas2D desktop/narrow cases, docs, full checks/CI and review. Actual OS IME/physical soft keyboards remain unverified.

## Sample, documentation and browser regression checkpoint

- NumberInput implementation saved as [fb87b99](https://github.com/oz-coden/Simpludify/commit/fb87b991bec244f9d25756969baaaa5a0bd897c4).
- Settings lab now includes typed difficulty Select, player-name TextInput, synchronized numeric volume and existing Checkbox/Slider/Apply/Reset/read-only/scroll composition. Definitions import Core only; subscriptions are root-scoped. Existing exact snapshot assertions include the newly implemented settings.
- Added WebGL/Canvas2D × desktop/narrow browser cases for native options/keys, Unicode editing/caret/selection, real browser clipboard shortcuts, composition-event ordering, detached editor rejection, invalid number drafts/keys, native drag ownership/wheel/clipping and Scene cleanup. These are not OS IME tests; execution is pending candidate Actions.
- Complete local unit suite: **693 passed / 49 files / 0 failed**, 3.73s. Earlier sample snapshot expectation failed solely because it omitted the new fields; the expectation now checks those fields too. No existing regression assertion was removed. TypeScript compilation passes with new fixtures.
- Updated English editing guide, API, Host/architecture/roadmap, Japanese Canvas entry, sample README and site page title. The guide specifies accepted/draft semantics, typed options, native presentation, UTF-16/maxLength, locale-independent numbers, shared Slider values, Host migration and physical IME/mobile/AT limits.
- Save before full static/build/site/CI review. Local Chromium remains unavailable; exact-source Actions must pass before integration.

## Final review checkpoint before candidate CI

- Sample/docs/browser checkpoint: [8f89c3a](https://github.com/oz-coden/Simpludify/commit/8f89c3a2372aac46551a6752c84b57add78381a2), [CI 41181647839](https://github.com/oz-coden/Simpludify/actions/runs/41181647839). Quality identified three formatting/export-order errors in the new guide/index/exports; these are corrected. Production job succeeded; browser/site jobs are still running at this receipt. This intermediate run is not accepted as full success.
- `npm run check`: passed after those formatting corrections; baseline **12 warnings / 11 infos** unchanged. DOM-free Core, module/required-file/license checks passed with no new dependency.
- `npm test`: **695 passed / 49 files / 0 failed**, 3.47s. Added reentrant blur/focus redirection and observer-error cancellation tests. Text snapshot deduplication now compares fields directly rather than allocating JSON strings.
- `npm run build -- --target web`: passed. Project and root site build/check passed independently, each **62 HTML / 3972 references / 58 typed snippets**. Browser enumeration at the first sample checkpoint was 286 cases; an additional lifecycle/scale/dynamic-options case for both renderers/viewport projects is now included (execution pending).
- Final review examined Core/Host imports, accepted/draft semantics, finite range policy, revision-based program supersession, reentrant focus redirection, native element removal, listener ownership, pointer/editor versus parent scroll routing, composition boundaries and plain-language public documentation. No existing assertion/timeout/retry/GPU configuration was weakened. Remaining acceptance gate is exact-source full browser/site CI.
- Main is unchanged. No actual OS IME, physical mobile keyboard, other browser engine or AT compatibility is claimed. All three implemented factories remain conditional on successful final browser verification before merge.

## Initial browser execution evidence

- CI 41181647839 narrow shard 1 completed **73 passed / 0 failed**, including all ten new native input cases (Select, Unicode/native clipboard, composition/stale callbacks, numeric editing and editor drag/lifecycle) in both WebGL and Canvas2D. Production and both site-base jobs also passed. Other browser shards are still running; the run's quality formatting failure remains recorded.
- Added one more browser case per renderer/viewport for dynamic options, scaled native geometry, composing blur, window interruption and ancestor disable. Final candidate enumeration: **290 tests / 18 files**. This additional case is pending execution.
- Updated the Action typing recipe to use standard CanvasTextInput rather than requiring game code to create DOM fields. Custom text streams remain a Host responsibility.

## Native overlap review correction

- Candidate [1511c96](https://github.com/oz-coden/Simpludify/commit/1511c96fdcac64b991e88feb641c455266dc8df4) saved all prior review work. A final layering review found that native pointer targets could otherwise cover a later Canvas Button/scrollbar when unclipped children overlap siblings. The Host now subtracts later Canvas hit-surface rectangles from native clip/hit regions, with a real overlapping-input/Button regression for both renderers and viewport projects. This is a narrow native-presentation correction, not a window manager.
- Native pointer activation also stops UI momentum, matching Canvas gesture ownership. Native popup color/background follow live control styling; disabled/read-only text receives matching visual attenuation. Decorative non-hit Canvas paint is not promoted into a general native layering API.
- The new overlap fixture initially lacked three imports; TypeScript caught this before publishing and they are corrected. New runtime/test source must pass a fresh exact-source full CI. Candidate enumeration is now **294 tests / 18 files**; unit suite remains 695 cases.

- Overlap correction saved as [d1291bc](https://github.com/oz-coden/Simpludify/commit/d1291bcd45045308acd8d2917b87a22166e3b24c). Review additionally made presentation-wide interruption aggregate cleanup across all native fields, even if a cancellation observer throws, and routes abort-listener errors through the existing UI error observer. This preserves release guarantees without adding per-control global listeners.
