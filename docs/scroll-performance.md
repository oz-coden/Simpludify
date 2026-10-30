# Scroll projection measurements

This measures Core offset update plus `CanvasUI.layout` projection flush, **not Pixi, GPU, native mirrors or end-to-end input latency**. Both runs used Node v24.22.1 on Linux, AMD EPYC 9V74, 9 exposed logical CPUs. No other local tests/builds ran during recording.

The workload creates 100/1000/5000 labels at fixed 28-unit height, 2-unit gap and a 300-unit vertical viewport. After initial layout it performs 10 warmups and 100 measured `scrollTo(0,120+i)` + flush operations. Values below are milliseconds per operation. Raw arrays and noisy post-GC retained-heap deltas are saved in `benchmarks/canvas-scroll`; the heap delta is not peak allocation or a leak proof.

| Rows | Before p50 | After p50 | Before p95 | After p95 |
| ---- | ---------- | --------- | ---------- | --------- |
| 100  | 0.150      | 0.010     | 0.296      | 0.034     |
| 1000 | 0.727      | 0.083     | 1.391      | 0.268     |
| 5000 | 3.523      | 0.513     | 5.963      | 0.992     |

Before: checkpoint `e2f37eb` with unchanged baseline engine source `c9f5252`; 100 Flex layouts and rows*100 measure callbacks per size. After: source `7672415` (`final-source.json`); zero Flex layouts and zero measure callbacks for offset-only updates. This demonstrates removal of repeated layout/measurement, not superiority over another engine or constant-time large-list rendering. The 5000-row median improved by about 6.9x in this workload; projection still traverses all rows.

Baseline command was `node --expose-gc /tmp/scroll-benchmark.mjs /tmp/scroll-before.json`. Its workload is preserved as `scripts/benchmark-scroll.mjs`, using the normal Vite import and an additional clean-checkpoint assertion. Revised command: `node --expose-gc scripts/benchmark-scroll.mjs /tmp/scroll-after.json`. Run this only after committing/pushing a clean checkpoint. The earlier `df46850` run is retained as `after.json` (5000-row p50 0.451ms); the table uses the later run instead of selecting the fastest result. Source changes after `7672415` affect pending input arbitration/tests and documentation, not the measured projection path. Final source runs and any changed numbers are recorded in [the work report](work-reports/2026-10-30-scroll-input.md).

Web code also separates appearance, mask and scrollbar signatures from position changes. Real renderer regression tests exercise pixel output, clipping, inputs and cleanup. No before/after browser/GPU timing comparison was recorded, so the table must not be read as a GPU frame-rate improvement. Lists are not virtualized; large numbers of visible Text/Graphics and semantic controls still have renderer/DOM cost.
