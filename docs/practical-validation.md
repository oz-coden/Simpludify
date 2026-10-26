# Practical game validation

Signal Run is a short, complete example built from the public Scene/Actor/Component/Event APIs. Its headless round logic and browser host are separate, so collection, damage, timing and disposal can be checked without Pixi or DOM. See [game instructions](../examples/signal-run/README.md), [API contracts](api.md) and [raw performance reports](../benchmarks/practical/).

## Reproduce behavior checks

```sh
npm ci
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm run test:build
npm run test:build:game
```

`CHROMIUM_PATH` can select a compatible existing Chromium executable. The normal CI workflow runs these checks against the committed sources; it does not silently format them before validation.

The headless suite covers shape boundaries/rotation/scale/filtering, contact mutation and exception delivery, owner cleanup, input composition, pause, failure recovery and controlled gameplay. The browser suite exercises real Pixi output, native controls, two simultaneous touch holds, pointer conversion under zoom, complete collection routes, win/loss/replay, aborted preparation, partial UI construction and renderer failure/disposal. Screenshots are inspection artifacts; color/pixel and bounds assertions provide explicit checks rather than an unmaintained visual snapshot claim.

A complete route is tested using destination input and ordinary Motion updates, with hazards enabled and no teleportation. The automated test advances simulation time explicitly; this verifies gameplay mechanics and reachability without claiming a human playtest or measured input latency. The same route is exercised through browser pointer events at desktop and narrow sizes.

Production smoke checks build the UI/scenes example and Signal Run separately under `/Simpludify/`, then run them at 1440×900 and 390×844. They verify successful startup, scene controls, canvas presence, horizontal bounds and absence of page errors. Browser integration tests additionally cover camera/viewports, DPR and cleanup.

## Performance and memory checks

```sh
node scripts/benchmark.mjs --out benchmarks/practical/after-core.json
node scripts/benchmark-browser.mjs --out benchmarks/practical/after-browser.json
npm run bench:practical -- --out benchmarks/practical/contacts-and-memory.json
npm run build -- --target web --example signal-run --base /Simpludify/
npm run bench:practical -- --mode browser --out benchmarks/practical/production-game.json
```

Run each measurement separately, with no concurrent tests/builds or other benchmark processes. `bench:practical` enables Node's exposed GC for the Core memory workload. Browser mode requires the Signal Run production build above; it fails if it cannot find that game's inspection state. It collects browser heap/DOM counters after CDP garbage collection and asserts live/disposed host, overlay, input-source and Actor counts during repeated scene cycles.

The accelerated Core session advances 36,000 steps (600 simulation seconds). Disposal checks create, step and destroy 500 rounds after warmup. Browser measurements sample 300 RAF intervals each in menu/active play, then 100 round cycles after warmup. These are bounded regression workloads, not extended real-time soak tests. The heap samples cover managed memory and DOM observations, not complete native or GPU allocation accounting.

See [performance methodology and observations](performance.md) for matched historical workloads, measured costs and remaining limits. Dense contacts remain quadratic, and continuous resizing/font changes remain a slow workload. Physical collision response, swept collision, audio, animation, desktop packaging and cross-browser coverage are separate future capabilities.
