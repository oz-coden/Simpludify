import { describe, expect, it } from "vitest";
import { PlacementBoard } from "../../examples/grid/logic";
import { EngineError, Grid } from "../../packages/core/src";

function failure(run: () => unknown, code: string) {
  try {
    run();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe(code);
    return (error as EngineError).details;
  }
}

describe("Grid data and coordinates", () => {
  it("stores a non-square row-major board with explicit dimensions", () => {
    const grid = new Grid(3, 2, 0);
    expect([grid.width, grid.height]).toEqual([3, 2]);
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 3; x++) grid.set(x, y, y * 3 + x);
    const entries: number[][] = [];
    grid.forEach((value, x, y) => {
      entries.push([value, x, y]);
    });
    expect(entries).toEqual([
      [0, 0, 0],
      [1, 1, 0],
      [2, 2, 0],
      [3, 0, 1],
      [4, 1, 1],
      [5, 2, 1],
    ]);
    expect(grid.get(2, 1)).toBe(5);
  });
  it.each([
    [1, 1],
    [1, 4],
    [4, 1],
  ])("supports %i by %i", (width, height) => {
    const grid = Grid.generate(width, height, (x, y) => `${x}:${y}`);
    expect(grid.get(0, 0)).toBe("0:0");
    expect(grid.get(width - 1, height - 1)).toBe(`${width - 1}:${height - 1}`);
    grid.set(width - 1, height - 1, "last");
    expect(grid.get(width - 1, height - 1)).toBe("last");
  });
  it("generates in row-major order with coordinates once per cell", () => {
    const calls: number[][] = [];
    const grid = Grid.generate(2, 3, (x, y) => {
      calls.push([x, y]);
      return calls.length;
    });
    expect(calls).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
    ]);
    expect(grid.get(1, 2)).toBe(6);
  });
  it("preserves a function as a value instead of invoking it as an initializer", () => {
    let calls = 0;
    const fn = () => ++calls;
    const grid = new Grid(2, 2, fn);
    expect(calls).toBe(0);
    expect(grid.get(1, 1)).toBe(fn);
    expect(grid.get(0, 0)()).toBe(1);
    const generated = Grid.generate(2, 2, () => fn);
    expect(generated.get(0, 0)).toBe(fn);
  });
  it("stores undefined and distinguishes valid cells with inBounds", () => {
    const grid = new Grid<number | undefined>(2, 1, undefined);
    expect(grid.inBounds(0, 0)).toBe(true);
    expect(grid.get(0, 0)).toBeUndefined();
    grid.set(1, 0, 2);
    grid.fill(undefined);
    expect(grid.get(1, 0)).toBeUndefined();
    failure(() => grid.get(2, 0), "GRID_BOUNDS");
  });
  it("does not share storage between instances", () => {
    const a = new Grid(2, 2, 0),
      b = new Grid(2, 2, 0);
    a.set(0, 0, 3);
    a.fill(4);
    expect(b.get(0, 0)).toBe(0);
  });
  it("fills every cell, including after prior writes", () => {
    const grid = Grid.generate(3, 2, (x, y) => x + y);
    grid.fill(9);
    const values: number[] = [];
    grid.forEach((v) => {
      values.push(v);
    });
    expect(values).toEqual([9, 9, 9, 9, 9, 9]);
  });
  it("keeps dimensions/storage inaccessible through ordinary public fields", () => {
    const grid = new Grid(2, 2, 0);
    expect(Reflect.set(grid, "width", 10)).toBe(false);
    expect(Reflect.set(grid, "height", 10)).toBe(false);
    Reflect.set(grid, "cells", []);
    Reflect.set(grid, "data", []);
    grid.set(1, 1, 3);
    expect([grid.width, grid.height, grid.get(1, 1)]).toEqual([2, 2, 3]);
  });
  it("does not trust overridden inBounds for internal array validation", () => {
    class Extended extends Grid<number> {
      override inBounds() {
        return true;
      }
    }
    const grid = new Extended(2, 2, 0);
    failure(() => grid.set(2, 0, 9), "GRID_BOUNDS");
    expect(grid.get(0, 1)).toBe(0);
  });
});

describe("bounds and allocation validation", () => {
  it.each([
    -1,
    0.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects x/y %s for get/set without mutation", (value) => {
    const grid = new Grid(2, 3, 0);
    for (const [x, y] of [
      [value, 0],
      [0, value],
    ]) {
      expect(grid.inBounds(x ?? 0, y ?? 0)).toBe(false);
      failure(() => grid.get(x ?? 0, y ?? 0), "GRID_BOUNDS");
      failure(() => grid.set(x ?? 0, y ?? 0, 9), "GRID_BOUNDS");
    }
    const values: number[] = [];
    grid.forEach((v) => {
      values.push(v);
    });
    expect(values).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it("rejects boundary aliases that would land in the next row", () => {
    const grid = new Grid(2, 3, 0);
    failure(() => grid.set(2, 0, 9), "GRID_BOUNDS");
    failure(() => grid.get(0, 3), "GRID_BOUNDS");
    expect(grid.get(0, 1)).toBe(0);
  });
  it("reports coordinates, dimensions and operation", () => {
    const grid = new Grid(3, 2, 0);
    expect(failure(() => grid.set(3, 1, 9), "GRID_BOUNDS")).toEqual({
      x: 3,
      y: 1,
      width: 3,
      height: 2,
      operation: "set",
    });
  });
  it.each([0, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects dimension %s before allocation",
    (value) => {
      failure(() => new Grid(value, 1, 0), "GRID_SIZE");
      failure(() => new Grid(1, value, 0), "GRID_SIZE");
    },
  );
  it("rejects huge allocations and unsafe products without calling factory", () => {
    let calls = 0;
    for (const [width, height] of [
      [Grid.maxCells + 1, 1],
      [4096, 4097],
      [Number.MAX_SAFE_INTEGER, 2],
      [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    ]) {
      const details = failure(
        () => Grid.generate(width ?? 0, height ?? 0, () => ++calls),
        "GRID_SIZE",
      );
      expect(details.maxCells).toBe(Grid.maxCells);
    }
    expect(calls).toBe(0);
  });
  it("rejects JavaScript strings/missing coordinates and invalid callbacks", () => {
    const grid = new Grid(2, 2, 0);
    failure(() => Reflect.apply(grid.get, grid, ["0", 0]), "GRID_BOUNDS");
    failure(() => Reflect.apply(grid.set, grid, [0]), "GRID_BOUNDS");
    failure(() => Reflect.construct(Grid, ["2", 2, 0]), "GRID_SIZE");
    failure(
      () => Reflect.apply(Grid.generate, Grid, [2, 2, null]),
      "INVALID_VALUE",
    );
    failure(() => Reflect.apply(grid.forEach, grid, [null]), "INVALID_VALUE");
  });
  it("propagates initializer exceptions and stops invoking it", () => {
    const error = new Error("factory"),
      calls: number[][] = [];
    expect(() =>
      Grid.generate(3, 2, (x, y) => {
        calls.push([x, y]);
        if (x === 1) throw error;
        return 0;
      }),
    ).toThrow(error);
    expect(calls).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });
});

describe("references and lifetime independence", () => {
  it("intentionally shares the initial object without cloning", () => {
    const cell = { blocked: false },
      grid = new Grid(2, 2, cell);
    grid.get(0, 0).blocked = true;
    expect(grid.get(1, 1)).toBe(cell);
    expect(grid.get(1, 1).blocked).toBe(true);
  });
  it("generates independent cell objects when requested", () => {
    const grid = Grid.generate(2, 2, (x, y) => ({ x, y, blocked: false }));
    grid.get(0, 0).blocked = true;
    expect(grid.get(1, 1)).toEqual({ x: 1, y: 1, blocked: false });
    expect(grid.get(1, 1)).not.toBe(grid.get(0, 0));
  });
  it("permits intentionally shared factory results and fill references", () => {
    const a = { value: 1 },
      b = { value: 2 },
      grid = Grid.generate(2, 2, () => a);
    expect(grid.get(0, 0)).toBe(grid.get(1, 1));
    grid.fill(b);
    expect(grid.get(0, 0)).toBe(b);
    expect(grid.get(1, 1)).toBe(b);
  });
  it("does not acquire, dispose, clone, freeze or otherwise manage stored objects", () => {
    let disposed = 0;
    const item = {
        value: 1,
        dispose() {
          disposed++;
        },
      },
      grid = new Grid(2, 2, item);
    grid.set(0, 0, {
      value: 2,
      dispose() {
        disposed++;
      },
    });
    grid.fill(item);
    item.value = 3;
    expect(grid.get(1, 1).value).toBe(3);
    expect(disposed).toBe(0);
    expect(Object.isFrozen(item)).toBe(false);
  });
});

describe("live traversal and rectangles", () => {
  it("observes writes to not-yet-visited cells but does not revisit past cells", () => {
    const grid = new Grid(3, 1, 0),
      seen: number[] = [];
    grid.forEach((value, x) => {
      seen.push(value);
      if (x === 0) grid.set(1, 0, 5);
      if (x === 2) grid.set(0, 0, 9);
    });
    expect(seen).toEqual([0, 5, 0]);
    expect(grid.get(0, 0)).toBe(9);
  });
  it("stops on callback errors and retains already committed changes", () => {
    const grid = new Grid(3, 1, 0),
      error = new Error("visitor");
    expect(() =>
      grid.forEach((_v, x, y) => {
        if (x === 1) throw error;
        grid.set(x, y, 3);
      }),
    ).toThrow(error);
    expect([grid.get(0, 0), grid.get(1, 0), grid.get(2, 0)]).toEqual([3, 0, 0]);
  });
  it("visits only the selected rectangle, in row order with original coordinates", () => {
    const grid = Grid.generate(4, 3, (x, y) => y * 4 + x),
      seen: number[][] = [];
    grid.forEachRect(1, 1, 2, 2, (v, x, y) => {
      seen.push([v, x, y]);
      grid.set(x, y, -v);
    });
    expect(seen).toEqual([
      [5, 1, 1],
      [6, 2, 1],
      [9, 1, 2],
      [10, 2, 2],
    ]);
    expect(grid.get(3, 2)).toBe(11);
  });
  it("expresses row/column scans without exposing storage", () => {
    const grid = Grid.generate(3, 2, (x, y) => y * 3 + x),
      row: number[] = [],
      column: number[] = [];
    grid.forEachRect(0, 1, 3, 1, (v) => row.push(v));
    grid.forEachRect(2, 0, 1, 2, (v) => column.push(v));
    expect(row).toEqual([3, 4, 5]);
    expect(column).toEqual([2, 5]);
  });
  it.each([
    [0, 0, 0, 2],
    [0, 0, 2, 0],
    [2, 2, 0, 0],
    [2, 0, 0, 2],
    [0, 2, 2, 0],
  ])("accepts empty contained rectangle %j %j %j %j", (x, y, w, h) => {
    const grid = new Grid(2, 2, 0);
    let calls = 0;
    grid.forEachRect(x, y, w, h, () => {
      calls++;
    });
    expect(calls).toBe(0);
  });
  it.each([
    [-1, 0, 1, 1],
    [0, -1, 1, 1],
    [0, 0, -1, 1],
    [0, 0, 1, -1],
    [1, 0, 2, 1],
    [0, 1, 1, 2],
    [3, 0, 0, 0],
    [0, 3, 0, 0],
    [0, 0, 0.5, 1],
    [NaN, 0, 0, 0],
    [0, 0, Infinity, 0],
    [0, 0, Number.MAX_SAFE_INTEGER, 1],
  ])(
    "rejects entire invalid rectangle %j %j %j %j before visits",
    (x, y, w, h) => {
      const grid = new Grid(2, 2, 0);
      let calls = 0;
      failure(
        () =>
          grid.forEachRect(x, y, w, h, () => {
            calls++;
          }),
        "GRID_BOUNDS",
      );
      expect(calls).toBe(0);
    },
  );
});

describe("data-only building placement example", () => {
  it("places/removes footprints while preserving blocked terrain and independent cells", () => {
    const board = new PlacementBoard(8, 6);
    board.block(0, 0, 2, 2);
    expect(board.canPlace(0, 0, 1, 1)).toBe(false);
    expect(board.canPlace(2, 1, 2, 3)).toBe(true);
    board.place("house", 2, 1, 2, 3);
    expect(board.cells.get(3, 3).building).toBe("house");
    expect(board.cells.get(4, 3).building).toBeUndefined();
    expect(board.canPlace(3, 2, 2, 2)).toBe(false);
    failure(() => board.place("shop", 3, 2, 2, 2), "PLACEMENT_INVALID");
    board.remove("house");
    expect(board.canPlace(2, 1, 2, 3)).toBe(true);
    expect(board.cells.get(0, 0).blocked).toBe(true);
  });
  it("rejects outside footprints instead of partially changing the board", () => {
    const board = new PlacementBoard(3, 2);
    expect(board.canPlace(-1, 0, 2, 1)).toBe(false);
    expect(board.canPlace(2, 1, 2, 2)).toBe(false);
    expect(board.canPlace(0, 0, 0, 1)).toBe(false);
    failure(() => board.place("", 0, 0, 1, 1), "PLACEMENT_INVALID");
    failure(() => board.place("house", 2, 1, 2, 2), "PLACEMENT_INVALID");
    board.cells.forEach((cell) => {
      expect(cell.building).toBeUndefined();
    });
  });
});

// Compiled with the repository strict configuration; never executed.
function typeContracts() {
  const grid = new Grid(2, 3, 0);
  const value: number = grid.get(0, 0);
  void value;
  grid.forEach((cell, x, y) => {
    const sum: number = cell + x + y;
    void sum;
  });
  // @ts-expect-error number Grid rejects strings
  grid.set(0, 0, "bad");
  // @ts-expect-error coordinates are numeric
  grid.get("0", 0);
  // @ts-expect-error missing coordinate
  grid.get(0);
  // @ts-expect-error missing value
  grid.set(0, 0);
  // @ts-expect-error constructor requires an explicit initial value
  new Grid<number>(2, 2);
  // @ts-expect-error numeric initializer coordinates
  Grid.generate(2, 2, (x: string) => x);
  // @ts-expect-error typed factory result
  Grid.generate<number>(2, 2, () => "bad");
  // @ts-expect-error callback value type
  grid.forEach((v: string) => {
    void v;
  });
  // @ts-expect-error fixed width
  grid.width = 4;
  // @ts-expect-error rectangle needs a visitor
  grid.forEachRect(0, 0, 1, 1);
}
void typeContracts;
