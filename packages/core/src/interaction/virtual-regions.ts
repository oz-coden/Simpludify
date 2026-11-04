import { EngineError } from "../foundation/diagnostics";
import type { Point, ScreenPoint, Viewport } from "../graphics/coordinates";

export type VirtualSpace = "viewport" | "screen";
export interface VirtualPosition extends Point {
  /** viewport uses fractions of the current Viewport; screen uses host CSS pixels. */
  readonly space?: VirtualSpace;
}
export interface VirtualRectRegion extends VirtualPosition {
  readonly kind: "rect";
  readonly width: number;
  readonly height: number;
}
export interface VirtualCircleRegion extends VirtualPosition {
  readonly kind: "circle";
  /** In viewport space the radius is a fraction of its smaller dimension. */
  readonly radius: number;
}
export interface VirtualCustomRegion {
  readonly kind: "custom";
  /** Conservative host CSS-pixel bounds, including every point accepted by contains. */
  readonly bounds: (viewport: Viewport) => Viewport;
  readonly contains: (point: ScreenPoint, viewport: Viewport) => boolean;
}
export type VirtualRegion =
  | VirtualRectRegion
  | VirtualCircleRegion
  | VirtualCustomRegion;

export const VirtualRegions = Object.freeze({
  /** A shared edge is not an overlap. Use separate rectangles to leave a center gap. */
  Left: Object.freeze({
    kind: "rect",
    x: 0,
    y: 0,
    width: 0.5,
    height: 1,
  } as const),
  Right: Object.freeze({
    kind: "rect",
    x: 0.5,
    y: 0,
    width: 0.5,
    height: 1,
  } as const),
});

/** @internal */
export type ResolvedVirtualRegion =
  | { readonly kind: "rect"; readonly bounds: Viewport }
  | {
      readonly kind: "circle";
      readonly bounds: Viewport;
      readonly center: Point;
      readonly radius: number;
    }
  | {
      readonly kind: "custom";
      readonly bounds: Viewport;
      readonly test: VirtualCustomRegion["contains"];
    };

/** @internal */
export function virtualFinite(value: number, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new EngineError("INVALID_VIRTUAL_INPUT", `${field} must be finite`);
  return value;
}
/** @internal */
export function virtualBounds(value: Viewport): Viewport {
  const result = {
    x: virtualFinite(value.x, "x"),
    y: virtualFinite(value.y, "y"),
    width: virtualFinite(value.width, "width"),
    height: virtualFinite(value.height, "height"),
  };
  if (
    result.width < 0 ||
    result.height < 0 ||
    !Number.isFinite(result.x + result.width) ||
    !Number.isFinite(result.y + result.height)
  )
    throw new EngineError(
      "INVALID_VIRTUAL_INPUT",
      "Region extents must be finite and nonnegative",
    );
  return Object.freeze(result);
}
/** @internal */
export function virtualPosition(
  value: VirtualPosition,
  viewport: Viewport,
): Point {
  const space = value.space ?? "viewport";
  if (space !== "viewport" && space !== "screen")
    throw new EngineError(
      "INVALID_VIRTUAL_INPUT",
      "Unknown virtual coordinate space",
    );
  const x = virtualFinite(value.x, "position.x"),
    y = virtualFinite(value.y, "position.y");
  return Object.freeze(
    space === "screen"
      ? { x, y }
      : {
          x: virtualFinite(viewport.x + x * viewport.width, "resolved x"),
          y: virtualFinite(viewport.y + y * viewport.height, "resolved y"),
        },
  );
}
/** @internal Copy configuration before retaining it. Predicate functions are deliberately live. */
export function checkedVirtualRegion(region: VirtualRegion): VirtualRegion {
  if (!region || !["rect", "circle", "custom"].includes(region.kind))
    throw new EngineError("INVALID_VIRTUAL_INPUT", "Unknown activation region");
  const copy = Object.freeze({ ...region });
  if (copy.kind === "custom") {
    if (
      typeof copy.bounds !== "function" ||
      typeof copy.contains !== "function"
    )
      throw new EngineError(
        "INVALID_VIRTUAL_INPUT",
        "Custom regions require bounds and contains",
      );
  } else resolveVirtualRegion(copy, { x: 0, y: 0, width: 1, height: 1 });
  return copy;
}
/** @internal */
export function resolveVirtualRegion(
  region: VirtualRegion,
  viewport: Viewport,
): ResolvedVirtualRegion {
  if (region.kind === "custom") {
    if (
      typeof region.bounds !== "function" ||
      typeof region.contains !== "function"
    )
      throw new EngineError(
        "INVALID_VIRTUAL_INPUT",
        "Custom regions require bounds and contains functions",
      );
    return {
      kind: "custom",
      bounds: virtualBounds(region.bounds(viewport)),
      test: region.contains,
    };
  }
  const center = virtualPosition(region, viewport);
  if (region.kind === "rect") {
    const relative = (region.space ?? "viewport") === "viewport";
    const width = virtualFinite(region.width, "region.width"),
      height = virtualFinite(region.height, "region.height");
    if (width < 0 || height < 0)
      throw new EngineError(
        "INVALID_VIRTUAL_INPUT",
        "Region sizes must be nonnegative",
      );
    return {
      kind: "rect",
      bounds: virtualBounds({
        ...center,
        width: width * (relative ? viewport.width : 1),
        height: height * (relative ? viewport.height : 1),
      }),
    };
  }
  const radius =
    virtualFinite(region.radius, "region.radius") *
    ((region.space ?? "viewport") === "viewport"
      ? Math.min(viewport.width, viewport.height)
      : 1);
  if (radius < 0)
    throw new EngineError(
      "INVALID_VIRTUAL_INPUT",
      "Region radius must be nonnegative",
    );
  return {
    kind: "circle",
    center,
    radius,
    bounds: virtualBounds({
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2,
    }),
  };
}
/** @internal Rectangles are half-open; circles exclude their circumference. */
export function virtualContains(
  region: ResolvedVirtualRegion,
  point: ScreenPoint,
  viewport: Viewport,
): boolean {
  const b = region.bounds;
  if (
    point.x < b.x ||
    point.y < b.y ||
    point.x >= b.x + b.width ||
    point.y >= b.y + b.height
  )
    return false;
  if (region.kind === "circle")
    return (
      Math.hypot(point.x - region.center.x, point.y - region.center.y) <
      region.radius
    );
  if (region.kind === "custom") {
    const value = region.test(point, viewport);
    if (typeof value !== "boolean")
      throw new EngineError(
        "INVALID_VIRTUAL_INPUT",
        "Custom region predicate must return boolean",
      );
    return value;
  }
  return true;
}
/** @internal Exact built-in intersection; custom bounds are conservatively ambiguous. */
export function virtualOverlap(
  a: ResolvedVirtualRegion,
  b: ResolvedVirtualRegion,
): boolean {
  const x = a.bounds,
    y = b.bounds;
  if (
    Math.min(x.x + x.width, y.x + y.width) <= Math.max(x.x, y.x) ||
    Math.min(x.y + x.height, y.y + y.height) <= Math.max(x.y, y.y)
  )
    return false;
  if (a.kind === "circle" && b.kind === "circle")
    return (
      Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) <
      a.radius + b.radius
    );
  const circle = a.kind === "circle" ? a : b.kind === "circle" ? b : undefined;
  const rect = a.kind === "circle" ? b : a;
  if (circle && rect.kind === "rect") {
    const c = circle.center,
      r = rect.bounds;
    return (
      Math.hypot(
        c.x - Math.max(r.x, Math.min(r.x + r.width, c.x)),
        c.y - Math.max(r.y, Math.min(r.y + r.height, c.y)),
      ) < circle.radius
    );
  }
  return true;
}
