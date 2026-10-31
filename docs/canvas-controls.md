# Canvas input controls

`CanvasCheckbox` and `CanvasSlider` are portable Core UI nodes, reexported by Web. Their state, events, geometry and interaction meaning do not depend on DOM/Pixi. Web draws them in the game canvas and supplies scoped native focus/ARIA mirrors. **Select, NumberInput and TextInput are not implemented.** [Native editing design](text-input-design.md) records the remaining Host/IME work.

## Build a settings screen

```ts verify
import {
  CanvasButton,
  CanvasCheckbox,
  CanvasColumn,
  CanvasLabel,
  CanvasScroll,
  CanvasSlider,
  Game,
} from "@simpludify/web";
const sound = CanvasCheckbox("音声 / Sound", { checked: true });
const volume = CanvasSlider({
  label: "音量 / Volume",
  min: 0,
  max: 100,
  value: 50,
});
const status = CanvasLabel("Ready");
volume.onChange(({ value, source }) => status.setText(`${value}% (${source})`));
volume.onCommit(({ value }) => console.log("Volume gesture completed", value));
const root = CanvasColumn(
  [
    CanvasScroll([sound, volume], { height: 200, gap: 12 }),
    status,
    CanvasButton("Reset", () => {
      sound.checked = true;
      volume.value = 50;
    }),
  ],
  { padding: 16, gap: 12 },
);
const game = new Game();
game.canvasUI(root);
await game.run();
```

Canvas trail → **Settings lab** uses a [Core-only definition](../examples/canvas-ui/settings-screen.ts). It includes sound/grid settings, volume/speed sliders, a read-only toggle, preview, Apply snapshot, Reset and Back. User code does not create DOM elements or manipulate Pixi. Apply copies the current values; further editing does not mutate that applied snapshot. Reset restores draft defaults, not the previously applied snapshot. These are application decisions, not engine-wide storage/persistence policies.

## Value and event contract

Both return specialized `CanvasInputNode<T>` subclasses with the normal [CanvasNode](canvas-ui.md) tree/style/lifetime API plus:

| Member                    | Contract                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| value / setValue(value)   | Get or synchronously set a validated value. Program writes are allowed while disabled/read-only, notify only actual value changes, cancel pending pointer/key input even for equal writes, and never create a user commit.                                                        |
| readOnly                  | Boolean, default false. User changes are blocked; focus and program updates remain available. Changing it cancels pending input. `enabled = false` instead excludes input/focus through the existing availability contract.                                                       |
| editing                   | True only during a continuous pointer edit. Checkbox/keyboard changes are immediate one-shot operations.                                                                                                                                                                          |
| onChange(handler, owner?) | Typed `{node, previous, value, source}`. Sources are `program`, `pointer`, `keyboard`, `accessibility`. Values are already stored when synchronous handlers run. Equal normalized values emit nothing.                                                                            |
| onCommit(handler, owner?) | Typed `{node, previous, value, source}` after a changed, completed user operation. Checkbox activation and each effective slider key command commit once; slider pointer release commits once from the press's initial value. Program writes do not commit.                       |
| onCancel(handler, owner?) | Same edit-end shape when a continuous pointer edit is interrupted. `previous` is the value before its press; `value` is the current value. Source identifies the original pointer edit, including when interrupted by a program command. No commit follows that interrupted edit. |

Slider values change **immediately**, suitable for audio/preview controls. Cancellation retains the latest immediate value; it does not roll back application side effects. A zero-change pointer edit produces no commit; an interrupted edit still emits cancellation. An application needing form rollback must retain its own snapshot and restore it using program writes.

Subscriptions return an unsubscribe function and can name a LifetimeOwner. All use the existing synchronous EventBus rules: listeners run in registration order, errors are aggregated, asynchronous listeners and recursively emitting the same event token are rejected. Callback failures do not roll back stored values; cleanup continues. Disposal during delivery suppresses later work. Reentrant program commands supersede stale commits.

## Checkbox

`CanvasCheckbox(label, {checked?: boolean, readOnly?: boolean}, style?)` returns `CanvasCheckboxNode`. Defaults: checked false, readOnly false; `checked` is an alias of boolean `value`. `setText(label)` changes the visible/accessibility label. Invalid nonboolean values reject before mutation.

Primary pointer release inside toggles once; pointer cancellation, drag-to-scroll, outside release and secondary buttons do not toggle. Enter/Space toggle on the matched release; autorepeat does not add activations. Blur or a program/read-only change cancels pending keys. Accessibility activation toggles through the same Core operation. Read-only remains focusable with `aria-readonly`, while disabled/hidden ancestors use existing Canvas availability.

The renderer reserves 30 UI units (20-unit box plus gap) beside the label; text wraps within the remaining width. Defaults use padding 12 and minHeight 44. Standard styles, text updates and focus/hover/press drawing remain available.

## Slider

`CanvasSlider({label?, min?, max?, step?, value?, readOnly?}, style?)` returns `CanvasSliderNode`. Defaults: label `Value`, range 0–100, step 1, value min, readOnly false; width 260, maxWidth 100%, height 76, padding 12. The visible label includes the current value. It is a **horizontal** scalar control, not a numeric text editor.

`min`, `max`, `step` are read-only getters; `setRange({min?, max?, step?})` atomically validates the full range, cancels pending input and clamps/snaps the existing value. Values/range must be finite, min < max, step > 0, range span finite and span/step no greater than Number.MAX_SAFE_INTEGER. A step smaller than the span must produce a representable change at both endpoints. Value writes clamp to the endpoints and snap to the nearest step from min; both endpoints remain reachable even when max is not on that grid. Ordinary decimal roundoff is normalized; this is not arbitrary-precision arithmetic. Invalid commands leave range/value/input unchanged.

ArrowRight/Up increase by step; ArrowLeft/Down decrease by step; PageUp/Down use ten steps; Home/End select endpoints. These commands take priority over ancestor scrolling, while Tab retains existing focus traversal/reveal. Keyboard commands are consumed but do not change read-only controls. Gameplay Actions remain excluded while native controls own keyboard focus.

A primary pointer press updates the immediate value and begins editing. The shared Core track geometry maps subsequent x positions to the range, clamping outside it. One pointer owns a slider; separate sliders remain independent. Before directional intent is resolved, a movable ancestor can claim scrolling and cancel the slider. A horizontal movement reaching the control's `dragThreshold` locks slider ownership (default 8 Host screen units); later diagonal movement does not switch into scrolling. Vertical movement can transfer to a vertical ancestor. No slider inertia is launched. Touch uses the same routing/capture path.

Program/range/read-only changes, disabled/hidden ancestry, UI scale, removal, blur, Scene replacement or disposal release editing/ownership. Cancelled physical pointer IDs remain suppressed through release. Pointer state is not transferred into world clicks or a replacement Scene. Pointer cancellation keeps the last value, as described above.

`canvasSliderGeometry(node)` returns Core track/thumb bounds in UI units for Host painting/hit mapping; degenerate small bounds produce finite geometry and zero travel does not change values. Value/read-only changes invalidate paint/semantic state; value changes alone do not rerun Flex. Application callbacks that change labels/layout can independently require Flex work.

## Host and lifecycle

Core `CanvasControlPort` describes a discriminated immutable drawing snapshot, input revision, supported keys and synchronous key/pointer commands. Standard PointerRouting invokes it and owns gesture cancellation; content code normally uses only factories/value/events. Custom Hosts should reuse this routing, call `controlKey` before ancestor `scrollKey`, and supply pointer snapshots in Host coordinates. [Host contracts](host-boundary.md) cover capture, focus and scale.

Web reuses the existing pointer-transparent native button mirrors with `role=checkbox` / `role=slider`, ARIA checked/range/read-only values, disabled state and native Tab focus. They do not duplicate Canvas pointer hit testing. Exact text metrics use `canvasControlText(node)` and the checkbox's reserved label space; a custom Host must measure/paint the same content and decoration. UI units, Camera and DPR stay separate. There is no per-control RAF or value polling loop; unchanged presentations still skip synchronization.

Scene/UI disposal cancels active edits and releases events, routing ownership, native mirrors, text metrics and graphics through the existing lifetimes. These ARIA mappings are not a claim of verified physical screen-reader support. Chromium automation, Canvas2D/WebGL and physical mobile/IME validation are separate evidence categories; see the [work report](work-reports/2026-10-31-canvas-controls.md) for actual results.
