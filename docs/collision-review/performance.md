# Collision search measurements and response probes

Status: isolated design evidence, not production Tilemap collision throughput. Full raw data is [results.json](../../benchmarks/collision-design/results.json), with the twelve linked `samples/` files. Measured source: `1d1d0c018a7fea44d1b24dc7e538f55ecf088b66`, clean worktree at start. No other local test/build ran during measurement.

## Reproduction and scope

```sh
npm ci
# Commit and push changes first; the harness rejects a dirty worktree.
node scripts/benchmark-collision-design.mjs
```

Linux / Node v24.22.1 / AMD EPYC 9V74 80-Core Processor, shared host, 2026-10-29. Vite loads the isolated TypeScript probes, not a browser. 12 workloads × static/eight edits per pass × three strategies × three repetitions = **216 runs**. Ten warmups, twenty measured passes each. Strategy timing order rotates by repetition. Identical deterministic poses, boolean maps and edits are used for every strategy. Hit counts/checksums assert equality every pass; unit tests compare exact cell sets and duplicate exclusion across dense, sparse, stripe, boundary and edited cases.

Maps are 32², 100², 256². Uniform maps are entirely Solid; scattered maps use a coordinate hash modulo eight (exactly 8192 occupied cells in the 256² workload). Actor footprint sides are 1, 8 or 16 cells; populations are 1, 32 or 256. The harness also measures current production Actor sweep distributions separately. Camera, Viewport, rendered tiles and image loads are absent and cannot reduce collision work.

A = direct integer footprint lookup. B = greedy whole-map horizontal-run/vertical-span rectangle merging **with 16-cell spatial buckets**. C = merging only within 16×16 chunks, indexed by those chunks. B is not penalized by an artificial global linear rectangle scan; both merged paths use local buckets and deduplicate rectangle IDs per query. Their rectangle count is not an optimal cover.

All three enumerate the same semantic cell IDs after search: a dense merged rectangle does not erase per-cell event bookkeeping. This comparison measures search + semantic enumeration, **not** circle/OBB narrow-phase savings. B/C cannot be judged by rectangle count alone. Empty cells are not enumerated by B/C, whereas A visits its whole local window. Rectangle tests in B/C are AABB range intersections, not production narrowTests.

Timing separates index construction, eight edit writes/index commit, and all Actor queries/cell enumeration. Input Grid allocation is outside construction timing. No production filtering, manifold calculation, iterative response, contact table, event delivery, browser, GPU or GC/native memory cost is included in the candidate benchmark. Per-pass allocations and counter accumulation are included. Millisecond values are CPU observations, not FPS. The lower-cost rows are sensitive to JIT/order/timer noise; a single small winning row is not evidence of a universal speedup.

Tables below use the median of three run p50 values (ordinary median of twenty raw samples per run); p95 is nearest rank within a run and remains in JSON. Counts are deterministic, while dynamic counts can alternate after edits. Full run tables and limits follow in the final report.

## Response findings

The naive cell response probe uses the **real** `contactManifold` and `correctPositions` with plain shape/position data: no fake tile Actor or Collider instance. A single circle/static cell separates correctly to (-10,16). A continuous vertical tiled wall at x=64 is pressed by an initially tangent radius-10 circle: 60 steps of intended (2,2), six iterations each. Expected tangent y=136; observed y=139.43444369830038, drift **+3.4344436983003845**. No residual penetration is necessary for this error: a neighbor's internal corner can distort the normal. A 20×20 box under the same probe has zero tangent drift. A radius-10 circle embedded at (96,96) in a 6² solid map finishes at (86,106), with one unresolved cell after six iterations.

These are deficiencies of naive future cell response, **not** regressions in current Actor response and not fixed in this design branch. Initial candidate lookup A is recommended, but response must reject internal seam features using eligible neighbor topology, with an explicit acceptance gate. Raising the iteration budget alone is not a seam solution. Deep embedded starts/teleports require diagnostics and documented limits; no unconditional escape guarantee is proposed.
