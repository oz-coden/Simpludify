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
