# Input bindings v0.1.6 — final review and integration

**Complete — 2026-11-05:** integrated as [`3914f15`](https://github.com/oz-coden/Simpludify/commit/3914f15fe2ed6965ad4d454425f08b093f7193ff); [main CI 42011806604](https://github.com/oz-coden/Simpludify/actions/runs/42011806604) passed all 20 validation jobs and Pages. npm remains 0.1.5. Detailed retry evidence and unverified environments are retained below.

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


## Validation follow-up — preserved failure evidence

Runtime candidate `dc8060e2ed6967c513fa67f12d00e3de6a64ee69`, [CI 42008438325](https://github.com/oz-coden/Simpludify/actions/runs/42008438325), passed quality (891 unit tests), both OS package consumers/tooling/starters, both independent site-base jobs, narrow browser shards (117 + 107 cases) and five frozen game-consumer configurations. Desktop browser shards were still running when this checkpoint was written.

The frozen external consumer's desktop WebGL job failed its 320px production resize case, including its existing retry. The unchanged fixture is pinned at `e3c6f50ad837e2d2c598a1a1d01c47077b33d00c`. The failure artifact and trace show 900/390px checks passing, then an individual synchronous `game.viewport` evaluation remaining unfinished beyond the 5s polling deadline at 320px; its eventual value was about 106.39. The last rendered capture still showed the previous wider help layout. The engine's viewport/projection implementation is unchanged from 0.1.5; the other five renderer/viewport configurations and standalone Windows/Linux package cases passed. A clean retry of the identical failed job is needed to distinguish a runner/browser stall from a reproducible compatibility issue. No assertion, retry count or timeout has been changed. Integration remains gated on a successful full run.

Local documentation changes passed static checks and project-base site build/check (97 HTML documents, 8686 references, 88 standalone TypeScript examples). The first sequential root-base build/check found a stale project-base SDK-integration HTML reference; an independent rebuild of the generated root output passed the same reference/snippet checks. Both isolated CI base jobs also passed with 8683 references for the earlier documentation revision. No product rule or site assertion was changed in response; the local anomaly is recorded rather than reported as an uninterrupted pass.

Registry reads confirmed Core/Web remain 0.1.5. npm publication/tag workflows are manual; neither has been dispatched. The roadmap and Japanese/English home pages now distinguish source-only 0.1.6 from published 0.1.5. Historical report content has been verified byte-for-byte against the original saved commit as an unchanged prefix.


## Final feature acceptance — 2026-11-05

[CI 42008438325, attempt 2](https://github.com/oz-coden/Simpludify/actions/runs/42008438325/attempts/2) completed successfully for runtime candidate `dc8060e2ed6967c513fa67f12d00e3de6a64ee69`: **20/20 validation jobs passed**, with deploy skipped on the feature branch. Successful first-attempt jobs were reused; only the failed desktop consumer job was rerun. That clean job passed its 35 headless cases and all 11 E2E cases, including the unchanged 320px production resize assertion. The initial timeout did not reproduce; its root cause is not established, and no product/fixture/timeout change was made to obtain the successful result.

| Validation                | Final result                                                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality                   | 66 unit files / 891 cases; TypeScript, DOM-free Core, static/boundary/version/license checks passed; existing 16 warnings / 12 infos                                               |
| Engine browsers           | 448 cases: desktop 117 + 107, narrow 117 + 107; WebGL and Canvas2D regressions included                                                                                            |
| Core/Web packages         | Ubuntu and Windows clean external archives, Core-only Node/strict declarations, Web transitive Core installation, Vite subpath and development/production at 1280/390/320px passed |
| Independent game consumer | Six renderer/viewport configurations; 66 E2E cases total and 35 headless cases per clean candidate checkout passed; dependency files unchanged                                     |
| Starter and tooling       | Ubuntu/Windows starter and CLI/path/Core-boundary jobs passed                                                                                                                      |
| Production examples       | Existing development/browser samples and production UI/scenes, Signal Run, Canvas UI and Tween smoke jobs passed                                                                   |
| Site                      | Both isolated root/project-base build/reference checks, 88 standalone TypeScript snippets, gallery and live SDK/tile/virtual/unified regressions passed                            |

The final native-opener and mouse-focus regressions passed in both viewport sizes and both renderers. Previously completed implementation/consumer/paired-documentation checkpoints have been reused. Current source changes after the validated runtime are documentation only (historical record restoration, source/publication status and these results); local static checks and both site-base reference/snippet checks passed as recorded above. Original implementation history is preserved intact.

Final review is complete. Main integration and its separate CI remain pending at this checkpoint. No 0.1.6 publication/tag/Release has been created.


## Main integration and final verification — 2026-11-05

- Main was rechecked immediately before integration and remained `b3e69dd3f2223431ac480fa1686182cbe7bca974`. No unrelated main changes were overwritten; the update used an expected-head lease and no force push.
- Feature acceptance/documentation checkpoint: `881e786176cc1c23ab0716c9ab4ba4b9f949135b`. Its runtime/packages/examples/tests/workflows are identical to the feature CI candidate; subsequent edits were documentation only.
- Main integration: **`3914f15fe2ed6965ad4d454425f08b093f7193ff`**, with the previous main and feature checkpoint retained as parents.
- [Main CI 42011806604](https://github.com/oz-coden/Simpludify/actions/runs/42011806604), attempt 1: **completed successfully, all 20 validation jobs plus Pages deployment/live verification (21 successful jobs)**. This is independent main verification, not a reused feature-branch run.
- Main logs confirm **66 unit files / 891 unit cases** and **448 engine browser cases** (117 + 107 for each desktop/narrow project), without engine test retries. TypeScript/Core boundary/static checks, both OS packages/starters/tooling, production builds and both site bases passed. Existing static diagnostics remain 16 warnings / 12 infos.
- The independent game consumer completed all **66 E2E cases** across six configurations: **65 first-pass successes and one desktop WebGL case successful on the fixture's existing retry**. All six candidate checkouts also passed 35 headless cases each and retained dependency files unchanged. The retried main case was command reordering, not the earlier feature-branch 320px resize case. Its trace shows a plain command-text `page.evaluate` remaining unanswered for about 15 seconds until test teardown; it did not return a failing logical value. Its unchanged retry and the other five configurations passed. [Failure/trace artifact](https://github.com/oz-coden/Simpludify/actions/runs/42011806604/artifacts/13406624769). No assertion, timeout or retry setting was relaxed. The intermittent desktop browser responsiveness remains a recorded automation limitation; its root cause is not established.
- Pages deployment and live SDK integration, Tween, Tilemap, tile-geometry, virtual-input and unified-input checks passed at `https://github.oz-coden.com/Simpludify/`.
- Registry reads confirmed Core/Web 0.1.5; remote tags and GitHub Releases contain no v0.1.6. No publication, tag workflow or Release creation was performed.

The final follow-up commit only records these results in this report, the preserved implementation report and their index. Runtime, manifests, examples, tests, workflows and site content remain byte-identical to the validated integration commit. Static validation is required for this record; duplicate runtime CI is skipped for the documentation-only successor. The validated source commit and successful main run above remain the runtime acceptance evidence.

## Remaining limits and follow-up

No reproducible functional regression remains from this review. Intermittent desktop WebGL/frozen-clock responsiveness was observed as described above; successful retries do not establish its underlying cause. The earlier local base-switch generated-output anomaly also remains historical evidence, with independent root rebuild and both isolated main CI base jobs successful.

Physical gamepads and real-device reconnect behavior, pen/vendor buttons, actual touch/OS variations, Safari/Firefox, hardware GPU and assistive technologies remain unverified. OS/browser-reserved gestures may remain unavailable. Capture remains single digital input; analog capture, chords, sequences, pattern recognition and a standard settings widget are deferred. Existing analog bindings remain available. Version-1 keyboard-only persistence and older explicit gamepad mappings remain compatible; older SDKs reject the extended optional device fields.
