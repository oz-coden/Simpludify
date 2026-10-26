# Signal Run

Run `npm ci` then `npm run dev -- --example signal-run` and open http://127.0.0.1:4173.

Collect six amber signals in 30 simulation seconds. Red circles and rotated bars remove one HP, followed by one second of invulnerability. Zero HP or an expired timer ends the run. Play again creates a fresh Scene.

Move with WASD/arrows after focusing the world, click/tap a destination, or hold the bottom controls (including two directions together). Directional input cancels the destination. Pause freezes simulation; Restart, Menu and Zoom use ordinary public APIs.

The world uses 800×450 logical units with Fit. DOM UI remains independent of Camera. Contact detection is trigger-only and does not apply physical response. `logic.ts` is DOM-free; `main.ts` supplies UI and browser input. `window.signalRun` exposes public inspection state for browser tests. Deterministic end-condition tests control positions and time; they are distinct from real keyboard/pointer input tests.
