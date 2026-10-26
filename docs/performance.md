# Performance measurements

Baseline artifacts: [core](../benchmarks/core-baseline.json), [browser](../benchmarks/browser-baseline.json). These are local observations from 2026-10-26, not performance guarantees or comparisons with other engines.

## Reproduce

```sh
npm ci
node scripts/benchmark.mjs --out benchmarks/core-baseline.json
npx playwright install --with-deps chromium
node scripts/benchmark-browser.mjs --out benchmarks/browser-baseline.json
```

`CHROMIUM_PATH` can select another compatible Chromium binary. Always record its version; do not compare browser versions or software/hardware rendering as if they were the same configuration. The initial browser run used Chromium 153.0.8010.0, Playwright 1.64.1, Node 24.22.1, Linux x64, an AMD EPYC 9V74 shared container, 1280×720 viewport, WebGL with SwiftShader, and the Vite development server. Playwright's default browser download was unavailable on that host, so a locally extracted Chromium binary was selected explicitly.

## Initial observations

| Workload                               | Measurement                              | p50     | p95     | p99     |
| -------------------------------------- | ---------------------------------------- | ------- | ------- | ------- |
| Idle core                              | Engine step duration (ms), 5,000 samples | 0.00010 | 0.00023 | 0.00127 |
| 1,000 moving characters, core only     | Engine step duration (ms), 5,000 samples | 0.03611 | 0.04967 | 0.09350 |
| Empty rendered scene                   | Browser RAF interval (ms), 180 samples   | 16.70   | 16.70   | 16.80   |
| 1,000 moving image sprites             | Browser RAF interval (ms), 180 samples   | 16.70   | 16.80   | 16.80   |
| 1,000 UI labels, one text update/frame | Browser RAF interval (ms), 180 samples   | 16.70   | 16.70   | 16.80   |
| Resize and font changes each frame     | Browser RAF interval (ms), 180 samples   | 16.70   | 16.70   | 16.80   |
| 50 scene creation/disposal cycles      | Transition duration (ms)                 | 0.30    | 0.60    | 0.80    |

Core measurements warm up 1,000 steps and use a fixed `1/60` simulation delta. Browser frame intervals are measured between RAF callbacks; they do not isolate GPU duration or input-to-photon latency. The final baseline records 115 RAF intervals over 25ms during continuous resize/font changes and two in the UI workload. Idle and moving-sprite samples had none. RAF intervals do not establish an exact dropped-frame count. Continuous resize is an identified optimization area, not a passing frame-budget guarantee.

The initial static build was approximately 1.02 MB including conservative dependency notices/inventory. Its emitted JavaScript and CSS totaled approximately 554 KB, or 165 KB when each file was independently gzip-compressed. This is emitted output, not a measured browser transfer, startup time, installed desktop footprint or Electron runtime size. Rerun on the relevant build before using size figures externally.

## Limits and remaining measurements

The original baseline heap values were sampled without forced GC. Browser memory reporting was coarse/constant in this environment; it cannot demonstrate retained-memory stability. Short idle/active samples of 300 frames are recorded, but a long-running soak test remains pending. Scene cleanup correctness is additionally asserted in browser tests.

CPU/GPU load, actual dropped frames, startup latency and input latency were not measured. No Godot/Phaser comparator has been implemented. The practical measurements below add a production game sample and forced-GC managed-memory observations. Controlled hardware, native/GPU memory instrumentation and an extended active/idle real-time soak remain necessary before broad performance claims. Future baselines must separate CPU simulation cost, UI/layout cost, GPU work and device/refresh-rate limits.

## Generic Core architecture comparison

The [comparison inventory](../benchmarks/core-refactor/comparison.json) links the revision baseline to `fd6c116`. Fresh [before Core](../benchmarks/core-refactor/before-core.json), [after Core](../benchmarks/core-refactor/after-core.json), [before browser](../benchmarks/core-refactor/before-browser.json) and [after browser](../benchmarks/core-refactor/after-browser.json) reports preserve the raw observations. These fresh before values differ from the original baseline above; compare matched runs rather than choosing the most favorable historical value.

Both runs used the same scripts, Node 24.22.1, Chromium 153.0.8010.0, Linux x64/AMD EPYC 9V74 shared host and software WebGL rendering at 1280×720. No local test/build job ran concurrently with these recorded samples. The shared container is still not controlled physical hardware. Core samples use 1,000 warmup steps and 5,000 measured steps; browser rendering samples use 180 RAF intervals.

| Core workload                  | Before p50 / p95 / p99 (ms) | After p50 / p95 / p99 (ms)  |
| ------------------------------ | --------------------------- | --------------------------- |
| Idle                           | 0.00010 / 0.00018 / 0.00118 | 0.00014 / 0.00123 / 0.00147 |
| 1,000 moving Character presets | 0.04121 / 0.05400 / 0.07782 | 0.13033 / 0.16155 / 0.21661 |

The 1,000-Actor Core median increased by about **0.089ms** (approximately **3.16×** the prior specialized loop). The generic revision executes ownership/enable checks, separate input/update phases and Component dispatch. It therefore must not be described as a speed improvement. Its steady-state implementation caches structural plans, freezes input only on changes, reuses movement vectors and avoids per-frame projection/mask strings; further profiling is still warranted.

| Browser workload               | Before p50 / p95 (ms) | After p50 / p95 (ms) | Intervals over 25ms, before → after |
| ------------------------------ | --------------------- | -------------------- | ----------------------------------- |
| Empty scene                    | 16.70 / 16.70         | 16.70 / 16.70        | 0 → 0                               |
| 1,000 moving image sprites     | 16.70 / 16.80         | 16.70 / 16.70        | 1 → 1                               |
| 1,000 UI labels                | 16.70 / 16.80         | 16.70 / 16.70        | 0 → 0                               |
| Continuous resize/font changes | 50.00 / 66.70         | 49.90 / 66.70        | 111 → 108                           |
| Scene transitions (50 cycles)  | 0.30 / 0.60           | 0.30 / 0.50          | not a RAF sample                    |

RAF-limited medians do not demonstrate equal GPU cost or a reliable performance improvement. The tiny differences are not statistically established. Resize/font changes remain an identified slow workload. Reported browser heap samples were coarse/constant (about 17.1MB before and 18.2MB after), so they cannot establish retained-memory stability. Unit/browser tests separately assert owned resource counters, scoped subscriptions, cancellation and cleanup behavior. Long-running soak tests and detailed memory/CPU/GPU instrumentation remain pending.

## Practical game and trigger-contact measurements

The [practical validation guide](practical-validation.md) describes the behavior checks and reproduction commands. The new [Core contact/memory report](../benchmarks/practical/contacts-and-memory.json) and [production Signal Run report](../benchmarks/practical/production-game.json) measure the capabilities exercised by a complete game. They supplement the historical baselines rather than replacing them.

Fresh matched reports compare `73fcc41` with the practical composition implementation: [before Core](../benchmarks/practical/before-core.json), [after Core](../benchmarks/practical/after-core.json), [before browser](../benchmarks/practical/before-browser.json) and [after browser](../benchmarks/practical/after-browser.json). Both use the same scripts/dependency lock, Node 24.22.1, Chromium 156.0.8078.4, Linux x64, AMD EPYC 9V74 shared host and software WebGL. Measurements run separately from tests/builds and other benchmark jobs. This browser version differs from the older historical baseline, so use the matched pair for this revision.

| Core workload                  | Before p50 / p95 / p99 (ms) | After p50 / p95 / p99 (ms)  |
| ------------------------------ | --------------------------- | --------------------------- |
| 1,000 moving Character presets | 0.12493 / 0.19728 / 0.31223 | 0.09789 / 0.13897 / 0.20047 |

The practical implementation skips passive Actors in the Component dispatch roster and avoids dispatching the base no-op Component update. Its 1,000-character median was about 0.027ms lower in this matched observation. It adds no automatic collision pass to Scenes without a CollisionWorld. This is a single shared-host observation; it does not establish a general speedup or reverse the cost of the broader generic-Core refactor above.

| Contact workload                  | p50 / p95 / p99 step (ms)   | Candidate / narrow-test / contact pairs |
| --------------------------------- | --------------------------- | --------------------------------------- |
| 1,000 separated circles           | 0.10332 / 0.15599 / 0.24992 | 0 / 0 / 0                               |
| 1,000 circles on a 40-column grid | 0.75320 / 1.02074 / 1.33926 | 36,375 / 3,807 / 1,935                  |
| 100 circles at one point          | 0.54156 / 0.73336 / 0.95171 | 4,950 / 4,950 / 4,950                   |

Each contact workload warms up 200 steps and measures 1,000 steps, without rendering or event subscribers. These costs are not comparable to a dynamic physics solver or collision callbacks running game logic. Dense overlap retains O(n²) contact pairs. The grid also demonstrates that an X-only sweep can still produce many broad-phase candidates; profile the actual game before choosing another index.

Core sessions advance 36,000 steps each for idle and active play (600 simulation seconds), followed by explicit disposal checks. A separate workload warms up 50 rounds and measures 500 create/step/dispose cycles, forcing Node GC after each 100-cycle batch. Heap samples ranged from 56.18MB to 56.36MB including the Vite SSR/tooling runtime; the endpoint was about 0.14MB above the starting sample. Owned colliders, round Actor sets and explicit input sources were cleared after each disposal. These observations are bounded regression evidence, not proof of leak absence or a ten-minute real-time soak.

The matched browser workloads retained a 16.7ms RAF median for idle, moving sprites and selective UI updates. Continuous resize/font changes remained at 50.0ms median / 66.7ms p95, with 113 of 180 intervals over 25ms in both runs. Transition medians were 0.2ms before and 0.3ms after; their tails varied. These observations do not establish a browser-rendering improvement. The old coarse browser heap samples remain unsuitable for retention conclusions; the production disposal workload uses CDP GC/heap/DOM instrumentation instead.

The production Signal Run sample recorded idle/active RAF medians of 33.3/33.3ms (300 samples each). After 20 warmup rounds and 100 measured play/menu cycles (200 measured transitions), forced-GC JS heap moved from 3.94MB to 4.12MB. Every batch retained 1 document, 50 DOM nodes and 31 JS event listeners. During menu checks there was one canvas, one overlay, one browser keyboard source and no Scene Actors; after Game disposal the owned host/canvas/input-source counts were zero. These counts and the small managed-heap variation support cleanup correctness for this workload, while excluding native/GPU memory and longer real-time behavior.

## Trigger/Solid response extension

[Validation and reproduction](solid-response-progress.md), [before Core](../benchmarks/solid-response/before-core.json), [after Core](../benchmarks/solid-response/after-core.json), [five-minute checkpoint soak](../benchmarks/solid-response/checkpoint-soak.json) and [final-placement profile](../benchmarks/solid-response/browser-profile.json) preserve the measured versions and raw observations. The before revision is `3f3d935`; subsequent source revisions are recorded in each report. The five-minute run preceded the final interior-wall placement adjustment; the final profile checks that layout separately. Do not silently treat different revisions as one sample.

Node 24.22.1, Chromium 156.0.8078.4, Linux x64, AMD EPYC 9V74 shared host, 1280×720, production WebGL/SwiftShader are used for the browser observations. Core workloads use the same harness and lockfile with 200 warmup/1,000 measured steps, excluding rendering. Other local tests/builds/benchmarks do not overlap recorded runs. Single shared-host runs do not establish statistical or hardware-independent speedups.

| Core workload                           | Before p50 / p95 / p99 (ms) | After p50 / p95 / p99 (ms)  |
| --------------------------------------- | --------------------------- | --------------------------- |
| empty                                   | 0.00089 / 0.00260 / 0.01603 | 0.00054 / 0.00123 / 0.01438 |
| 1000 passive Actors                     | 0.00020 / 0.00149 / 0.00250 | 0.00034 / 0.00075 / 0.00119 |
| 1000 moving Characters                  | 0.10538 / 0.16127 / 0.23502 | 0.10332 / 0.18505 / 0.30150 |
| 1000 sparse Triggers                    | 0.06072 / 0.10169 / 0.16446 | 0.11918 / 0.16768 / 0.22570 |
| 1000 grid Triggers                      | 0.70808 / 0.89072 / 1.01492 | 1.67991 / 2.25345 / 3.48616 |
| 100 dense Triggers                      | 0.48801 / 0.63265 / 0.85395 | 1.21372 / 1.59666 / 2.97966 |
| 1000 fixed Solids                       | not implemented             | 0.58155 / 0.77868 / 0.96023 |
| 1000 static obstacles + 1 dynamic Actor | not implemented             | 1.40940 / 1.66724 / 2.95342 |
| 100 moving dynamic Solids               | not implemented             | 0.21217 / 0.24670 / 0.32235 |
| 100 crowded dynamic Solids              | not implemented             | 1.00134 / 1.36375 / 2.27625 |
| one Trigger wall                        | not implemented             | 0.00192 / 0.00466 / 0.00617 |
| one Solid wall                          | not implemented             | 0.00371 / 0.00432 / 0.00728 |

Normal/manifold payloads, finite-world validation and response-policy bookkeeping add measurable Trigger cost; the extension is not presented as a performance improvement. Solids add bounded repeated scans only when a dynamic Solid participates. The one-axis sweep is retained because these local costs do not justify introducing a more complex index yet, but its unfavorable-axis and dense-pair costs remain explicit.

The static-obstacle fixtures contain 1,000 fixed colliders whose layer/mask excludes mutual static/static interactions. The moving-dynamic fixture settles under uniform motion. The crowded fixture resets 100 poses into overlap outside each timed step to impose sustained simultaneous pressure; its default six passes retain unresolved overlaps (see raw diagnostics). It measures bounded work, not a claim that dense stacks converge. Position correction is intentionally not a full rigid-body solver.

Pair-churn measurement crosses 1,000 filtered Trigger locations for 2,000 steps, observing 2,000 Enter and 1,999 Exit events and retaining one pair before disposal. Core memory sampling warms up 50 rounds, then performs 500 create/step/dispose cycles with forced GC every 100 cycles. Resource assertions verify empty world registrations/contact tables, input sources and wall sets after destruction. Raw managed-heap samples include Vite/tooling and are not native/GPU retention measurements.

### Separating the reported 33ms frame interval

The harness first samples the normal production application. It then drains/stops the application's automatic RAF chain and schedules four explicit workloads: RAF only, simulation only, draw only, and simulation plus draw. Simulation CPU time wraps Engine.step. The draw proxy wraps the public Game.setViewport operation, including projection refresh and synchronous Pixi/WebGL submission. Deferred DOM layout/composition and actual GPU execution are not individually timed. JavaScript clock resolution is coarse enough that small samples can round to zero.

The five-minute checkpoint recorded the following 180-interval samples:

| Workload            | RAF p50 / p95 (ms) | Simulation CPU p95 (ms) | Draw/projection CPU p95 (ms) |
| ------------------- | ------------------ | ----------------------- | ---------------------------- |
| RAF only            | 16.70 / 16.80      | 0.00                    | 0.00                         |
| simulation only     | 16.70 / 16.80      | 0.10                    | 0.00                         |
| render only         | 33.30 / 50.00      | 0.00                    | 0.30                         |
| simulation + render | 33.40 / 50.10      | 0.20                    | 0.30                         |

Simulation-only pacing stays near the RAF-only baseline, while adding draw submission reproduces the roughly 33ms cadence even without game simulation. This supports an inference that rendering/presentation work in this software-rendering environment is a larger contributor than the measured game logic. It does **not** identify exact GPU time, prove a renderer defect, establish hardware FPS, or distinguish all compositor/scheduling effects. No speculative renderer optimization is applied on this evidence alone.

### Real-time memory observations

The checkpoint ran for 300 actual wall-clock seconds, with alternating movement and a fresh round every 20 seconds. Forced-GC JS heap increased from 3.36MB to 4.60MB; event listeners stayed at 71. DOM nodes were usually 73, with transient samples of 106 around scene cycles, and returned to 73. In the subsequent 100 rapid round cycles, menu samples retained 50 nodes/31 listeners, and warmed JS heap was approximately 4.28–4.33MB. Owned host/input counts were zero after final disposal.

The initial heap increase may include warmup/caches, but this run does not distinguish those from all retention mechanisms. It must not be reported as proof of leak absence. Longer runs with heap-snapshot attribution, dynamic-image workloads and native/GPU memory tracking remain open. The final wall placement is sampled separately for 60 real-time seconds and the same isolated frame modes; see its raw report and the observations below.

The final-placement report uses source revision 1aee1114407e976974e4f606faa5ae0e6d3172a2. It recorded normal RAF p50/p95 of 33.40/50.00ms. Over 60.14 actual seconds, forced-GC JS heap moved from 3.36MB to 4.12MB; menu-cycle DOM/input cleanup assertions also passed. Its separated CPU/RAF samples are preserved in the raw report rather than generalized to hardware FPS.
