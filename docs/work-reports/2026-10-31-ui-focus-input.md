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
