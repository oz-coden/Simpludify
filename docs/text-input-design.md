# Native Canvas selection and text editing

Core/Web export `CanvasSelect`, `CanvasTextInput` and `CanvasNumberInput`. Game code builds ordinary Canvas nodes; the Web Host owns native selection popups and focused text editors. Core imports no DOM, browser IME or Pixi API. This is a single-line editing foundation, not a rich-text editor. Browser automation and synthetic composition tests do **not** establish Windows/macOS Japanese IME or physical mobile keyboard compatibility.

## Create controls

```ts verify
import {
  CanvasColumn,
  CanvasNumberInput,
  CanvasSelect,
  CanvasTextInput,
  Game,
} from "@simpludify/web";
const difficulty = CanvasSelect(
  [
    { label: "やさしい", value: "easy" },
    { label: "普通", value: "normal" },
    { label: "難しい", value: "hard", disabled: true },
  ],
  { label: "Difficulty", value: "normal" },
);
const name = CanvasTextInput({
  label: "Player name",
  value: "Player",
  placeholder: "名前を入力",
  maxLength: 40,
});
const count = CanvasNumberInput({
  label: "Count",
  value: 3,
  min: -10,
  max: 10,
  step: 0.5,
});
name.onDraftChange(({ draft }) => console.log(draft.text, draft.composing));
name.onChange(({ value, source }) => console.log("Accepted", value, source));
name.onCommit(({ value }) => console.log("Committed", value));
name.onCancel(({ value }) => console.log("Retained", value));
const game = new Game();
game.canvasUI(
  CanvasColumn([difficulty, name, count], { gap: 12, padding: 16 }),
);
await game.run();
```

`label` names Select/text/number controls for accessibility; use CanvasLabel beside them for visible form captions, as Settings lab does. All factories accept a final CanvasStyle argument and return CanvasInputNode subclasses. `value`, `setValue`, `onChange`, `onCommit`, `onCancel`, `readOnly`, `enabled`, `visible`, `setStyle` and Scene ownership reuse [the value foundation](canvas-controls.md). Values can be changed while disabled/read-only. Invalid program commands throw before invalidating an existing edit. Valid program writes, including equal writes, supersede it. Text controls additionally expose `draft`, `onDraftChange`, `commit()` and `cancel()`.

## Select

`CanvasSelect(options, {label = "Select", value?, readOnly = false}, style?)` copies/freeze-wraps labeled options. Values may be strings, numbers, enums or object references and use Object.is identity. Duplicate/undefined option values and malformed labels/flags are rejected. Objects themselves are not cloned. Option indices are internal Host identifiers and never replace application values.

The initial value is the first enabled option, falling back to the first option. Empty options have undefined value. A provided/program value must belong to the options; selecting a disabled value from code is allowed, while user selection is rejected. `setOptions(options)` validates atomically, cancels the current session and preserves a surviving value; otherwise it uses the initial-value fallback. This program command emits a change only if the accepted value changes.

The Web Host supplies a native select on the Canvas-resolved box. Browser/OS popup placement, scrolling of long lists, disabled options, touch pickers and key conventions remain native. A popup escapes ancestor Canvas masks and is constrained by the browser/OS viewport. Arrow keys move native selection; Enter/Space/Alt+ArrowDown opening conventions vary by platform. Escape cancels the native pending choice; Tab/Shift+Tab use shared CanvasUI traversal/reveal, and leaving the tree returns to page traversal. Native input/change snapshots form an accepted selection transaction. Escape/blur/removal end pending Core sessions; a browser may consume popup Escape itself, with Core cancellation completed on subsequent blur. Equal-value commits produce no change/commit event.

This is not a custom Canvas popup skin or window manager. Native select text and popup rendering are Host presentation, and their exact styling/assistive-technology behavior varies by browser. Read-only preserves focus/traversal while blocking selection gestures/keys. Outside activation and focus loss close the native picker according to platform behavior; Scene/node teardown removes the element and invalidates its session.

## Text value, draft and commit

`CanvasTextInput({label = "Text", value = "", placeholder = "", maxLength?, readOnly = false}, style?)` accepts single-line strings. `value` is the **last accepted value**, not the current draft. `draft` contains immutable `{text, selectionStart, selectionEnd, direction, composing}`. Offsets are UTF-16 positions matching native input APIs; the engine never reconstructs text by physical key codes or paints individual code units. Native editing handles grapheme navigation/deletion, shaping, bidirectional text, surrogate pairs and combining sequences.

- Focus/activation starts a session. Native input and selection snapshots update draft notifications. Identical snapshots are deduplicated. `onChange`/`onCommit` do not fire for intermediate or composing drafts.
- Enter accepts a valid noncomposing draft. A valid ordinary blur/Tab also accepts it. Value changes emit `onChange`, followed by `onCommit` if the transaction still owns that value. Accepting unchanged text ends editing without a value-change/commit notification, matching other controls.
- Escape, composition during blur, disabling/hiding, program replacement, removal, window hiding/loss and disposal cancel. The accepted value is retained and the draft is restored. `onCancel` reports the original activation source and accepted value. Cancellation is idempotent.
- `commit()` explicitly accepts a current valid draft and returns success; invalid/composing drafts cancel and return false. Without an active session it returns true. `cancel()` restores accepted text. Applications can validate current fields before an Apply snapshot.
- `maxLength` counts UTF-16 units, matching native maxlength; it is not a grapheme count. The Host preserves composition drafts even if temporarily over limit; overlong final drafts cancel. No manual slicing can leave half a surrogate pair. `setMaxLength(number | undefined)` rejects invalid limits or limits shorter than the accepted value, then supersedes editing. `placeholder` is dynamically assignable and does not alter the value.

The native input owns text/caret/selection while focused, following full Core bounds, clipping, font, padding and UI scale. Idle text is Canvas-painted, with the native input retained as a transparent activation target so pointer/touch focus can occur synchronously. The browser scrolls long editable text to keep its caret visible. No second Canvas caret or selection overlay competes with the native editor. Fields fully outside the viewport are disabled/blurred, ending their sessions. Native surfaces are additionally clipped beneath later Canvas hit surfaces and overlay scrollbars, preserving their pointer priority. Decorative Canvas-only paint above a native editor is not a native popup/custom layering API. Pointer activation stops ongoing UI inertia. Native text selection owns its drag; drag scrolling can start elsewhere in the parent. Wheel input over a field uses existing Core scroll routing.

## Number drafts and shared Slider values

`CanvasNumberInput({label = "Number", value?, min = 0, max = 100, step = 1, placeholder = "", readOnly = false}, style?)` uses the same single-line native text editor with `inputMode = "decimal"` and spinbutton semantics. Defaults/range validation/clamping/snapping match Slider. Values are finite numbers; `NaN`/Infinity and nonrepresentable ranges/steps throw for program updates. `setRange(patch)` validates atomically and then cancels editing and normalizes the accepted value.

Drafts such as empty text, `-`, `.`, `1e` are preserved while editing. On acceptance the parser allows trimmed ASCII decimal/fraction/exponent notation (`.5`, `-2.3`, `1e2`); it rejects hexadecimal, grouping separators, decimal commas and nonfinite results. Valid results are clamped/snapped with the shared Slider policy and displayed canonically with String(number). Invalid commit restores the prior accepted number and emits cancellation. This parser is locale-independent even when a native decimal keyboard displays locale-specific punctuation.

ArrowUp/Down change one step; PageUp/Down change ten, with finite endpoint saturation. A parseable current draft is the stepping base; otherwise the accepted value is used. Stepping cancels its text draft before emitting a keyboard value change/commit. During composition all these commands remain native.

```ts verify
import { CanvasNumberInput, CanvasSlider } from "@simpludify/core";
const slider = CanvasSlider({ value: 50 });
const number = CanvasNumberInput({ value: 50 });
slider.onChange(({ value }) => {
  if (number.value !== value) number.value = value;
});
number.onChange(({ value }) => {
  if (slider.value !== value) slider.value = value;
});
```

Scope subscriptions to the owning Scene/root in an application. Equality guards preserve commits: reflecting even an equal program write deliberately cancels pending editing. Keep ranges/steps equal when sharing a single numeric setting.

## Core/Host contract and migration

`CanvasControlPort.native` discriminates select versus text editing. Hosts call `begin(source)` and keep its `CanvasNativeSession<D>`; select drafts are enabled option indices, while text drafts are complete CanvasTextSnapshot values. Sessions have monotonic IDs and `active`, `update`, `commit`, `cancel`. Use `end("blur")` for a normal focus boundary; `end("interrupt")` for teardown. Core validates session identity, control revision and availability on every callback. A stale session can never target a newer node/session.

Existing custom Hosts may continue Checkbox/Slider support, but must implement native selection/text ports before claiming these new controls. Mirror logical focus through CanvasUI; route editor clipboard/navigation/composition to the native editor instead of control activation or parent scroll keys. Preserve selection/direction without rewriting editor.value for each snapshot. Replace/revoke native event listeners/surfaces after program/control-generation changes, even for equal values. Match full node geometry plus clipping rather than shifting the text origin to clipped bounds. Native editor lifetime belongs to its presentation; Scene/UI/Host disposal must abort listeners and remove elements. Core remains synchronously usable headlessly with the same session snapshots.

Web owns one presentation lifecycle/visibility handler, synchronous native activation, editor revision guards and replacement, native input/select/selection/composition events, and scoped listener disposal. BrowserInput excludes input/textarea/select/contenteditable, unmanaged native buttons and composition from gameplay Actions. Engine-owned buttons consume their UI activation/navigation keys while accepting unrelated gameplay bindings. Editor entry clears held browser keys; ending Enter/Escape retains editor focus, so use Tab to leave editing. Cleared holds require a fresh keydown, and keyup releases state even when consumed by UI. [Keyboard/focus priority](canvas-ui.md#keyboard-and-accessibility-scope) defines boundaries and custom Host expectations. No browser-wide clipboard interception, per-control frame loop or new dependency is introduced. Native touch pickers and text editors own their gestures; Canvas Button/HoldButton/Slider and ancestor drag-scroll retain PointerRouting.

## IME and verification limits

Composition start/update/end carry native draft state. Enter/Escape during `isComposing`, adapter composition state or keyCode 229 are left to the IME; they cannot commit a form or activate game Actions. Compositionend is a draft update, not a form commit, and a trailing identical input snapshot is deduplicated. Program changes invalidate the old element/session; late input/composition events cannot update another field. There is no portable API guaranteeing identical OS candidate-window cancellation on every browser.

Automated tests cover Core snapshots, browser editing, Unicode/selection/clipboard, composition event ordering, stale detached callbacks, focus, clipping, number validation, read-only and cleanup. Consult the [work report](work-reports/2026-10-31-native-input.md) for actual executed commands/counts and browser results. **Real Windows/macOS Japanese IME, physical Android/iOS keyboards, other browser engines, native picker visuals and assistive technology remain unverified.** Before claiming those targets, record OS/browser/IME versions and test candidate positioning/selection, conversion Enter/Escape, blur/program replacement/disposal during conversion and soft-keyboard viewport changes. These limits do not imply a custom key-to-text fallback.
