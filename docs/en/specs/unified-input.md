# Unified input lab — two players

Two Characters retain the same reader-driven movement components while keyboard, gamepad, Canvas touch and program contributions change. This example uses the published v0.1.4 API; it does not require a physical pad for keyboard/touch/program operation.

```sh
npm ci
npm run dev -- --example unified-input
```

Focus the game surface. P1 uses WASD / F, P2 can use arrows / Slash when Keyboard + pad is selected. P pauses/resumes through P1. Each player has independent directional and Fire touch buttons. The pad Move action uses left stick and DPad; South fires and Start pauses.

- **P1/P2 mode** cycles Keyboard + pad → Pad only → Program. The same Actor, position and ActionReader stay alive. Program policy is sample game code and uses ordinary ActionSource.set.
- **P1/P2 pad** cycles the browser-exposed indices only when explicitly pressed. No connection event chooses a player automatically. Initially P1 is assigned slot 0 and P2 slot 1; same-device fan-out is allowed deliberately.
- **Labels** cycles automatic ID hint / generic / Xbox / PlayStation / Nintendo display names. Hints can be wrong; raw IDs/mapping/button/axis counts remain separately visible. Unmapped pads remain neutral by default.
- **Pause / Resume** preserves the game state but clears held input. Release all mapped controls before a fresh physical press. **New Scene** recreates the sample and disposes its previous controllers/sources/subscriptions.
- **Notes** is a native Canvas text editor. While editing, physical keyboard/gamepad input is suppressed; returning to the surface requires a neutral pad sample before gameplay resumes.

Each directional touch gesture owns an independent Source; combining gestures uses the same Action composition rules as keyboard/pad/program input. Program mode disables the other player-local sources. Input assignment never changes the other player or invokes an automatic AI takeover.

Browsers may expose no pad until a user gesture, require HTTPS/localhost, deny gamepad permissions or provide nonstandard mapping. The sample shows this state and continues with other input methods. IDs and indices are not persistent physical identities.

[Gamepad API and lifecycle contracts](../../specs/gamepads.md) · [Japanese lab guide](unified-input.md)

Automated fixtures simulate Gamepad API snapshots and verify independent players, actor-preserving handoff, disconnect/reconnect, pause, focus, CDP touch and Scene cleanup in WebGL/Canvas2D. These checks do not certify a physical device, vendor layout or OS driver.
