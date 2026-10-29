import { Grid } from "@simpludify/core";
import { describe, expect, it } from "vitest";
import {
  CandidateProbe,
  candidateRange,
  type Strategy,
} from "../prototypes/tile-candidates";

const strategies: Strategy[] = ["direct", "merged", "chunked"];
describe("isolated collision candidate strategies", () => {
  it("uses closed tolerance-expanded bounds, including both sides of a seam", () => {
    const map = {
      width: 3,
      height: 2,
      x: -100,
      y: 50,
      tileWidth: 32,
      tileHeight: 16,
    };
    expect(
      candidateRange(map, { minX: -68, maxX: -68, minY: 66, maxY: 66 }),
    ).toEqual({ x0: 0, x1: 1, y0: 0, y1: 1 });
    expect(
      candidateRange(map, { minX: -4, maxX: 3, minY: 50, maxY: 51 }),
    ).toEqual({ x0: 2, x1: 2, y0: 0, y1: 0 });
    expect(
      candidateRange(map, { minX: -3, maxX: 3, minY: 50, maxY: 51 }),
    ).toBeUndefined();
  });
  it("matches exact cell sets before and after batched boundary edits for all strategies", () => {
    for (const pattern of ["dense", "sparse", "stripes"]) {
      const probes = strategies.map(
        (strategy) =>
          new CandidateProbe(
            Grid.generate(
              35,
              33,
              (x, y) =>
                pattern === "dense" ||
                (pattern === "sparse"
                  ? (x * 7 + y * 11) % 13 === 0
                  : y % 3 === 0),
            ),
            strategy,
          ),
      );
      const queries = [
        { x0: 0, y0: 0, x1: 34, y1: 32 },
        { x0: 15, y0: 15, x1: 17, y1: 17 },
        { x0: 32, y0: 32, x1: 34, y1: 32 },
      ];
      for (let step = 0; step < 12; step++) {
        for (const probe of probes) {
          probe.set(15, 15, step % 2 === 0);
          probe.set(16, 16, step % 2 !== 0);
          probe.set(34, 32, step % 2 === 0);
          probe.commit();
        }
        for (const query of queries) {
          const results = probes.map((probe) => {
            const cells: number[] = [];
            probe.query(query, cells);
            return cells.sort((a, b) => a - b);
          });
          expect(results[1]).toEqual(results[0]);
          expect(results[2]).toEqual(results[0]);
          expect(new Set(results[1]).size).toBe(results[1]?.length);
        }
      }
    }
  });
  it("bounds direct work by footprint rather than total map area", () => {
    for (const size of [32, 100, 256]) {
      const probe = new CandidateProbe(new Grid(size, size, true), "direct");
      expect(probe.query({ x0: 10, y0: 10, x1: 11, y1: 11 })).toMatchObject({
        visitedCells: 4,
        hits: 4,
      });
    }
  });
  it("coalesces chunk dirtiness and avoids a whole-map rebuild for a cell edit", () => {
    const probe = new CandidateProbe(new Grid(256, 256, true), "chunked");
    probe.set(10, 10, false);
    probe.set(11, 10, false);
    probe.commit();
    expect(probe.rebuildCells).toBe(256);
    expect(probe.rebuiltChunks).toBe(1);
    probe.commit();
    expect(probe.rebuildCells).toBe(0);
  });
});
