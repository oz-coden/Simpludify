# Input bindings lab

This v0.1.6 example retains one Character and ActionController during runtime assignment changes. Core/Web 0.1.6 are published on npm. Next development milestone is v0.1.7.

```sh
npm ci
npm run dev -- --example input-bindings
```

Focus the game. WASD, left virtual stick or pad left stick moves. Space, mouse Back, pad South or right virtual button supplies Jump; E or a world-owned left mouse button supplies Attack. Canvas UI retains pointer priority.

Capture Jump input waits for held inputs to release, then adds one key, game-surface mouse button or pad button. Escape/modifiers are assignable. Cancel capture is explicit. Save bindings/Restore saved bindings keep an in-memory snapshot; Reset Jump restores initial assignments. The example supplies no standard settings widget or persistent storage. Nonstandard pads require explicit raw mapping; this lab uses standard mapping.

[Binding contracts](../../docs/input-bindings.md) · [日本語](../../site/ja/input-bindings.md)
