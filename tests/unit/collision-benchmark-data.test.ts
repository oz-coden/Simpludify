import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

interface RecordSample {
  editMs: number;
  queryMs: number;
  totalMs: number;
  visitedCells: number;
  testedRectangles: number;
  bucketReferences: number;
  hits: number;
  checksum: number;
  rebuildCells: number;
  rebuiltChunks: number;
}
interface Row {
  size: number;
  pattern: string;
  actors: number;
  side: number;
  repeat: number;
  dynamic: boolean;
  strategy: string;
  samples: string;
  editMs: { p50: number; p95: number };
  queryMs: { p50: number; p95: number };
}
interface Raw {
  strategy: string;
  repeat: number;
  dynamic: boolean;
  records: RecordSample[];
}
const root = resolve("benchmarks/collision-design");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
it("preserves every collision benchmark sample, matching counters and percentile summaries", () => {
  const report = read(resolve(root, "results.json")) as { results: Row[] };
  expect(report.results).toHaveLength(216);
  const loaded = new Map<string, Raw[]>();
  const observations = new Map<string, string>();
  for (const row of report.results) {
    let file = loaded.get(row.samples);
    if (!file) {
      file = read(resolve(root, row.samples)) as Raw[];
      loaded.set(row.samples, file);
    }
    const matching = file.filter(
      (raw) =>
        raw.strategy === row.strategy &&
        raw.repeat === row.repeat &&
        raw.dynamic === row.dynamic,
    );
    expect(matching).toHaveLength(1);
    const raw = matching[0] as Raw;
    expect(raw.records).toHaveLength(20);
    for (const key of ["editMs", "queryMs"] as const) {
      const sorted = raw.records.map((r) => r[key]).sort((a, b) => a - b);
      expect(row[key].p50).toBe(
        ((sorted[9] as number) + (sorted[10] as number)) / 2,
      );
      expect(row[key].p95).toBe(sorted[18]);
    }
    const group = `${row.size}:${row.pattern}:${row.actors}:${row.side}:${row.repeat}:${row.dynamic}`;
    const semantic = JSON.stringify(
      raw.records.map((r) => [r.hits, r.checksum]),
    );
    if (observations.has(group)) expect(semantic).toBe(observations.get(group));
    else observations.set(group, semantic);
    if (row.strategy === "direct")
      for (const sample of raw.records) {
        expect(sample.visitedCells).toBe(row.actors * row.side * row.side);
        expect(sample.rebuildCells).toBe(0);
      }
  }
  expect(loaded.size).toBe(12);
  expect(observations.size).toBe(72);
});
