# Collision Solver measurements

This report measures the **formal CollisionWorld through Engine.step**, including contact bookkeeping and event delivery. It is separate from the historical isolated candidate-search comparison. Raw [summary and source metadata](../benchmarks/tile-collision/results.json) links six per-workload raw sample files.

## Method and reproduction

```sh
npm ci
# Commit/push current work first; the harness rejects a dirty worktree.
node scripts/benchmark-tile-collision.mjs
```

Measured source: `12255c346f3ce0da5f4313c7ca2206e1041543a2`, clean at start. Linux, Node v24.22.1, AMD EPYC 9V74 80-Core Processor, 2026-10-29. No other local test/build ran during measurement. Shared host/JIT timings are observations, not FPS or hardware guarantees.

3 map sizes (32²/100²/256²) × dense/scattered × 1/128 Actors × static/eight edits per step × three repetitions = **72 plain runs**, each paired with a separate instrumented run. Ten warmups + twenty recorded steps per run; **2880 raw recorded passes** across plain/instrumented paths. All recorded deterministic counters match between those two paths. A further **96 straight-wall/convex-corner trajectory scenarios** compare terrain with a single ordinary Actor wall, both aspect ratios and movement directions; maximum observed difference is **1.5631940186722204e-13 world units**, with zero unresolved contacts in those scenarios. The acceptance threshold remains 1e-6.

Dense maps are 75% Solid with one empty corridor row per four rows. Scattered maps use a deterministic coordinate hash (1/8 occupancy, excluding corridor rows). A radius-10 dynamic circle is reset outside the timed region to press two units into a floor; x varies deterministically. These endpoint poses make repeated correction work comparable. This is not full gameplay/CCD or a claim of recovering arbitrary fully embedded bodies. Actor layer1/mask2 and terrain layer2/mask1 exclude Actor/Actor narrow tests while preserving its real broad-phase cost. Existing mixed/mass/Actor behavior has separate regression tests.

Map build time includes input Grid generation, initial Solid/floor inventory and Tilemap's copied-grid validation. Actor build includes components/event subscriptions. First step (in JSON) includes reconciliation/pair creation. Updates toggle eight distinct image cells between Solid ID0 and null, with no renderer subscriptions. Plain Engine.step includes real policy lookup, narrow phase, iterative correction, pair transitions, and Enter/Stay/Exit handlers that increment counts. Pose resets and diagnostic reads occur outside its timing region.

Instrumented runs wrap private capture/scanActors/scanTiles/correct/deliver methods in the benchmark only. Core has no host clock or public profiling dependency. Query timings include filters, narrow phase and contact recording; response includes recomputation/features/translation; delivery includes pair retirement and handlers. Per-call clock/wrapper overhead affects instrumented observations. **Do not add profiled phase medians to plain step times** or interpret them as zero-overhead production costs. Unattributed Engine/control overhead remains outside those phase buckets.

p50 is the ordinary median of twenty raw samples, p95 nearest rank ceil(.95*n)-1. Tables below take the median of three run statistics. No GC/native/GPU byte measurement or long soak was performed.

## Work counts and resources

For the first recorded static pass, one Actor examines **6 candidate cells**, performs 3 query narrow tests + 2 response recomputations, one correction and one Stay notification, independent of map size. The two solver passes and final scan explain repeated visits; these are not six unique cells.

128 Actors in the first recorded static pass examine **1218 candidate cells** for all three map sizes. Dense terrain has 609 query narrow tests, scattered 384; each has 256 response recomputations, 128 corrections, 128 contacts and 128 notifications. Query filters/empty cells are counted independently. Some later poses can have different candidate/contact counts, retained exactly in raw samples. Dynamic edits change these observations and generate normal Enter/Exit transitions; no artificial event count is inferred from Sprite/rectangle counts.

The 256² dense map has 65536 image cells / 49152 initial Solid cells; scattered has 6144 initial Solid cells. Neither total is a collision query budget. One placement Actor and the population's ordinary Actors exist; no per-cell Actor/Collider is allocated. Geometry retention is limited to currently observed cells and shared by contacts. Every measured disposal leaves **zero Scene Actors, reconciled maps, contacts, retained cell geometries and input sources**. This establishes logical owner cleanup, not absence of every possible managed/native leak. Texture/GPU resources are absent in this Core benchmark and verified separately in browser fixtures.

All these controlled workloads recorded zero unresolved movable contacts. Fully embedded terrain deliberately has an unresolved unit regression, so zero here is not a general convergence claim.

## Plain step/build/disposal observations

All times ms. edit=8 means eight cell toggles per step; 0 means static map. The smallest values are sensitive to JIT/timer noise.

| map  | distribution | Actors | edit | map build | Actor build | edit p50 | step p50 | step p95 | dispose |
| ---- | ------------ | -----: | ---: | --------: | ----------: | -------: | -------: | -------: | ------: |
| 32²  | dense        |      1 |    0 |    0.1382 |      0.0139 |   0.0001 |   0.0038 |   0.0053 |  0.0248 |
| 32²  | dense        |      1 |    8 |    0.1979 |      0.0092 |   0.0018 |   0.0040 |   0.0088 |  0.0179 |
| 32²  | dense        |    128 |    0 |    0.0636 |      0.6815 |   0.0001 |   0.4046 |   0.5038 |  0.2652 |
| 32²  | dense        |    128 |    8 |    0.1445 |      0.3924 |   0.0016 |   0.4030 |   0.5688 |  0.4455 |
| 32²  | scattered    |      1 |    0 |    0.1879 |      0.0169 |   0.0001 |   0.0058 |   0.0104 |  0.0353 |
| 32²  | scattered    |      1 |    8 |    0.0691 |      0.0060 |   0.0016 |   0.0050 |   0.0074 |  0.0226 |
| 32²  | scattered    |    128 |    0 |    0.0538 |      0.4089 |   0.0001 |   0.5310 |   0.6667 |  0.2968 |
| 32²  | scattered    |    128 |    8 |    0.0902 |      0.3275 |   0.0016 |   0.4612 |   0.5638 |  0.3126 |
| 100² | dense        |      1 |    0 |    0.5353 |      0.0111 |   0.0001 |   0.0039 |   0.0044 |  0.0204 |
| 100² | dense        |      1 |    8 |    0.4316 |      0.0050 |   0.0012 |   0.0037 |   0.0040 |  0.0116 |
| 100² | dense        |    128 |    0 |    0.4521 |      0.2722 |   0.0001 |   0.3539 |   0.4635 |  0.2736 |
| 100² | dense        |    128 |    8 |    0.4884 |      0.3577 |   0.0016 |   0.3658 |   0.5390 |  0.3487 |
| 100² | scattered    |      1 |    0 |    0.3871 |      0.0122 |   0.0001 |   0.0035 |   0.0038 |  0.0194 |
| 100² | scattered    |      1 |    8 |    0.3803 |      0.0045 |   0.0012 |   0.0036 |   0.0042 |  0.0126 |
| 100² | scattered    |    128 |    0 |    0.3237 |      0.2892 |   0.0001 |   0.3634 |   0.4325 |  0.2559 |
| 100² | scattered    |    128 |    8 |    0.3738 |      0.2847 |   0.0017 |   0.3694 |   0.4373 |  0.2533 |
| 256² | dense        |      1 |    0 |    3.3990 |      0.0153 |   0.0001 |   0.0039 |   0.0044 |  0.0214 |
| 256² | dense        |      1 |    8 |    3.2740 |      0.0109 |   0.0012 |   0.0038 |   0.0042 |  0.0204 |
| 256² | dense        |    128 |    0 |    3.3592 |      0.3608 |   0.0001 |   0.3538 |   0.4805 |  0.3532 |
| 256² | dense        |    128 |    8 |    3.3964 |      0.3190 |   0.0016 |   0.3536 |   0.4139 |  0.3817 |
| 256² | scattered    |      1 |    0 |    2.6522 |      0.0128 |   0.0001 |   0.0035 |   0.0036 |  0.0204 |
| 256² | scattered    |      1 |    8 |    2.3570 |      0.0094 |   0.0008 |   0.0035 |   0.0038 |  0.0190 |
| 256² | scattered    |    128 |    0 |    2.4383 |      0.3057 |   0.0001 |   0.3256 |   0.4014 |  0.3282 |
| 256² | scattered    |    128 |    8 |    2.5578 |      0.4787 |   0.0011 |   0.3340 |   0.4875 |  0.3610 |

## Instrumented phase observations

256² / 128 Actors; medians of three run p50 values, ms. These are separately instrumented runs, not a decomposition of the plain table above.

| distribution | edit | capture | Actor query | tile query/record | response | delivery |
| ------------ | ---: | ------: | ----------: | ----------------: | -------: | -------: |
| dense        |    0 |  0.0457 |      0.0113 |            0.1408 |   0.0961 |   0.0439 |
| dense        |    8 |  0.0481 |      0.0118 |            0.1379 |   0.0964 |   0.0432 |
| scattered    |    0 |  0.0464 |      0.0197 |            0.1161 |   0.0931 |   0.0454 |
| scattered    |    8 |  0.0488 |      0.0197 |            0.1158 |   0.0936 |   0.0459 |

## Limits and optimization decision

Direct local lookup remains the implementation. At the same Actor population/footprint, measured steady query counts do not grow with map size; construction still scales with copied Grid data. Eight edits do not rebuild a map-wide collision structure. No measured need for rectangle merging/chunks was established in these workloads, and no superiority claim against a production merged solver is made.

Large Actors/Triggers, many independent or overlapping maps, mixed terrain policies, deep penetration, large crowds and unfavorable Actor sweep distributions need separate measurements. Actor X sweep can still be quadratic, and a per-cell event contract retains state proportional to actual cell contacts. The previous isolated search report illustrates those tradeoffs but is not substituted for the full measurements here.

Different response/layer/mask neighbors keep independent boundary features. Discrete endpoint detection can tunnel at high speed. Static map translation does not transfer platform velocity. Bounded response does not guarantee escape from fully embedded interiors or impossible gaps. Browser tests establish WebGL/Canvas2D behavior on software Chromium at two viewport sizes, not real GPU/mobile/other-browser performance. Native memory and long-session stability remain future work.
