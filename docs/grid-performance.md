# Grid performance observations

Recorded on 2026-10-28 with Node 24.22.1, Linux, AMD EPYC 9V74 shared host. [Raw samples](../benchmarks/grid/current.json) preserve environment, source SHA-256, every timing and memory observation. The sourceCommit is the base main bfa2d713; the new Grid source was measured in the working tree and identified separately by its content hash. No engine dependency or production scheduling change is required by the benchmark.

## Reproduce and interpretation

```sh
npm ci
npm run bench:grid -- --out test-results/grid.json
```

The harness loads the actual TypeScript using Vite SSR, closes the server, then measures synchronous Node operations. Do not run other local tests/builds during the recorded benchmark. It uses numeric cells, 2 warmups and 7 measured samples per workload/mode. Mode order rotates each round. A batch covers at least 262,144 cell operations, and results divide by repeated complete grid passes. GC runs before each batch outside timing; any GC during allocation batches remains included. This is one shared-host process, not a hardware-controlled statistical comparison or a game FPS/GPU test.

Flat/nested arrays use direct unchecked access. Grid get/set validate both integer coordinates. Direct scans use loops; Grid scans use the callback API. Therefore this compares practical API paths, not equivalent unchecked primitives. All factory modes initialize their backing allocation before assigning generated values. Callback timing and allocation/GC variation are part of these observations. The harness observes read/write results to keep work from being discarded.

## Timing

Milliseconds per complete pass, median of 7. A get-set pass reads and increments every cell; scan sums every cell; fill replaces the whole grid. Ratios at tiny sizes are especially noisy. The raw file includes minimum, maximum and all samples.

| Size      | Workload           | Flat Array ms | Nested Array ms |  Grid ms |
| --------- | ------------------ | ------------: | --------------: | -------: |
| 10×20     | initialize-value   |      0.000638 |        0.003039 | 0.000794 |
| 10×20     | initialize-factory |      0.000803 |        0.003301 | 0.001071 |
| 10×20     | get-set            |      0.000800 |        0.001228 | 0.004070 |
| 10×20     | scan               |      0.000539 |        0.000685 | 0.000848 |
| 10×20     | fill               |      0.000388 |        0.001363 | 0.000397 |
| 128×128   | initialize-value   |      0.073352 |        0.049679 | 0.078269 |
| 128×128   | initialize-factory |      0.098938 |        0.101027 | 0.175055 |
| 128×128   | get-set            |      0.068827 |        0.073696 | 0.101747 |
| 128×128   | scan               |      0.042609 |        0.045800 | 0.065335 |
| 128×128   | fill               |      0.026487 |        0.037137 | 0.026170 |
| 1024×1024 | initialize-value   |      3.868920 |        2.224163 | 3.829912 |
| 1024×1024 | initialize-factory |      4.938969 |        3.604339 | 5.299782 |
| 1024×1024 | get-set            |      5.859270 |        6.088298 | 9.815511 |
| 1024×1024 | scan               |      1.626261 |        2.552699 | 3.228396 |
| 1024×1024 | fill               |      1.265138 |        1.320099 | 1.248644 |

At 1,048,576 cells, Grid get/set cost more than unchecked flat access (9.816 versus 5.859ms in this observation); Grid callback scan also cost more (3.228 versus 1.626ms). Value initialization and fill were close to the flat-array paths, while nested initialization was faster in this host/run. No across-the-board speed improvement is claimed. The 1024² Grid get-set samples ranged from 7.424 to 13.952ms, demonstrating that the median is not a frame-time guarantee. Initialization, numeric/range checks, callbacks and shared-host noise should be considered when selecting a data structure. For very hot numeric kernels, application-owned direct or typed arrays remain reasonable alternatives; Grid does not publish an unsafe backing-array escape solely to improve a benchmark.

## Retained JavaScript heap

Five separate forced-GC samples per size/mode. Each sample holds one array/grid in its own call frame and returns only the byte count, preventing prior-loop temporary references from corrupting the next baseline. Medium/large samples are checked to ensure the retained array was actually observed. Values below are median heapUsed deltas in bytes, not reserved physical memory.

| Size      | Flat bytes | Nested bytes | Grid bytes |
| --------- | ---------: | -----------: | ---------: |
| 10×20     |      1,664 |        2,880 |      1,720 |
| 128×128   |    131,136 |      138,400 |    131,192 |
| 1024×1024 |  8,388,672 |    8,445,856 |  8,388,728 |

In this numeric-cell observation the single-array Grid retained approximately the same heap as a flat Array; nested arrays added row-container overhead. Grid still adds a small object/metadata cost, and numeric cells do not represent arbitrary object payloads. Small heap deltas are sensitive to allocator/GC noise; raw negative/noisy samples must not be interpreted as negative memory use. No native/browser/GPU memory, process RSS allocation policy, leakage, sparse data behavior or long-running game session is established. The dense cell limit is an input bound, not a memory-availability guarantee.

## Scope decisions

A private flat Array keeps coordinate indexing and full traversal simple without row objects. Grid pays explicit validation rather than silently accepting bad coordinates. No stride framework, NDArray abstraction, control rights, sparse storage, custom allocator or renderer is introduced. Blockfall keeps its current row-based representation because its row filtering/splicing would not become simpler by migrating. The [placement example and contracts](grid.md) demonstrate an independent dense-grid use instead.
