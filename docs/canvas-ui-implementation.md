# Canvas UI implementation record

Work starts from `89491c638e070c575fcee89cb08635fbaac67f01` on `codex/working-collision`; remote head matched the requested SHA. `main` starts at `8b6babe9157c0dbb2ceb288afc8a4595ed8535dd`. All work is checkpointed to `codex/working-canvas-ui`. Main integration requires the final validation gates below.

## Existing contracts and adopted direction

- Core remains DOM-free. Engine captures all ActionControllers before dispatch, including paused steps. Buttons retain ordered short taps; axes combine independent sources. Reset is silent and clears contributions; Scene replacement clears input. Preserve these contracts and the existing physical-code/IME/native-control exclusion.
- ActionController already handles keyboard rebinding, typed dimensions, independent sources, cross-Engine ownership and staged Scene isolation. Do not replace it. Web `context.actions(definitions, bindings?)` supplies that factory's Scene and Game input explicitly; `game.actions` supplies the current Scene. The Core constructor stays available for headless code.
- Existing DOM Panel/Label/Button/HoldButton keep their native layout, text editing and focus behavior. Canvas widgets use explicitly prefixed names, not duplicate implicit modes of those functions.
- Canvas UI is Web presentation, not a set of simulation Actors. One Scene-owned tree is staged and committed with the Scene; Pixi draws it above the world in host CSS coordinates divided by an independent UI scale. Camera/DPR do not change UI layout units.
- A bounded Flex subset is planned: row/column, gap/padding, numeric/percentage sizes, grow/shrink, align/justify, explicit wrap and clipping. No CSS parser, absolute layout, grid, intrinsic percentage cycles or CSS-wide claim. Yoga remains a comparison candidate; measure current bundled size before selecting.
- Pointer events have one DOM capture-phase router per Game. UI hit testing follows visible paint order and clipping. Ownership is fixed on down through up/cancel; no Pixi federated interaction is used for these widgets. Empty UI space routes to a Scene-scoped world event bus. Capture, blur, hidden state, disable and disposal must release holds.
- Native invisible semantic buttons supplement the rendered buttons for Tab/Enter/Space and accessible names. They do not duplicate pointer hit testing. Canvas text is not a full document accessibility tree or text editor.

## Validation gates (pending)

Retain Actor/Sprite/Tilemap/Collision regressions; strict types/DOM-free boundary/lint/licenses; focused Action/UI/layout/router tests; real WebGL and forced Canvas2D mouse, CDP touch and keyboard at desktop/narrow sizes; high DPI, Scene preparation/failure/disposal, pointer capture and overlapping input; production builds/site both bases; recorded layout/input/bundle/memory observations. Do not report completion or advance main before all gates pass.

## External design references

[Pixi events](https://pixijs.com/8.x/guides/components/events) distinguishes none/passive/static interaction. Disable UI subtree interaction to avoid a second path. [Pointer Events](https://www.w3.org/TR/pointerevents3/) defines capture/cancel and touch-action; native event order must be verified with real browser input. [Yoga](https://www.yogalayout.dev/docs/about-yoga) is a box layout system, not rendering or input; adding it would not replace tree ownership or routing.

## Routing/presentation checkpoint

The Scene-owned model, dirty Flex subset, Pixi screen presentation, semantic button mirror and DOM capture-phase router are implemented. 534 unit tests and strict TypeScript pass at this checkpoint; real-browser validation is still pending. Twenty-five new model/routing cases cover fixed ownership, multi-pointer/keyboard holds, cancellation, native Action frame semantics, nested wrapping, clipped hits and disposal. The current custom Flex subset has no runtime dependency; library/bundle/performance comparison remains pending.

## Browser findings and corrections

- DOM capture-phase window blur also observes descendant blur. Restrict release to `event.target === window`; ordinary native/game focus movement must not cancel an unrelated gesture.
- Canvas pointer controls keep game focus, permitting physical keyboard and logical touch sources to compose. Tab explicitly enters the native semantic controls, where Enter/Space belong to UI. Keyup without a corresponding button keydown cannot activate a button.
- Canceled/disposed/disabled gesture IDs remain suppressed until physical up/cancel (or a new down). Scene replacement must not transfer an already-started operation into the new world. Terminal Game disposal clears those IDs.
- Avoid per-node full-screen stencil masks when no explicit ancestor clip exists; the canvas already clips its bounds. Cache resolved visual signatures and only replace text styles when font/color change. The initial cold SwiftShader run exceeded the original test timeout while redundant redraws were present; after these changes all 12 desktop cases pass. Idle rendering is exercised for three real frames, with 100 no-layout calls covered by the model test, rather than issuing 30 unnecessary GPU draws inside one synchronous evaluate.
- Narrow-screen Fit letterbox coordinates are not world hit points. Tests derive world drag starts from the current view clip, retaining the same UI/world ownership assertions.

Canvas keyboard/AT support is a button mirror, not complete screen-reader document semantics. Flex is a documented subset rather than a CSS layout implementation. Broader browser, performance and final regression gates remain pending at this checkpoint.

## Expanded contract/measurement checkpoint

The real clipped-pixel test exposed an additional WebGL-only defect: setting a stencil Graphics `renderable=false` excluded it from `StencilMaskPipe.collectRenderables`, while Canvas2D still used its shape. A clipped mask now remains renderable, with Pixi controlling `includeInBuild`; an unused mask is nonrenderable. All four clipped-pixel cases pass, with no relaxed pixel expectations. Nested wrapped descendants also remeasure auto cross size after grow/shrink allocation. Layout diagnostics distinguish arranged nodes, intrinsic helper visits and constrained helper visits; arrange counts alone must not be described as all layout work.

Supported English/Japanese API docs, type fixtures, gallery navigation and reproducible model/browser/bundle harnesses are saved before recording performance. Current model/router unit cases: 28 passed. The expanded 36-case browser suite and production/site validation remain in progress. Yoga 3.2.1 is fetched only for isolated comparison; no dependency or lockfile change is adopted.

## Owned Pixi resource correction

Initial browser heap growth led to a concrete ownership bug: in Pixi8 Graphics.destroy, an options object containing only `children:true` does not destroy its owned GraphicsContext. UI entry teardown now explicitly destroys its private background/mask contexts and private Text styles before the container. Invisible empty backgrounds are not submitted as Graphics. Four new real-browser repeated-Scene tests inspect live managed Pixi contexts/texts/textures, separately from null hash slots, and pass on both renderers/sizes. The browser benchmark now clears the preceding host and asserts all 240 deliveries and 240 UI hit tests for each 30-gesture workload; revised timing/heap results remain pending until remeasurement.

Custom fonts must be ready before constructing the Canvas tree. The host uses native font loading in async Scene setup; there is no automatic web-font cache manager. Paint-only style patches skip Flex. Dynamic native button order follows the current visual tree without moving already correctly ordered focused controls.

A second measured browser run confirmed the context fix and exposed Pixi8.22 CanvasGraphicsPipe's separate destroyed-renderable hash retention. The Web renderer now drops only its own destroyed UI Graphics from that exact pinned hash after normal destruction. This small compatibility path is isolated and covered by real Canvas2D resource inspections; dependency upgrades must rerun those tests. Pointer release flushes dirty layout before click eligibility. Dynamic native button ordering, overlapping DOM hover priority, inherited disable painting and paint-only style invalidation are also covered. Focused resource/layout-release tests: 16 passed; focused DOM/Tab cases: 8 passed. Final full regression and post-fix measurements remain pending.

## Text metadata and current-scene activation

The third browser report (`browser-graphics-fix.json`, source `f5e2eca`) verifies no retained UI Graphics/Text/Texture objects after Scene round trips. It also exposes UID-keyed null text bookkeeping: 3000 text/texture slots after thirty scenes despite zero live entries. UI-owned resources now remove their exact null hash slots after destruction, and a renderer-local pending-key set prunes only replaced UI text keys after Pixi releases them during rendering. DPR changes register the previous UI text keys before resolution changes. No live texture, global cache, other renderer's resource or shared image is purged. New actual browser tests verify fifty HUD changes and DPR1→3→2 leave only the three live UI text/texture slots; all eight focused resource/text cases pass. A pinned-Pixi compatibility helper isolates these details for future upgrades.

Scene resets in Canvas trail now run on activation, keeping the old Scene's pause/camera state intact during candidate preparation. Async hold callbacks are diagnosed (matching synchronous input/event semantics); one-shot async Button tasks keep their AbortSignal. Thirty model/router cases pass. Full final runs and post-metadata-cleanup measurements are the remaining gates.

The post-text-cleanup report (`browser-text-fix.json`, `fe5603b`) confirms zero UI text/texture slots at every sampled empty Scene, not just zero live objects. Short-run used-heap changes are about +0.16MiB WebGL/+0.20MiB Canvas2D over thirty round trips; this is not a native/GPU or long-soak guarantee. Subsequent local corrections reject a canceled keyboard button release even if the node is re-enabled before the next frame, and clear default-presentation handles/owned callbacks when no longer needed. The Canvas trail Scene resets occur on activation. Final measurement includes explicit Scene creation/removal times in addition to full Game teardown.

## Final measurement checkpoint

All final measurement reports now use clean runtime `94065a6f5ccaa66d488df08c2e61e6d4f60b9307`. Model, browser, Scene-transition, live-resource/metadata and matched bundle/Yoga reports are saved in `benchmarks/canvas-ui/`; investigation runs remain separately named. The supported performance page replaces preliminary findings with explicit scope/limits. Actual TypeScript IDE completions are checked by `scripts/check-ui-completions.mjs` (Action names, style properties, align literals and pointer fields). No runtime change is introduced in this checkpoint. Final all-engine tests, production builds/site and main history/ref gates follow.

## All-engine validation checkpoint

539 unit tests in 40 files pass. Strict TypeScript/DOM-free Core, architecture/required-file boundaries and license checks pass (116 locked dependencies). Biome reports only the existing 12 warnings/11 infos after formatting the new Markdown/JSON; parsed benchmark values were checked unchanged before/after formatting. UI, Collision/SpriteSheet and SpriteAnimation completion probes pass against the actual pinned TypeScript API. The full zero-retry Chromium regression is in progress; production/site and integration gates remain pending.

Full regression now passes: **230 Chromium cases, retries 0, 5.4 minutes**, including 52 Canvas cases and every existing Action/DOM UI/Sprite/Tilemap/Collision/game fixture. Standalone default UI/scenes and Canvas trail production builds/smokes pass under /Simpludify/ at 1440×900 and 390×844. The production smoke helper now exercises Canvas start, actual colored button pixels, WASD wall stop, pause/resume and Scene recreation. Remote main and all four baseline development refs still match the initial SHAs. Site both-base validation and final ref integration remain pending. The bundle harness is being aligned to CLI's default Vite target rather than the earlier explicit esnext setting; no runtime code changes.

## Production site checkpoint and environment recovery

The project-base production site validation also passed locally at source `4c9460470674e6ed18dc9fcbd688e2f0a054510d`: `site:build -- --base /Simpludify/`, `site:check` (57 HTML files, 3321 local links/assets, 52 independently typechecked TypeScript snippets), and `test:site` (all nine samples at desktop/narrow sizes, actual Canvas trail pixels/movement/collision/pause/Scene recreation and forced Canvas2D). No runtime changes followed the recorded 539-unit/230-browser result.

The local execution environment disconnected before root-base validation and before the CLI-default bundle report could be copied from /tmp. GitHub holds every implementation commit. Main has not been advanced. CI now validates both project and root site bases as independent non-deploying jobs, so the remaining gate can complete without the temporary environment. Final integration is still conditional on their results and all-engine CI. Existing Pages deployment configuration is unchanged.
