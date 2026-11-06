# Platform limits and implemented scope

The current source and public registry Core/Web are experimental SDK 0.1.6. Next development milestone is v0.1.7. Existing release tags/packages are immutable. APIs can change before stability; use package roots and exact versions/lockfiles.

| Area             | Implemented / verified scope                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Core             | Synchronous ES2022 simulation/data/Actions, DOM/Node/Pixi-free declarations; headless Node consumer                                |
| Web              | Pixi presentation, browser keyboard/pointer/gamepad adapters, DOM/Canvas UI, native editing, async Scene readiness                 |
| Rendering        | Chromium automated WebGL and Canvas2D fixtures; software GPU results are not a hardware performance guarantee                      |
| Gamepads / Input | Standard positional mapping, raw bindings, multiple devices, analog/dead zones, virtual pointer controls, physical binding capture |
| Distribution     | ESM/declarations/CSS npm SDK; external Vite/NodeNext consumers on Windows/Linux                                                    |
| Hosting          | Static dist and subpath/root builds; Pages deployment after successful CI                                                          |
| Native apps      | Electron/Tauri/Android packaging is not implemented; Windows SDK tests are not native executable tests                             |
| Networking / AI  | External programs may feed validated ActionSources; no transport, rollback, authority or AI decision framework                     |

Browsers can require HTTPS/localhost, an allowed gamepad Permissions Policy and a physical pad gesture. Device IDs/indices are not persistent identity, and layout hints are uncertain. Automated Gamepad snapshots do not certify real hardware, OS drivers, rumble, vendor layouts, mobile devices or all browser implementations. Safari/Firefox, actual OS IME and physical screen readers remain unverified.

Collision uses discrete circle/rotated-box geometry and bounded position correction, not a rigid-body solver or continuous collision guarantee. Triangle/Hexagon visuals do not add matching polygon physics. Subdivide time or constrain speed/geometry when needed; inspect unresolved contacts. Replay requires controlled seed, deltas, Action frames/schema/version and its documented fresh-Engine/single-Scene limits. It is not arbitrary state restoration or cross-platform bitwise proof.

Canvas UI implements a bounded Flex subset, not CSS layout or a general document editor. Changes can relayout the root; hit testing scales with visible nodes. Scroll paint culling/cache does not virtualize the logical list. Native editor composition semantics are tested synthetically; application validation remains explicit. Label heading/status/alert mirrors do not certify assistive technology. Use DOM UI where richer document semantics are needed.

See [API](../../docs/api.md), [gamepads](../../docs/gamepads.md), [Canvas](../../docs/canvas-ui.md), [collision](collision.md), [hosting](hosting.md), and Engineering records for measured scope. Do not treat proposals or historical work reports as current API contracts.
