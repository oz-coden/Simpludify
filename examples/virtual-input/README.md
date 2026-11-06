# Virtual input lab

This sample demonstrates virtual sticks and pointer controls. Core/Web 0.1.6 are published on npm. Next development milestone is v0.1.7.

```sh
npm ci
npm run dev -- --example virtual-input
```

The left 44% of the layout-bound Viewport starts movement; the right 44% starts aiming. The middle 12% starts neither stick. After down, each pointer keeps its original owner even when the two fingers cross or move outside their starting region. Both stick and button input also work with the mouse.

- **Stick** cycles fixed, floating and follow modes without replacing the Character/controller.
- **Hide input UI** changes paint only; invisible virtual controls remain enabled. **Disable virtual input** also cancels active gestures and clears their contributions.
- Blue button: directionless Boost, with a one-shot hold notification after 0.5 presentation seconds. Red button: Fire with optional drag direction and normal-release confirmation. Game-specific movement and counters live only in this sample.
- **Canvas priority** demonstrates a normal Canvas UI button above the broad movement region. It never starts the underlying stick.
- **Program** explicitly changes sources on the same controller/Character. WASD, arrows, Space, Shift and an explicitly bound standard gamepad are alternative input sources.
- **Pause** and **Restart scene** demonstrate reset/disposal. Resizing re-resolves regions and cancels any old gesture.

The amber marker shows the composed Aim Action; the green Character reads Move through its original ActionReader. Virtual input drawing is screen-space, independent of Camera and DPR. The sample intentionally does not guess whether a device is a phone or hide controls on desktop.

Read the [English API and arbitration guide](../../docs/virtual-input.md) or [Japanese guide](../../site/ja/virtual-input.md). Automated multitouch is not physical-device, pen-pressure, mobile-browser or non-Chromium certification.
