import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { createServer } from "vite";

if (!global.gc) throw new Error("Run with node --expose-gc");
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
let Grid;
try {
  ({ Grid } = await server.ssrLoadModule(
    "/packages/core/src/foundation/grid.ts",
  ));
} finally {
  await server.close();
}
const modes = ["flat", "nested", "grid"],
  warmups = 2,
  runs = 7;
const sizes = [
  [10, 20],
  [128, 128],
  [1024, 1024],
];
let checksum = 0;
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
function allocate(mode, width, height, generate = false) {
  if (mode === "grid")
    return generate
      ? Grid.generate(width, height, (x, y) => x + y)
      : new Grid(width, height, 0);
  if (mode === "nested") {
    const rows = Array.from({ length: height }, () => new Array(width).fill(0));
    if (generate)
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) rows[y][x] = x + y;
    return rows;
  }
  const cells = new Array(width * height).fill(0);
  if (generate)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) cells[y * width + x] = x + y;
  return cells;
}
function last(mode, data, width, height) {
  return mode === "grid"
    ? data.get(width - 1, height - 1)
    : mode === "nested"
      ? data[height - 1][width - 1]
      : data[data.length - 1];
}
const rows = [];
for (const [width, height] of sizes) {
  const cells = width * height;
  const repeats = Math.max(1, Math.ceil(262144 / cells));
  const workloads = [
    "initialize-value",
    "initialize-factory",
    "get-set",
    "scan",
    "fill",
  ];
  for (const workload of workloads) {
    const creating = workload.startsWith("initialize");
    const samples = new Map(modes.map((mode) => [mode, []]));
    const data = new Map(
      modes.map((mode) => [
        mode,
        creating ? undefined : allocate(mode, width, height),
      ]),
    );
    function measure(mode) {
      let current = data.get(mode),
        observed = 0;
      global.gc();
      const start = performance.now();
      for (let repeat = 0; repeat < repeats; repeat++) {
        if (workload.startsWith("initialize")) {
          current = allocate(
            mode,
            width,
            height,
            workload === "initialize-factory",
          );
          observed += last(mode, current, width, height);
        } else if (workload === "fill") {
          const value = repeat + 1;
          if (mode === "grid") current.fill(value);
          else if (mode === "flat") current.fill(value);
          else for (const row of current) row.fill(value);
          observed += last(mode, current, width, height);
        } else if (workload === "scan") {
          if (mode === "grid")
            current.forEach((value) => {
              observed += value;
            });
          else if (mode === "flat")
            for (let i = 0; i < cells; i++) observed += current[i];
          else
            for (const row of current)
              for (let x = 0; x < width; x++) observed += row[x];
        } else {
          for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
              if (mode === "grid") {
                const value = current.get(x, y) + 1;
                current.set(x, y, value);
                observed += value;
              } else if (mode === "flat") {
                const index = y * width + x,
                  value = current[index] + 1;
                current[index] = value;
                observed += value;
              } else {
                const value = current[y][x] + 1;
                current[y][x] = value;
                observed += value;
              }
            }
        }
      }
      const elapsed = performance.now() - start;
      if (!creating) data.set(mode, current);
      checksum += observed;
      return elapsed / repeats;
    }
    // Nonzero scan values keep work observable; all modes begin with the same data.
    if (workload === "scan")
      for (const mode of modes)
        data.set(mode, allocate(mode, width, height, true));
    for (let i = 0; i < warmups; i++) for (const mode of modes) measure(mode);
    for (let i = 0; i < runs; i++)
      for (let offset = 0; offset < modes.length; offset++) {
        const mode = modes[(i + offset) % modes.length];
        samples.get(mode).push(measure(mode));
      }
    for (const mode of modes) {
      const values = samples.get(mode);
      assert(values.every(Number.isFinite));
      rows.push({
        width,
        height,
        cells,
        workload,
        mode,
        repeats,
        samplesMsPerPass: values,
        medianMs: median(values),
        minimumMs: Math.min(...values),
        maximumMs: Math.max(...values),
      });
    }
  }
}
const memory = [];
// A separate call frame prevents a prior iteration's temporary references from
// surviving into the next baseline in the module's interpreter registers.
function memorySample(mode, width, height) {
  global.gc();
  const before = process.memoryUsage().heapUsed;
  const retained = allocate(mode, width, height);
  global.gc();
  const bytes = process.memoryUsage().heapUsed - before;
  checksum += last(mode, retained, width, height);
  return bytes;
}
for (const [width, height] of sizes)
  for (const mode of modes) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      samples.push(memorySample(mode, width, height));
    }
    memory.push({
      width,
      height,
      mode,
      samplesHeapBytes: samples,
      medianHeapBytes: median(samples),
    });
    if (width * height >= 16384)
      assert(
        median(samples) > width * height,
        "Memory probe lost its retained array",
      );
  }
assert(Number.isFinite(checksum) && checksum > 0);
const report = {
  environment: {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    cpu: cpus()[0]?.model,
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    gridSourceSha256: createHash("sha256")
      .update(readFileSync("packages/core/src/foundation/grid.ts"))
      .digest("hex"),
  },
  conditions: {
    warmups,
    runs,
    memoryRuns: 5,
    batchMinimumCells: 262144,
    timing:
      "Milliseconds per complete grid pass. 2 warmups/7 samples, rotated mode order. GC before each batch, outside timing. Allocation GC during a batch remains included. Vite SSR loads the actual TypeScript before timing; server is closed before measurement. No concurrent local tests/builds.",
    comparison:
      "Flat/nested arrays use direct unchecked access and direct loops; Grid get/set validate both coordinates. Grid scan uses callbacks, unlike direct-array scan. All factory modes include an initial filled allocation before generation. Numeric cells only.",
    memory:
      "Forced-GC Node heapUsed differences with one retained grid in a separate call frame per sample, returned only as a byte count so prior sample arrays cannot survive in loop temporaries. Small deltas may be negative/noisy. Includes Array/container overhead, not object payloads/native/GPU memory or leak proof. Not reserved physical RAM.",
    scope:
      "Single shared-host process; no browser/FPS/GPU conclusions. Size cap is an API allocation bound, not an available-memory guarantee.",
  },
  checksum,
  rows,
  memory,
};
const index = process.argv.indexOf("--out"),
  output = index < 0 ? undefined : process.argv[index + 1];
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
