import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
assert.equal(
  git("status", "--porcelain"),
  "",
  "Commit and push before measuring",
);
const baseline = process.argv[2],
  yoga = process.argv[3];
assert(
  baseline && yoga,
  "Pass baseline checkout and extracted yoga-layout package paths",
);
const out = process.argv[4] ?? "benchmarks/canvas-ui/bundles.json";
const root = resolve("."),
  temporary = resolve("/tmp/simpludify-ui-size");
mkdirSync(temporary, { recursive: true });
async function bundle(name, worktree, example, extra) {
  const result = await build({
    configFile: false,
    root: join(worktree, "examples", example),
    base: "./",
    logLevel: "error",
    resolve: {
      alias: {
        "@simpludify/web": join(worktree, "packages/web/src/index.ts"),
        "@simpludify/core": join(worktree, "packages/core/src/index.ts"),
      },
    },
    build: {
      write: false,
      target: "esnext",
      minify: true,
      ...(extra ? { rollupOptions: { input: extra } } : {}),
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(
    (r) => r.output,
  );
  const assets = outputs
    .filter((o) => /\.(m?js|css)$/.test(o.fileName))
    .map((o) => {
      const data = Buffer.from(o.type === "chunk" ? o.code : o.source);
      return {
        file: o.fileName,
        bytes: data.length,
        gzip: gzipSync(data, { level: 9 }).length,
      };
    });
  return {
    name,
    assets,
    jsBytes: assets
      .filter((a) => a.file.endsWith(".js"))
      .reduce((s, a) => s + a.bytes, 0),
    jsGzip: assets
      .filter((a) => a.file.endsWith(".js"))
      .reduce((s, a) => s + a.gzip, 0),
    cssBytes: assets
      .filter((a) => a.file.endsWith(".css"))
      .reduce((s, a) => s + a.bytes, 0),
    cssGzip: assets
      .filter((a) => a.file.endsWith(".css"))
      .reduce((s, a) => s + a.gzip, 0),
  };
}
const baselineGame = await bundle(
  "baseline DOM UI/scenes",
  resolve(baseline),
  "ui-scenes",
);
const currentGame = await bundle(
  "current same DOM UI/scenes",
  root,
  "ui-scenes",
);
const canvasGame = await bundle(
  "current integrated Canvas trail",
  root,
  "canvas-ui",
);
// Matched micro entries separate layout module transfer cost from full game/Pixi features.
const customEntry = join(temporary, "custom.mjs"),
  yogaEntry = join(temporary, "yoga.mjs"),
  emptyEntry = join(temporary, "empty.mjs");
writeFileSync(
  customEntry,
  `import {layoutCanvas} from ${JSON.stringify(join(root, "packages/web/src/canvas-layout.ts"))}; globalThis.layout=layoutCanvas;`,
);
writeFileSync(
  yogaEntry,
  `import Yoga from ${JSON.stringify(join(resolve(yoga), "dist/src/index.js"))}; globalThis.layout=Yoga;`,
);
writeFileSync(emptyEntry, "globalThis.layout=null;");
const empty = await bundle("empty micro entry", root, "ui-scenes", emptyEntry),
  custom = await bundle(
    "custom layout micro entry",
    root,
    "ui-scenes",
    customEntry,
  ),
  yogaBundle = await bundle(
    "Yoga 3.2.1 module micro entry",
    root,
    "ui-scenes",
    yogaEntry,
  );
const Yoga = (await import(join(resolve(yoga), "dist/src/index.js"))).default;
const row = Yoga.Node.create();
row.setWidth(300);
row.setHeight(200);
row.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
row.setPadding(Yoga.EDGE_ALL, 10);
row.setGap(Yoga.GUTTER_ALL, 8);
row.setAlignItems(Yoga.ALIGN_FLEX_START);
const a = Yoga.Node.create(),
  b = Yoga.Node.create();
a.setWidth(50);
a.setHeight(20);
b.setWidthPercent(50);
b.setHeight(20);
a.setFlexShrink(1);
b.setFlexShrink(1);
row.insertChild(a, 0);
row.insertChild(b, 1);
row.calculateLayout(300, 200, Yoga.DIRECTION_LTR);
const comparison = [a, b].map((n) => ({
  x: n.getComputedLeft(),
  y: n.getComputedTop(),
  width: n.getComputedWidth(),
  height: n.getComputedHeight(),
}));
assert.deepEqual(comparison, [
  { x: 10, y: 10, width: 50, height: 20 },
  { x: 68, y: 10, width: 140, height: 20 },
]);
row.freeRecursive();
const report = {
  revision: git("rev-parse", "HEAD"),
  baseline: execFileSync(
    "git",
    ["-C", resolve(baseline), "rev-parse", "HEAD"],
    { encoding: "utf8" },
  ).trim(),
  time: new Date().toISOString(),
  node: process.version,
  scope:
    "Same Vite8 production minifier, esnext target, no sourcemaps. JS/CSS gzip level9 sums each emitted asset independently; not package tarball or runtime heap. Extra module micro entries include only publicly referenced code. Full game comparison holds the DOM UI/scenes entry constant; Canvas trail includes different game/features.",
  versions: {
    vite: JSON.parse(readFileSync("node_modules/vite/package.json", "utf8"))
      .version,
    yoga: JSON.parse(readFileSync(join(yoga, "package.json"), "utf8")).version,
  },
  games: [baselineGame, currentGame, canvasGame],
  micro: [empty, custom, yogaBundle],
  yogaCanonicalRow: comparison,
  decision:
    "Keep custom documented Flex subset: no layout dependency/async WASM ownership; Yoga has broader mature CSS-like behavior. This is a size/canonical-layout comparison, not a speed or full correctness comparison.",
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
