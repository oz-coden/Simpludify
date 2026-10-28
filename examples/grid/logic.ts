import { EngineError, Grid } from "@simpludify/core";

/** Data-only building-placement example; no Actor, renderer, world units or ownership. */
export class PlacementBoard {
  readonly cells: Grid<{ blocked: boolean; building: string | undefined }>;
  constructor(width: number, height: number) {
    this.cells = Grid.generate(width, height, () => ({
      blocked: false,
      building: undefined as string | undefined,
    }));
  }
  block(x: number, y: number, width: number, height: number): void {
    this.cells.forEachRect(x, y, width, height, (cell) => {
      cell.blocked = true;
    });
  }
  canPlace(x: number, y: number, width: number, height: number): boolean {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      !this.cells.inBounds(x, y) ||
      !this.cells.inBounds(x + width - 1, y + height - 1)
    )
      return false;
    let free = true;
    this.cells.forEachRect(x, y, width, height, (cell) => {
      if (cell.blocked || cell.building !== undefined) free = false;
    });
    return free;
  }
  place(id: string, x: number, y: number, width: number, height: number): void {
    if (!id.trim() || !this.canPlace(x, y, width, height))
      throw new EngineError(
        "PLACEMENT_INVALID",
        "Building footprint is unavailable",
        {
          id,
          x,
          y,
          width,
          height,
        },
      );
    this.cells.forEachRect(x, y, width, height, (cell) => {
      cell.building = id;
    });
  }
  remove(id: string): void {
    this.cells.forEach((cell) => {
      if (cell.building === id) cell.building = undefined;
    });
  }
}
