# Canvas hover, keyboard arbitration and focus traversal

## Baseline and recovery

- Baseline main: `72818a528a1d74ee78a1cc031595fbc81256275b`.
- Branch: `fix/canvas-hover-keyboard-focus-2026-10-31`.
- Baseline [main CI 41183510912](https://github.com/oz-coden/Simpludify/actions/runs/41183510912) passed 696 unit / 294 browser tests and Pages deployment. Previous input implementation: [PR #4](https://github.com/oz-coden/Simpludify/pull/4), [native editing report](2026-10-31-native-input.md).
- Contributor instructions, README, architecture/API, native input report/contracts, BrowserInput/BrowserPointer, CanvasVisual/CanvasNative, Core focus/tree/routing, DOM UI and Tile trail were inspected before changing APIs/lifecycle.

## Root causes and design

- CanvasVisual brightens every hovered painted node, including pointer-blocking noninteractive panels. PointerEnter/Leave routing is useful and must remain; paint needs its own auto/none/highlight policy, defaulting to interactive controls only.
- BrowserInput treats every button as an editable target, suppressing all game keys and clearing held input when focus enters one. Tile trail actually uses the engine's DOM buttons, not Canvas mirrors. Register engine-owned buttons as gameplay-compatible targets while retaining native editor/contenteditable/unmanaged-control isolation. UI-consumed activation/navigation keys win; unrelated game bindings continue. Keyup release must work regardless of its UI target.
- DOM buttons are currently disabled even for synchronous callbacks. Avoid that transient focus loss; pending tasks need duplicate-activation prevention without evicting an already focused engine button. Scene/disposal and genuine focus loss still release keys.
- CanvasVisual mirrors logical focus on every dirty paint. Mirror explicit logical target changes and focused-native replacement, not unrelated hover/value repaints. Pointer UI ownership must not force native focus away from an already focused gameplay-compatible button.
- Core focusNext already walks live tree declaration order depth-first, excludes noninteractive/hidden/disabled nodes, retains read-only controls and reveals scroll ancestors. Preserve this mechanism. Add consistent host-to-tree entry and browser-boundary exit; reorder native siblings without detaching the focused editor, preserving its selection/composition.
- Enter/Space activate buttons; control keys and ancestor scroll commands are consumed by focused UI; Tab navigates. Text/number/select native focus owns native editing/typeahead keys. Ending a text transaction does not itself move native focus; Tab to an engine button resumes unrelated gameplay keys without clicking the world. Editing entry clears held browser input, and autorepeat cannot restore a cleared hold.
- Real Windows/macOS Japanese IME and physical mobile keyboards are unavailable here and remain unverified. No Core DOM import, new UI framework, positive tabindex order, arbitrary key blacklist or forced post-click focus restoration is planned.

## Initial checkpoint

Investigation/design complete. Hover fix, input arbitration, focus improvements, behavioral/pixel regressions, actual Tile trail verification, docs, final CI/review, main integration and deployment/live verification remain pending. No new tests have been executed yet. Save each completed stage and report before long CI/browser work.

## Hover checkpoint

- Added validated CanvasStyle `hoverEffect: auto | none | highlight` (default auto) and shared Core `canvasHoverHighlight` presentation policy. Auto highlights interactive controls only; explicit highlight supports custom pointer panels. Pointer hit-testing and enter/leave delivery are unchanged; style mutation is paint-only.
- Two focused Core cases passed (default container/control policy, explicit opt-in/out, invalid values, unchanged layout count and nonfocusable containers). WebGL/Canvas2D pixel/event regressions are still pending. No browser success is claimed at this checkpoint.

## Keyboard arbitration checkpoint

Engine-managed DOM/Canvas buttons now consume activation keys while allowing unrelated accepted game bindings. Native editors/selects and unmanaged native buttons remain isolated. The common browser adapter clears its source on editor entry, composition, outside focus, window blur and hiding; capturing keyup always releases, and repeat cannot resurrect a cleared key. Pointer focus preserves an already focused compatible engine button. Synchronous DOM button actions no longer transiently disable their focused element; pending async DOM actions use guarded aria-disabled/busy semantics and leave the Tab order until settled.

Canvas native focus is mirrored only on a logical target change or native generation replacement, rather than on every hover/paint refresh. Browser host Tab enters the live declaration order; native/semantic Tab traverses Core order and leaves at boundaries. Reordering moves siblings around the active native element, preserving selection/composition identity. These changes are checkpointed before browser verification; full regression results are pending. TypeScript passed before the final focus changes; focused hover unit tests: 2 passed, 0 failed.

## Focus traversal and regression checkpoint

- Kept Core traversal unchanged after confirming its live depth-first declaration ordering, readonly semantics and scroll reveal. Added Core regressions for nested Row/Column/Panel, disabled/hidden ancestry, both boundaries, reverse traversal, move/add/remove/clear/recreation and scroll reveal in both directions. Focus-policy tests: **5 passed, 0 failed**. TypeScript passes after fixture typing corrections.
- Added real browser key/pointer/actor movement plus hover pixel regressions in a deterministic-frame fixture for WebGL/Canvas2D at desktop/narrow sizes. They cover Canvas Button/Checkbox/Slider/Scroll, DOM synchronous/pending actions, keyup interception, repeat after editing, text/number/select, simulated composition, Tab/scroll boundaries, active native selection during reorder, lifecycle/blur/hidden cleanup and no focus recapture on repaint. Added actual Tile trail movement across an engine DOM click; changed the old blanket button-isolation expectation to assert actual actor movement and release under the new contract. No tests were deleted or assertions weakened. Browser regressions have not executed yet.
- Local browser setup failed: `playwright install --with-deps chromium` cannot set package-manager groups/users in this environment; a separate browser-only install receives a truncated Chromium ZIP. No compatible existing Chromium is installed. Full browser/build/site smoke results must come from Actions; no OS IME/mobile support is inferred from simulated composition. New WebGL fixture uses the existing native/portable suite measured SwiftShader lifecycle budget; no existing timeout or polling deadline changed.

Checkpoints: [investigation 63faa66](https://github.com/oz-coden/Simpludify/commit/63faa66defc9703547ebcfa7874df606e6246b0f), [hover ef95f19](https://github.com/oz-coden/Simpludify/commit/ef95f197b6be8e3f3e71511d509f725d6df3b1e0), [keyboard 84768d8](https://github.com/oz-coden/Simpludify/commit/84768d8c422d8dfc3310b592e5a32cd6526026e5). Documentation, full local gates, Actions, final review, integration/deployment and public verification remain pending.

## Documentation and verification gate checkpoint

Updated English Canvas/API/Action/Host/native-editing contracts and Japanese Canvas/input/getting-started/DOM-UI guides. They define hover auto/none/highlight, declaration-order entry/exit, logical/native/pointer/game ownership, consumed keys, editor/IME isolation, repeat/keyup rules and async DOM busy focus semantics. Corrected stale Japanese statements that standard native fields were unimplemented. Tile trail's hint describes the shared button/gameplay behavior.

Main implementation files: Core canvas-node/control (validated paint policy only), Web ui-keyboard/input/pointer (shared event ownership), ui/style (DOM action focus/busy behavior), canvas-visual/native (focus synchronization, Tab entry, reorder, composing guards). Added headless policy and real browser fixtures/spec; updated existing game/Tile trail behavioral regressions. No new runtime dependencies or Core host imports. The intentional compatibility change is that engine-owned buttons now allow unrelated gameplay bindings; unmanaged native buttons remain isolated. Async DOM buttons retain current focus with aria-disabled rather than transient HTML disabled; activation is guarded and pending buttons are excluded from subsequent Tab stops. Applications should treat aria-busy/disabled as the pending DOM action state.

Pre-final gates: `npx tsc --noEmit` passed; focused policy suite **5/5**. Full check/unit/build/site and Actions browser/production/site smoke are about to execute. Chromium installation failures above remain environment failures, not passing browser checks. Runtime changes are not yet integrated into main.

## First full verification results and fixture correction

Local `npm run check` passed (existing informational/warning diagnostics retained), `npm test`: **701 passed / 0 failed** across 50 files; Web build and site build/check at both `/Simpludify/` and `/` passed (62 HTML documents, 3981 references, 58 standalone examples each). Browser discovery enumerates 314 cases. Headless-shell-only download also fails with the truncated ZIP; no local browser execution is claimed.

[Actions 41203618373](https://github.com/oz-coden/Simpludify/actions/runs/41203618373): quality, production (default/Signal Run/Canvas trail smoke) and both site smoke jobs passed. Narrow shard 1 passed; narrow shard 2 passed 64 existing cases including the real Tile trail movement-across-click assertions in WebGL/Canvas2D, but failed all 10 new cases at their setup renderer-type comparison (numeric Pixi enum versus expected enum name). Corrected the fixture to use the same `RendererType[renderer.type]` representation as existing fixtures. Retained renderer assertions and strengthened consumed-key checks to include Action pressCount so short down/up leakage cannot hide behind released state. Full corrected browser execution remains pending. Earlier checkpoint run 41203395683 quality failed solely on report-index Markdown formatting, corrected before the successful quality run above; superseded checkpoint runs were cancelled by existing CI concurrency.

The first renderer-name correction referenced the PixiRenderer wrapper's nonexistent public type field; local TypeScript caught that follow-up error. Corrected it to map the numeric type from the existing test-only resource inspector instead, and reran TypeScript successfully before the next checkpoint. No engine behavior or renderer assertion was relaxed.

## Final review follow-up: deliberate world focus

Review found that preserving compatible button focus on _every_ routed down would also keep UI Enter/Space ownership after an intentional world click. BrowserPointer now uses the existing Core down return target: Canvas UI gestures preserve compatible focus, while an actual world gesture selects the host, retaining unrelated held browser keys. This is explicit user-directed world selection, not a forced focus return after UI activation. Added real pointer/held-W/full-Space-Action assertions plus engine DOM Enter/Space activation with zero duplicate Action presses. TypeScript passed. Docs distinguish this case. The corrected fixture run was still in progress at this checkpoint; complete final CI is required on the final runtime revision.

## Final review follow-up: focused asynchronous Canvas action

The full pre-busy revision [ba14fb0 / Actions 41204457880](https://github.com/oz-coden/Simpludify/actions/runs/41204457880) passed quality, production, both site bases, both narrow browser shards and desktop shard 2; desktop shard 1 was still running when this follow-up was found. Review identified another lifecycle edge: a previously keyboard-focused Canvas Button can become busy after pointer activation, and native disabled would blur to the page and clear W. Keep Core's existing busy-is-unavailable/focus/Tab contract; Web hands focus to the game host **before** disabling that focused busy mirror. This is a specific unavailability handoff, not a blanket return after every UI click. Other UI focus continues to accept unrelated keys, native editors remain isolated, and settling never recaptures focus. A new focused Canvas async pointer/held-W/settle/release assertion joins the existing DOM async case. Documentation also states this distinction and the custom Host hover-paint migration. TypeScript passed; no timeout was extended. Full CI is required again on this final follow-up.

## Integration instruction and active final gate

The user explicitly authorized direct main push without a PR if validation finds no problems (2026-10-31 JST). The plan is now a normal history-preserving fast-forward to main after successful final branch CI, then main CI, Pages deployment and live sample/docs verification. No PR is required; no force-push, history rewrite or protection bypass is authorized. Main was still the baseline 72818a5 at the last read. Final runtime checkpoint: [df665b5](https://github.com/oz-coden/Simpludify/commit/df665b511c1821c15c6ba15f5b3ea03758592df7), [active final Actions 41205060334](https://github.com/oz-coden/Simpludify/actions/runs/41205060334). This documentation-only checkpoint preserves that instruction without cancelling the runtime validation. The final source includes the explicit-world and focused-async-Canvas assertions; complete results and integration/deployment remain pending.
