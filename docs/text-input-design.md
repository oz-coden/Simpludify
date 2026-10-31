# Native text editing design (not implemented)

Checkbox/Slider and their [value foundation](canvas-controls.md) are implemented independently of text editing. **CanvasTextInput, CanvasNumberInput, CanvasSelect and a native editing bridge are not public APIs.** This document describes the next implementation boundary; no IME or mobile keyboard support is implied by these proposals.

## Common state without a giant input superclass

The existing CanvasUI focus/tree/lifetime and CanvasInputNode typed values/read-only/events are reusable. Text editing additionally needs a draft, accepted value, editing session identity, selection and composition state. NumberInput must allow temporary invalid drafts (`-`, decimal separators, partial exponents) without publishing them as numeric values. Select needs stable option IDs, one selected value and popup/keyboard focus semantics; it does not need an editable text buffer by default. Do not force these distinct contracts into Button/HoldButton or one HTML/CSS abstraction.

A future Core editing session should define:

1. Accepted value versus draft and the exact commit/cancel policy. Text can publish draft changes but a form-level commit remains distinct; NumberInput validates/parses on its declared commit boundary. Escape/cancel and blur/Enter policies must be documented per control, not inferred from the immediate Slider contract.
2. Selection anchor/focus and direction in **UTF-16 offsets**, matching native browser input selection. Validate bounds against the draft; do not split/reconstruct text from physical key codes. Let the Host/native editor handle grapheme cursor movement, selection, deletion and clipboard operations.
3. Composition lifecycle (start/update/end), composing draft versus accepted commits, and a monotonically identified editing session. Input and composition event ordering varies: the adapter must not duplicate a final input/composition commit. Synthetic event tests cannot establish actual OS IME quality.
4. Program replacement, read-only/disabled changes, focus movement and destruction invalidate the session. Late native events from a detached/previous editor cannot modify a new node or Scene. Program replacement during composition needs a defined supersession policy and browser/device tests; there is no portable command that guarantees the same native IME cancellation behavior everywhere.

## Web Host ownership

The Web Host should create and own the native input/textarea/select as needed. Game code continues to create standard Canvas controls; it never calls document.createElement. A focused native editor can overlay the control using Core-resolved bounds, scale, clipping and typography, retaining native caret/selection/composition and accessibility. Native caret/selection painting must not be duplicated by an independent Canvas editor.

- Native beforeinput/input/selection/composition and focus events provide full value/selection snapshots to the current Core session. KeyboardEvent.code remains gameplay/control navigation input, not a text stream.
- BrowserInput already excludes native editors/contenteditable/composition; retain that boundary. Text arrows, Backspace/Delete, copy/paste/cut/select-all and IME Enter/Escape belong to the editor while it owns focus. Do not install browser-wide clipboard hooks or intercept unrelated page input.
- Preserve native clipboard shortcuts and paste events. Programmatic clipboard access is not required for ordinary editing and must not become an implicit permission requirement.
- Native touch focus must occur during the user's actual activation where required for soft keyboard display. Deferred async focus may fail to show a mobile keyboard; physical Android/iOS tests are required. Keep editor geometry updated on viewport/soft-keyboard changes without introducing one frame chain per input.
- Scene transitions, preparation failures, blur, hiding and node removal must end/invalidate sessions, abort listeners, remove native editors and release held gameplay sources. Test disposal during composition and late input events explicitly.
- NumberInput should start from a native text editor with an explicit inputMode/locale/parser policy so intermediate drafts are preserved. A native type=number is not a substitute for specifying empty/invalid/composing states. Select can use a native single-choice element in the Host while Core owns options/value; a Canvas popup implementation would additionally require focus containment, scroll/clipping and accessibility design.

## Required tests before exposing APIs

Core: draft/accepted values, selection bounds, Unicode (Japanese, combining marks, emoji/surrogate pairs), commit/cancel, program supersession, read-only, invalid numeric drafts, scoped events and Scene disposal. Web: actual native insertion/selection/deletion/paste, focus traversal, composition event ordering without duplicate commits, stale-session rejection, clipping/resize/scroll, editor removal and gameplay input exclusion.

Real OS IME: Japanese conversion/candidate selection, conversion Enter versus form Enter, Escape behavior, focus loss, replacement/disposal during conversion, and physical mobile soft keyboards. Record browser/OS/IME versions and distinguish observed outcomes from synthetic fixtures. Until those checks pass, retain this as design work; do not publish unfinished factories or call IME complete.
