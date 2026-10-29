import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

assert(global.gc, "Run with --expose-gc");
assert.equal(
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  "",
  "Commit and push before measuring",
);
const yogaPath = resolve(process.argv[2] ?? "/tmp/simpludify-yoga/package");
const out = process.argv[3] ?? "/tmp/ui-layout-comparison.json";
const temp = "/tmp/simpludify-layout-comparison";
mkdirSync(temp, { recursive: true });
const root = resolve(".");
const entries = {
  custom: `export {wrapCanvasText} from ${JSON.stringify(`${root}/packages/core/src/ui/canvas-text.ts`)}; export {layoutCanvas} from ${JSON.stringify(`${root}/packages/core/src/ui/canvas-layout.ts`)}; export * from ${JSON.stringify(`${root}/packages/core/src/ui/canvas-node.ts`)}; export {CanvasUI} from ${JSON.stringify(`${root}/packages/core/src/ui/canvas-ui.ts`)}; export {Scene} from ${JSON.stringify(`${root}/packages/core/src/index.ts`)};`,
  yoga: `export {default as Yoga} from ${JSON.stringify(`${yogaPath}/dist/src/index.js`)};`,
};
const modules = {},
  bundles = {},
  startup = {};
for (const [name, source] of Object.entries(entries)) {
  const entry = `${temp}/${name}-entry.mjs`;
  writeFileSync(entry, source);
  await build({
    configFile: false,
    logLevel: "error",
    resolve: {
      alias: { "@simpludify/core": `${root}/packages/core/src/index.ts` },
    },
    build: {
      outDir: `${temp}/${name}`,
      emptyOutDir: true,
      minify: true,
      lib: { entry, formats: ["es"], fileName: () => "layout.mjs" },
    },
  });
  const path = `${temp}/${name}/layout.mjs`,
    data = readFileSync(path);
  bundles[name] = {
    bytes: data.length,
    gzip: gzipSync(data, { level: 9 }).length,
  };
  global.gc();
  const before = process.memoryUsage(),
    start = performance.now();
  modules[name] = await import(pathToFileURL(path).href);
  startup[name] = {
    coldImportMs: performance.now() - start,
    before,
    after: process.memoryUsage(),
  };
}
const { Yoga } = modules.yoga,
  C = modules.custom;
const summarize = (raw) => {
  const sorted = [...raw].sort((a, b) => a - b);
  return { p50: (sorted[49] + sorted[50]) / 2, p95: sorted[94], raw };
};
const cases = [];
for (const count of [10, 100, 1000, 5000]) {
  const label = "日本語 English text";
  const nodes = Array.from({ length: count }, () =>
    C.CanvasLabel(label, {
      width: 60,
      height: 24,
      minWidth: 40,
      maxWidth: 80,
      shrink: 0,
    }),
  );
  const scene = new C.Scene("compare"),
    panel = C.CanvasRow(nodes, { wrap: true, gap: 4 }),
    ui = new C.CanvasUI(scene, panel);
  const config = Yoga.Config.create();
  config.setPointScaleFactor(0);
  const yroot = Yoga.Node.create(config);
  yroot.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  yroot.setFlexWrap(Yoga.WRAP_WRAP);
  yroot.setAlignItems(Yoga.ALIGN_STRETCH);
  yroot.setAlignContent(Yoga.ALIGN_FLEX_START);
  for (let i = 0; i < count; i++) {
    const n = Yoga.Node.create(config);
    n.setWidth(60);
    n.setHeight(24);
    n.setMinWidth(40);
    n.setMaxWidth(80);
    n.setFlexShrink(0);
    yroot.insertChild(n, i);
  }
  const measurements = {};
  for (const kind of ["custom", "yoga"]) {
    const raw = [];
    for (let i = 0; i < 110; i++) {
      const start = performance.now();
      if (kind === "custom") {
        panel.setStyle({ gap: i % 2 ? 4 : 5 });
        ui.layout(1000, 1000, () => ({ width: 150, height: 20 }));
      } else {
        yroot.setGap(Yoga.GUTTER_ALL, i % 2 ? 4 : 5);
        yroot.calculateLayout(1000, 1000, Yoga.DIRECTION_LTR);
      }
      if (i >= 10) raw.push(performance.now() - start);
    }
    measurements[kind] = summarize(raw);
  }
  for (let i = 0; i < count; i++) {
    const a = nodes[i].bounds,
      b = yroot.getChild(i).getComputedLayout();
    for (const [k, y] of [
      ["x", "left"],
      ["y", "top"],
      ["width", "width"],
      ["height", "height"],
    ])
      assert(Math.abs(a[k] - b[y]) < 1e-4);
  }
  global.gc();
  const live = process.memoryUsage();
  const start = performance.now();
  scene.dispose();
  const customDisposeMs = performance.now() - start;
  const ys = performance.now();
  yroot.freeRecursive();
  config.free();
  const yogaDisposeMs = performance.now() - ys;
  global.gc();
  cases.push({
    count,
    dirtyLayoutMs: measurements,
    customDisposeMs,
    yogaDisposeMs,
    live,
    afterDispose: process.memoryUsage(),
    customReleased: ui.diagnostics.nodes === 0,
  });
}
// Freeze/reallocation comparison, not only equal-size wrapped cells.
const children = [
  C.CanvasLabel("a", { width: 20, maxWidth: 50, grow: 1 }),
  C.CanvasLabel("b", { width: 20, grow: 1 }),
];
const scene = new C.Scene("grow"),
  ui = new C.CanvasUI(scene, C.CanvasRow(children, { padding: 10, gap: 10 }));
ui.layout(300, 200, () => ({ width: 10, height: 20 }));
const yroot = Yoga.Node.create();
yroot.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
yroot.setPadding(Yoga.EDGE_ALL, 10);
yroot.setGap(Yoga.GUTTER_ALL, 10);
for (let i = 0; i < 2; i++) {
  const n = Yoga.Node.create();
  n.setWidth(20);
  n.setFlexGrow(1);
  if (!i) n.setMaxWidth(50);
  yroot.insertChild(n, i);
}
yroot.calculateLayout(300, 200, Yoga.DIRECTION_LTR);
assert.deepEqual(
  children.map((n) => n.bounds.width),
  [50, 220],
);
assert.deepEqual(
  [0, 1].map((i) => yroot.getChild(i).getComputedWidth()),
  [50, 220],
);
scene.dispose();
yroot.freeRecursive();
// External text measurement: both engines receive the same grapheme/word wrapper.
const text = "日本語 English longword and 日本語。";
const grapheme = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const measureText = (value, width = Infinity) => {
  const textWidth = (s) => [...grapheme.segment(s)].length * 10;
  const wrapped = Number.isFinite(width)
    ? C.wrapCanvasText(value, width, textWidth)
    : value;
  const lines = wrapped.split("\n");
  return {
    width: Math.max(...lines.map(textWidth)),
    height: lines.length * 20,
  };
};
const ts = new C.Scene("text"),
  label = C.CanvasLabel(text, { maxWidth: 80, padding: 4, shrink: 0 });
const tu = new C.CanvasUI(ts, C.CanvasColumn([label]));
tu.layout(100, 300, (node, width) => measureText(node.text, width));
const config = Yoga.Config.create();
config.setPointScaleFactor(0);
const yr = Yoga.Node.create(config),
  yl = Yoga.Node.create(config);
yr.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
yr.setAlignItems(Yoga.ALIGN_STRETCH);
yl.setMaxWidth(80);
yl.setPadding(Yoga.EDGE_ALL, 4);
yl.setFlexShrink(0);
yl.setMeasureFunc((width, mode) =>
  measureText(text, mode === Yoga.MEASURE_MODE_UNDEFINED ? Infinity : width),
);
yr.insertChild(yl, 0);
yr.calculateLayout(100, 300, Yoga.DIRECTION_LTR);
const textComparison = { custom: label.bounds, yoga: yl.getComputedLayout() };
assert.equal(label.bounds.width, yl.getComputedWidth());
assert.equal(label.bounds.height, yl.getComputedHeight());
ts.dispose();
yr.freeRecursive();
config.free();
const result = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  time: new Date().toISOString(),
  node: process.version,
  cpu: cpus()[0].model,
  yogaVersion: JSON.parse(readFileSync(`${yogaPath}/package.json`)).version,
  scope:
    "Sequential Node CPU timings; synthetic text metrics; ten warmups and 100 samples. Cold bundled import includes module evaluation and WASM startup, one observation each. process.memoryUsage is process-wide (RSS noisy, WASM/native memory not exhaustively attributed); live/after values include both trees and references to disposed JS nodes. Not browser GPU or comparative full CSS conformance. Layout outputs compared for every item.",
  bundles,
  startup,
  cases,
  textComparison,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify({
    bundles,
    startup,
    cases: cases.map(({ count, dirtyLayoutMs, ...rest }) => ({
      count,
      custom: dirtyLayoutMs.custom.p50,
      yoga: dirtyLayoutMs.yoga.p50,
      ...rest,
    })),
  }),
);
