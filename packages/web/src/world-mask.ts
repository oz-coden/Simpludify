import { EngineError, type Point } from "@simpludify/core";

/** Rectangles use a world-space top-left. Circles use a world-space center. */
export type WorldMaskRegion =
  | {
      readonly kind: "rectangle";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly kind: "circle";
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    }
  | { readonly kind: "polygon"; readonly points: readonly Point[] };

function invalid(): never {
  throw new EngineError(
    "INVALID_VALUE",
    "World mask regions need finite coordinates and a nonzero area",
  );
}

export function copyWorldMask(
  regions: readonly WorldMaskRegion[],
): readonly WorldMaskRegion[] {
  if (!Array.isArray(regions)) invalid();
  return regions.map((region: WorldMaskRegion) => {
    if (region?.kind === "polygon") {
      if (!Array.isArray(region.points) || region.points.length < 3) invalid();
      const points = Array.from(region.points, (point: Point) => {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))
          invalid();
        return { x: point.x, y: point.y };
      });
      // Use the same winding as rectangles/circles for overlapping Canvas paths.
      const [first, second] = points;
      if (!first || !second) return invalid();
      let previous = second;
      let area = 0;
      for (const point of points.slice(2)) {
        area +=
          (previous.x - first.x) * (point.y - first.y) -
          (point.x - first.x) * (previous.y - first.y);
        previous = point;
      }
      if (area === 0 || !Number.isFinite(area)) invalid();
      if (area < 0) points.reverse();
      return { kind: "polygon", points };
    }
    if (region?.kind === "rectangle") {
      const { x, y, width, height } = region;
      if (
        ![x, y, width, height, x + width, y + height].every(Number.isFinite) ||
        width <= 0 ||
        height <= 0
      )
        invalid();
      return { kind: "rectangle", x, y, width, height };
    }
    if (region?.kind === "circle") {
      const { x, y, radius } = region;
      if (
        ![x, y, radius, x - radius, x + radius, y - radius, y + radius].every(
          Number.isFinite,
        ) ||
        radius <= 0
      )
        invalid();
      return { kind: "circle", x, y, radius };
    }
    return invalid();
  });
}
