# Tilemap measurements

Measured runtime: `124b3f76f4e5dda1204e04f100bfc6078ed897cc`. 2026-10-28T19:27:41.840Z, Node v24.22.1, Chromium 156.0.8078.4, Linux / AMD EPYC 9V74 80-Core Processor, WebGL/SwiftShader and Canvas2D. No other local tests/builds ran during collection. [Raw samples](../benchmarks/tilemap/results.json) and `scripts/benchmark-tilemap.mjs` preserve all 72 final runs. The earlier pre-cleanup-guard series is preserved in commit 3f1171f; this final series measures the completed runtime. Host variation between series is not evidence of a speedup/regression.

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
