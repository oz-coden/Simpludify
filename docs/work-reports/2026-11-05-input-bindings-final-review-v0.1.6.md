# Input bindings v0.1.6 — final review and integration

## Recovery baseline

- Repository: `oz-coden/Simpludify`; branch `feat/input-bindings-v0.1.6`.
- Saved implementation: `e58e23d8ee2dbb598ae7f9f250177018245ccc28`; latest remote branch at recovery.
- Main: `b3e69dd3f2223431ac480fa1686182cbe7bca974`; npm Core/Web remain 0.1.5.
- Baseline [CI 41859271265](https://github.com/oz-coden/Simpludify/actions/runs/41859271265): 20 successful validation jobs, feature-branch deploy skipped. Job steps were checked against the workflow.
- [Implementation history](2026-11-04-input-bindings-v0.1.6.md) is preserved; earlier incomplete checkpoints do not describe the final saved code.

## Review and bounded corrections

Reviewed common Binding parsing/editing/defaults/persistence, legacy conflicts, source OR/axis composition, managed versus explicit gamepad mappings, pointer masks and sole router ownership, neutral capture and cancellation/reset/Replay/disposal, exported types, the lab, external consumers and paired documentation. No new runtime dependency, second gamepad poll, pointer owner, input pattern recognizer or settings framework was added.

1. A held managed gamepad Action emitted a synthetic release at the next device sample after rebind. The regression failed with releaseCount 1 before correction. An internal source reset now uses the controller's existing composition with edge recording disabled for that Action; unchanged Actions retain held values. Ordinary set/clear/dispose edges remain unchanged.
2. Keyboard events on native capture buttons skipped preheld tracking. Physical-key observation now occurs before target filtering, while event consumption remains scoped to eligible game targets. The opening Enter hold must become neutral before another key can be captured. A browser regression uses the real native button and standalone Alt.
3. BrowserPointer released virtual controls on editing/outside focus but retained a held world mouse contribution. The existing focus boundary now also resets the mouse source and blocks that gesture until release. PointerRouting ownership is unchanged; a browser regression verifies editing/outside focus, no hold restoration, fresh input and an independent program hold.
4. The English/Japanese Binding guides incorrectly grouped rebinding with fresh-input gating. They now state the existing keyboard/mouse held-adoption behavior and the managed-gamepad per-Action neutral rule precisely.

Public additions inherited from the saved implementation are MouseButton/MouseSource, optional mouse/gamepad Binding data, mouseEnabled, device-specific conflicts, portable InputCapture/InputDevice/PhysicalInput types and Game.captureInput. Existing get/rebind/add/remove/reset and version-1 import/export remain; keyboard-only exports retain their old shape. Extended data is rejected by older SDKs rather than silently truncated. Explicit gamepad mappings remain independent. Button OR, axis clamp/normalization and shared-input/multiple-Action support remain.

## Verification checkpoint

- `npm ci`: passed on Node 24.22.1.
- Targeted `vitest` Action/binding/capture/gamepad regressions: 73/73 passed after correction.
- Pinned local Chromium 156 installation: failed, invalid/truncated download archive. Browser acceptance for this revision is pending CI; no local browser compatibility claim.
- `npm run check`: passed (656 files, existing 16 warnings / 12 infos; Core boundary, SDK version and 116 dependency licenses passed).
- `npm test`: 66 files / 891 tests passed for the source in `0f5408054a23a49fb623bb028c94c1c5ec9829fe`.
- `npm run build -- --target web` and `npm run build:packages`: passed.
- First review checkpoint `0f5408054a23a49fb623bb028c94c1c5ec9829fe`, [CI 42008024527](https://github.com/oz-coden/Simpludify/actions/runs/42008024527). Quality and both tooling jobs plus Linux package/starter acceptance were already successful when the mouse focus correction was prepared. Other jobs were running; this is not a full successful-run claim.
- Current focus correction: static check passed with the same counts/diagnostics; full feature CI pending; final main integration pending. Browser fixtures are evaluated with standard Chromium in Actions.

## Known limits

Chromium automation uses simulated gamepads and software rendering. Physical gamepads, reconnect behavior on actual hardware, pen/vendor buttons, touch/OS variations, Safari/Firefox, hardware GPU and assistive technology are not real-device verified. OS/browser-reserved gestures may remain unavailable. Capture accepts digital keys/mouse/gamepad buttons only; analog bindings remain manually configurable. Chords, sequences, pattern recognition and a standard configuration widget remain outside this version.

No 0.1.6 npm publication, tag or GitHub Release is included in this task. Source and package manifests remain candidate version 0.1.6 while the public registry remains 0.1.5.
