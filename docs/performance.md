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

Heap values are sampled without forced GC. Browser memory reporting was coarse/constant in this environment; it cannot demonstrate retained-memory stability. Short idle/active samples of 300 frames are recorded, but a long-running soak test remains pending. Scene cleanup correctness is additionally asserted in browser tests.

CPU/GPU load, actual dropped frames, startup latency and input latency were not measured. No Godot/Phaser comparator has been implemented. Run controlled-hardware benchmarks, a production-build browser benchmark, detailed memory instrumentation and an extended active/idle soak before performance claims or optimization targets are chosen. Future baselines must separate CPU simulation cost, UI/layout cost, GPU work and device/refresh-rate limits.
