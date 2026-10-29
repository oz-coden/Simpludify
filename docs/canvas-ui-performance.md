# Canvas UI measurements

Measurement scripts and recorded results will be linked here after the current implementation is validated. No runtime layout dependency has been added. The selected implementation is a bounded Flex subset, not full CSS conformance. Dirty changes traverse the root and hit testing is O(visible nodes); static frames skip layout and visual synchronization.

The baseline for bundle comparison is `89491c638e070c575fcee89cb08635fbaac67f01`. Yoga 3.2.1 is inspected in an isolated temporary directory, not installed into the engine. The published package reports MIT, 224272 unpacked bytes and includes a base64 WebAssembly loader; actual production/gzip comparisons, behavioral comparison and CPU/memory observations are pending. Historical trial sizes in earlier conversations are not current measurements.

## Model measurement checkpoint

[`model.json`](../benchmarks/canvas-ui/model.json) records clean source `a437f49bbf818b4db010a8733392840fb300d32c`, Node 24.22.1/Linux/AMD EPYC 9V74. No other local tests/builds ran during recording. With synthetic fixed text metrics, dirty-layout p50 was 0.0226 / 0.0567 / 0.2681 / 1.3733ms for 10 / 100 / 1000 / 5000 buttons (plus a root). Each recorded row has 10 warmups and 100 samples. Idle calls caused no additional layout. Pointer gesture p50 (down + five moves + up, plus Click delivery) was 0.0169 / 0.0644 / 0.5898 / 3.3369ms; eight hit queries visit 8×(N+1) nodes. These are Node model/router timings, not browser FPS or hardware input latency.

One disposal observation per size was 1.07 / 1.31 / 10.03 / 53.16ms, so large UI teardown is not claimed free. Every recorded disposal has zero UI nodes, subscriptions, captured/suppressed pointers and event listeners. The 100×100-button Scene-cycle forced-GC heap observations are in the raw report (including Vite/tooling and measurement allocations); they do not establish native/GPU memory behavior or leak freedom. The constrained/intrinsic helper counters and depth16/32/64 workload expose extra work in deeply nested trees beyond the arranged-node count.
