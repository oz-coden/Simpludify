# Tilemap measurements

Measured runtime: `9f83fbeec13fc47fc671aa8674d0256c3c29a8a7`. 2026-10-28T19:08:07.081Z, Node v24.22.1, Chromium 156.0.8078.4, Linux, WebGL/SwiftShader and Canvas2D. No other local tests/builds ran during collection. [Raw samples](../benchmarks/tilemap/results.json) and `scripts/benchmark-tilemap.mjs` preserve all 72 runs.

Three repetitions per size × visibility × update mode × backend. Each run warms five draws and records 20 draws. Logical view 400×300, browser 1440×900/DPR1, 16×16 world-unit cells, one map placement. All-visible centers/zooms the camera to contain the complete map; partial view covers 25×19 cells (475 Sprites). Construction includes input Grid allocation plus validated copy/counts; preparation awaits the image and includes initial visible Sprite creation and CPU first-render submission. CPU update/draw includes eight real visible cell changes in dynamic mode. Disposal measures map disposal, not Game/context teardown. Timings are medians of the three per-run medians (p95 is median of per-run sample maxima). No GPU completion fence, FPS, native/GPU memory measurement or engine/library comparison is implied.

## webgl

| Size    | View    | Changes/step | Sprites | Construct ms | Prepare ms | Update/draw p50 ms | p95 ms | Dispose ms |
| ------- | ------- | ------------ | ------- | ------------ | ---------- | ------------------ | ------ | ---------- |
| 32×32   | all     | 0            | 1024    | 0.50         | 7.20       | 0.00               | 0.20   | 1.30       |
| 32×32   | all     | 8            | 1024    | 0.20         | 5.20       | 0.10               | 0.40   | 1.10       |
| 32×32   | partial | 0            | 475     | 0.20         | 3.80       | 0.00               | 0.10   | 0.60       |
| 32×32   | partial | 8            | 475     | 0.10         | 5.20       | 0.10               | 0.40   | 0.60       |
| 100×100 | all     | 0            | 10000   | 0.70         | 19.40      | 0.00               | 0.10   | 10.10      |
| 100×100 | all     | 8            | 10000   | 0.50         | 18.90      | 0.50               | 1.40   | 7.80       |
| 100×100 | partial | 0            | 475     | 0.30         | 1.80       | 0.00               | 0.10   | 0.40       |
| 100×100 | partial | 8            | 475     | 0.30         | 2.00       | 0.00               | 0.20   | 0.30       |
| 256×256 | all     | 0            | 65536   | 3.90         | 149.10     | 0.00               | 0.10   | 47.10      |
| 256×256 | all     | 8            | 65536   | 2.60         | 156.70     | 2.70               | 7.10   | 63.90      |
| 256×256 | partial | 0            | 475     | 2.30         | 1.90       | 0.00               | 0.10   | 0.20       |
| 256×256 | partial | 8            | 475     | 2.50         | 1.80       | 0.10               | 0.20   | 0.20       |
## canvas

| Size    | View    | Changes/step | Sprites | Construct ms | Prepare ms | Update/draw p50 ms | p95 ms | Dispose ms |
| ------- | ------- | ------------ | ------- | ------------ | ---------- | ------------------ | ------ | ---------- |
| 32×32   | all     | 0            | 1024    | 0.40         | 18.30      | 4.40               | 6.20   | 1.90       |
| 32×32   | all     | 8            | 1024    | 0.10         | 7.40       | 4.30               | 4.90   | 0.80       |
| 32×32   | partial | 0            | 475     | 0.20         | 2.90       | 1.80               | 2.10   | 0.30       |
| 32×32   | partial | 8            | 475     | 0.00         | 3.10       | 1.80               | 2.00   | 0.20       |
| 100×100 | all     | 0            | 10000   | 0.50         | 74.20      | 50.00              | 122.60 | 5.70       |
| 100×100 | all     | 8            | 10000   | 0.60         | 100.20     | 74.70              | 158.90 | 6.10       |
| 100×100 | partial | 0            | 475     | 0.50         | 4.60       | 2.80               | 3.30   | 0.40       |
| 100×100 | partial | 8            | 475     | 0.60         | 4.30       | 2.80               | 3.90   | 0.30       |
| 256×256 | all     | 0            | 65536   | 4.40         | 699.00     | 616.10             | 721.60 | 57.90      |
| 256×256 | all     | 8            | 65536   | 4.20         | 824.50     | 616.10             | 714.60 | 42.40      |
| 256×256 | partial | 0            | 475     | 2.60         | 3.50       | 2.50               | 3.80   | 0.30       |
| 256×256 | partial | 8            | 475     | 2.50         | 5.10       | 1.80               | 4.20   | 0.30       |

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
