# Tilemap measurements

Measured runtime: `124b3f76f4e5dda1204e04f100bfc6078ed897cc`. 2026-10-28T19:27:41.840Z, Node v24.22.1, Chromium 156.0.8078.4, Linux / AMD EPYC 9V74 80-Core Processor, WebGL/SwiftShader and Canvas2D. No other local tests/builds ran during collection. [Raw samples](../../benchmarks/tilemap/results.json) and `scripts/benchmark-tilemap.mjs` preserve all 72 final runs. The earlier pre-cleanup-guard series is preserved in commit 3f1171f; this final series measures the completed runtime. Host variation between series is not evidence of a speedup/regression.

Three repetitions per size × visibility × update mode × backend. Each run warms five draws and records 20 draws. Logical view 400×300, browser 1440×900/DPR1, 16×16 world-unit cells, one map placement. All-visible centers/zooms the camera to contain the complete map; partial view covers 25×19 cells (475 Sprites). Construction includes input Grid allocation plus validated copy/counts; preparation awaits the image and includes initial visible Sprite creation and CPU first-render submission. CPU update/draw includes eight real visible cell changes in dynamic mode. Per-run p50 is the ordinary median of the 20 raw samples; p95 uses nearest rank (index 18). Both derived statistics are computed from the retained raw timings. Disposal measures map disposal, not Game/context teardown. Timings are medians of the three per-run medians (p95 is median of per-run nearest-rank 95th percentiles). No GPU completion fence, FPS, native/GPU memory measurement or engine/library comparison is implied.

## webgl

| Size    | View    | Changes/step | Sprites | Construct ms | Prepare ms | Update/draw p50 ms | p95 ms | Dispose ms |
| ------- | ------- | ------------ | ------- | ------------ | ---------- | ------------------ | ------ | ---------- |
| 32×32   | all     | 0            | 1024    | 0.40         | 9.80       | 0.00               | 0.20   | 1.50       |
| 32×32   | all     | 8            | 1024    | 0.10         | 5.60       | 0.10               | 0.20   | 1.20       |
| 32×32   | partial | 0            | 475     | 0.10         | 4.30       | 0.00               | 0.10   | 0.50       |
| 32×32   | partial | 8            | 475     | 0.10         | 5.00       | 0.10               | 0.30   | 0.50       |
| 100×100 | all     | 0            | 10000   | 0.50         | 24.30      | 0.00               | 0.10   | 7.90       |
| 100×100 | all     | 8            | 10000   | 0.40         | 13.50      | 0.40               | 0.50   | 4.60       |
| 100×100 | partial | 0            | 475     | 0.50         | 1.80       | 0.00               | 0.10   | 0.30       |
| 100×100 | partial | 8            | 475     | 0.30         | 1.90       | 0.00               | 0.10   | 0.30       |
| 256×256 | all     | 0            | 65536   | 4.50         | 154.30     | 0.00               | 0.10   | 48.60      |
| 256×256 | all     | 8            | 65536   | 2.40         | 146.20     | 2.80               | 6.50   | 60.20      |
| 256×256 | partial | 0            | 475     | 2.30         | 2.20       | 0.00               | 0.10   | 0.20       |
| 256×256 | partial | 8            | 475     | 3.20         | 1.90       | 0.10               | 0.10   | 0.40       |

## canvas

| Size    | View    | Changes/step | Sprites | Construct ms | Prepare ms | Update/draw p50 ms | p95 ms | Dispose ms |
| ------- | ------- | ------------ | ------- | ------------ | ---------- | ------------------ | ------ | ---------- |
| 32×32   | all     | 0            | 1024    | 0.80         | 13.70      | 3.80               | 4.60   | 1.50       |
| 32×32   | all     | 8            | 1024    | 0.20         | 7.50       | 3.80               | 4.10   | 0.50       |
| 32×32   | partial | 0            | 475     | 0.10         | 3.00       | 1.95               | 3.20   | 0.40       |
| 32×32   | partial | 8            | 475     | 0.10         | 3.50       | 2.00               | 3.10   | 0.30       |
| 100×100 | all     | 0            | 10000   | 0.40         | 82.50      | 55.85              | 116.90 | 5.30       |
| 100×100 | all     | 8            | 10000   | 0.70         | 104.20     | 73.60              | 133.30 | 7.60       |
| 100×100 | partial | 0            | 475     | 0.50         | 3.50       | 2.70               | 2.90   | 0.30       |
| 100×100 | partial | 8            | 475     | 0.40         | 3.10       | 1.70               | 2.20   | 0.40       |
| 256×256 | all     | 0            | 65536   | 4.10         | 674.50     | 610.05             | 710.90 | 47.70      |
| 256×256 | all     | 8            | 65536   | 2.30         | 707.00     | 578.75             | 688.50 | 61.30      |
| 256×256 | partial | 0            | 475     | 3.40         | 3.80       | 2.60               | 2.70   | 0.40       |
| 256×256 | partial | 8            | 475     | 3.50         | 3.90       | 2.70               | 2.80   | 0.40       |

## Work and resource counts

- All runs: exactly one internal Actor per map, one base image/TextureSource, one image lease. Visible frame views share that source; static maps display one crop Texture, dynamic maps two. Final map release returns base Texture/image-reference counts to zero. Scene/browser fixtures additionally assert Game and presentation cleanup.
- Static stable view: zero cell visits/updates over the 20 measured draws. Dynamic: 160 visits/updates total (eight per draw), for every size and backend. These are tile-content reconciliation counts, not GPU vertex uploads or Pixi internal traversal counts.
- Offscreen edits produce no visible cell visits; they are realized when entering view. Used-frame validation runs over unique current IDs on a content revision and caches decoded rectangles.
- A changed visible tile rectangle scans the visible range and removes outgoing Sprites. This implementation does not yet optimize camera scrolling to incoming strips or reuse a Sprite pool. Full-map initialization/data storage remains O(width×height); fill scans data and invalidates the visible range.
- Browser performance.now resolution is approximately 0.1ms here. WebGL p50 values printed as 0.00 mean below clock resolution, not zero work. Consecutive CPU submissions can queue GPU work; these timings do not establish real-time frame rate.
- Canvas2D all-visible cost grows sharply: 65,536 independent visible Sprite draws are unsuitable for smooth real-time use on this software environment. The partial-view workload bounds object count regardless of map extent, but still draws all visible Sprites each frame. GPU geometry/chunk caches or a measured external tile renderer are future candidates for large all-visible scenes.
- A cached crop remains until its base image loses its final lease, matching SpriteSheet semantics. Dynamically creating unbounded new rectangles/IDs on a permanently referenced sheet can retain crop views. Hidden/disabled/empty maps retain their declared sheet lease.

## Reproduce

```sh
CHROMIUM_PATH=/path/to/chrome-headless-shell node scripts/benchmark-tilemap.mjs benchmarks/tilemap/results.json
```

Run alone. The script starts its own Vite server on port 4173, validates expected Sprite/visit/resource counts, and fails on fixture/page errors. It does not change runtime dependencies.

## Rectangle collision search

CPU-only measurements on Node v24.22.1, Linux / AMD EPYC 9V74. No renderer/browser, FPS or GPU measurements are implied. The same harness measured baseline Core `d17cdf9b6ef7e33e61576c4ed24cbfcc837c38eb` and current Core `9132f79a78c23ed6cd6ad8efdc881dc9282c7749`. No other local tests/builds ran during collection. [Baseline raw data](../../benchmarks/tile-index/baseline.json) and [current raw data](../../benchmarks/tile-index/current.json) include every sample, construction/cold-step times, update samples, diagnostics and forced-GC heap deltas.

Each case warms 15 steps and records 40 steps at 1/60s, then 40 alternating single-cell edits plus zero-second collision steps. Cell dimensions 24×16. Small-wall uses 32 dynamic circles of radius 10 beside vertical walls; wide-sparse uses eight rotated 384×12 Trigger boxes across wall columns every 16 cells; filtered-dense uses eight radius-160 circles whose masks reject a completely filled map; dense-trigger uses eight radius-80 Trigger circles inside filled terrain. Actor masks reject Actor/Actor pairs. P50/p95 use nearest rank. All times below are p50 milliseconds per Engine.step.

| Map     | Workload       | Baseline cells | Current cells | Current rectangles | Cached cells → rectangles |
| ------- | -------------- | -------------: | ------------: | -----------------: | ------------------------: |
| 32×32   | small-wall     |         0.2255 |        0.2462 |             0.2826 |                    32 → 2 |
| 32×32   | wide-sparse    |         0.0791 |        0.0819 |             0.0492 |                    32 → 2 |
| 32×32   | filtered-dense |         0.1364 |        0.1788 |             0.0277 |                   512 → 2 |
| 32×32   | dense-trigger  |         0.2769 |        0.2995 |             0.3194 |                   512 → 2 |
| 128×128 | small-wall     |         0.1430 |        0.1522 |             0.1902 |                  544 → 34 |
| 128×128 | wide-sparse    |         0.0362 |        0.0454 |             0.0649 |                  224 → 14 |
| 128×128 | filtered-dense |         0.1259 |        0.1352 |             0.0127 |                 4096 → 16 |
| 128×128 | dense-trigger  |         0.2319 |        0.3511 |             0.3147 |                 2816 → 11 |
| 512×512 | small-wall     |         0.1114 |        0.1359 |             0.2515 |                  544 → 34 |
| 512×512 | wide-sparse    |         0.0360 |        0.0451 |             0.0634 |                  224 → 14 |
| 512×512 | filtered-dense |         0.1238 |        0.1613 |             0.0138 |                 4352 → 17 |
| 512×512 | dense-trigger  |         0.2010 |        0.3779 |             0.3205 |                 2816 → 11 |

The favorable filtered-dense case eliminates repeated per-cell policy work by rejecting whole equal-policy rectangles. Wide-sparse results vary by footprint and size. Small-wall index overhead is consistently unfavorable here; dense touching Triggers still expand cells to preserve exact contact payloads. Therefore `tileSearch:"cells"` remains the default. These short CPU series show environment/JIT variation as well as implementation effects; baseline/current cell timings are not identical, and they do not establish a universal regression or speedup. Changing just map extent does not imply more collision work when query footprints remain local.

Single-cell edits rebuilt at most one 256-cell chunk in every measured indexed case. Cached cells/regions describe only queried chunks, not total map coverage. A full 512×512 map has 262,144 cells; the filtered-dense run cached 4,352 collidable cells as 17 rectangles. No per-cell Actor/Collider existed before or after this change; region reduction is candidate-index geometry reduction, not a claim of 256× fewer narrow phases, response corrections or events. The index is additive memory: raw signed forced-GC heap deltas are noisy, and fixtures still retain disposed map/Actor references, so they are not a leak proof or total process/GPU memory measurement. Exact cache/contact/image-reference cleanup is tested separately.

Reproduce on the committed source, with no concurrent tests/builds:

```sh
node --expose-gc scripts/benchmark-tile-index.mjs --out /tmp/tile-index-current.json
git worktree add --detach ../Simpludify-baseline d17cdf9b6ef7e33e61576c4ed24cbfcc837c38eb
node --expose-gc scripts/benchmark-tile-index.mjs --core ../Simpludify-baseline/packages/core/src/index.ts --baseline --out /tmp/tile-index-baseline.json
```

The harness loads each Core directly using Vite SSR; no browser or image decode is involved. It asserts cache/contact release after disposal and retains the exact measured Core SHA. Re-run multiple series on deployment hardware before selecting a search mode; wall-clock microbenchmarks are not CI performance thresholds.
