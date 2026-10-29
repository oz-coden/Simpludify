import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

interface Frame {
  editMs: number;
  stepMs: number;
  candidateCells: number;
  policyRejected: number;
  narrowTests: number;
  responseTests: number;
  corrections: number;
  contacts: number;
  unresolved: number;
  retainedCells: number;
  enter: number;
  stay: number;
  exit: number;
}
interface Raw {
  actors: number;
  dynamic: boolean;
  repeat: number;
  plain: Frame[];
  profiled: Frame[];
}
interface Summary {
  size: number;
  pattern: string;
  actors: number;
  dynamic: boolean;
  repeat: number;
  samples: string;
  stepMs: { p50: number; p95: number };
  released: {
    actors: number;
    maps: number;
    contacts: number;
    retainedCells: number;
    inputSources: number;
  };
}
const root = resolve("benchmarks/tile-collision");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
it("preserves formal Solver samples, equivalent profiling counters, release and seam acceptance", () => {
  const report = read(resolve(root, "results.json")) as {
    results: Summary[];
    seams: { maxError: number; maxUnresolved: number }[];
  };
  expect(report.results).toHaveLength(72);
  expect(report.seams).toHaveLength(96);
  const files = new Map<string, Raw[]>();
  for (const row of report.results) {
    let rows = files.get(row.samples);
    if (!rows) {
      rows = read(resolve(root, row.samples)) as Raw[];
      files.set(row.samples, rows);
    }
    const matches = rows.filter(
      (r) =>
        r.actors === row.actors &&
        r.dynamic === row.dynamic &&
        r.repeat === row.repeat,
    );
    expect(matches).toHaveLength(1);
    const raw = matches[0];
    if (!raw) throw Error();
    expect(raw.plain).toHaveLength(20);
    expect(raw.profiled).toHaveLength(20);
    const sorted = raw.plain.map((r) => r.stepMs).sort((a, b) => a - b);
    expect(row.stepMs.p50).toBe(
      ((sorted[9] as number) + (sorted[10] as number)) / 2,
    );
    expect(row.stepMs.p95).toBe(sorted[18]);
    for (let i = 0; i < 20; i++) {
      const a = raw.plain[i],
        b = raw.profiled[i];
      if (!a || !b) throw Error();
      for (const key of [
        "candidateCells",
        "narrowTests",
        "responseTests",
        "corrections",
        "contacts",
        "unresolved",
        "enter",
        "stay",
        "exit",
      ] as const)
        expect(a[key]).toBe(b[key]);
      expect(a.policyRejected + a.narrowTests).toBe(a.candidateCells);
      expect(a.retainedCells).toBeLessThanOrEqual(a.contacts);
      expect(a.unresolved).toBe(0);
    }
    expect(row.released).toEqual({
      actors: 0,
      maps: 0,
      contacts: 0,
      retainedCells: 0,
      inputSources: 0,
    });
  }
  expect(files.size).toBe(6);
  for (const result of report.seams) {
    expect(result.maxError).toBeLessThan(1e-6);
    expect(result.maxUnresolved).toBe(0);
  }
});
