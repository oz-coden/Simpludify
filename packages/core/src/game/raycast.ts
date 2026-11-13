import { EngineError } from "../foundation/diagnostics";
import type { Point, TilePoint, WorldPoint } from "../graphics/coordinates";
import type { Actor } from "../scene/actor";
import { type Collider, CollisionShape } from "./collider";
import type { Geometry } from "./collision-geometry";
import type { CollisionResponse } from "./collision-policy";
import type { Tilemap } from "./tilemap";
import type { ResolvedTileCollision } from "./tilemap-collision";

export type RaycastQuery =
  | { readonly from: Point; readonly to: Point }
  | {
      readonly origin: Point;
      readonly direction: Point;
      readonly maxDistance: number;
    };

export interface RaycastOptions {
  /** Matches target layers. Omit to query all layers. */
  readonly layers?: number;
  readonly includeTriggers?: boolean;
  readonly targets?: "colliders" | "tiles" | "all";
  readonly exclude?: readonly (Actor | Collider | Tilemap<string>)[];
}

interface HitGeometry {
  readonly point: WorldPoint;
  readonly distance: number;
  /** Outward surface normal. Null when the origin is strictly inside. */
  readonly normal: Point | null;
  readonly layer: number;
  readonly response: CollisionResponse;
}
export interface ColliderRaycastHit extends HitGeometry {
  readonly kind: "collider";
  readonly actor: Actor;
  readonly collider: Collider;
}
export interface TileRaycastHit extends HitGeometry {
  readonly kind: "tile";
  readonly map: Tilemap<string>;
  readonly tile: TilePoint;
  readonly tileId: number | string | null;
  readonly policy: ResolvedTileCollision;
}
export type RaycastHit = ColliderRaycastHit | TileRaycastHit;

interface Ray {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly length: number;
}

export function queryRay(query: RaycastQuery): Ray {
  const segment = "from" in query;
  const origin = segment ? query.from : query.origin;
  const dx = segment ? query.to.x - origin.x : query.direction.x;
  const dy = segment ? query.to.y - origin.y : query.direction.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  const norm = size === 0 ? 0 : Math.hypot(dx / size, dy / size);
  const length = segment ? size * norm : query.maxDistance;
  if (
    !Number.isFinite(origin.x) ||
    !Number.isFinite(origin.y) ||
    !Number.isFinite(size) ||
    !Number.isFinite(length) ||
    length < 0 ||
    (!segment && size === 0)
  )
    throw new EngineError(
      "INVALID_VALUE",
      "Ray needs finite coordinates, a valid direction and a nonnegative distance",
    );
  const nx = size === 0 ? 0 : dx / size / norm;
  const ny = size === 0 ? 0 : dy / size / norm;
  if (
    !Number.isFinite(origin.x + nx * length) ||
    !Number.isFinite(origin.y + ny * length)
  )
    throw new EngineError("INVALID_VALUE", "Ray endpoint must be finite");
  return { x: origin.x, y: origin.y, dx: nx, dy: ny, length };
}

export interface RayIntersection {
  distance: number;
  nx: number;
  ny: number;
}

/** A corner can reach the two slabs a few ULPs apart after normalization. */
function beyond(distance: number, end: number): boolean {
  if (!(distance > end)) return false;
  if (!Number.isFinite(distance) || !Number.isFinite(end)) return true;
  return (
    distance - end >
    Math.max(Math.abs(distance), Math.abs(end)) * (Number.EPSILON * 8)
  );
}

export function intersectRay(
  ray: Ray,
  shape: CollisionShape,
  g: Geometry,
  limit: number,
  out: RayIntersection,
): boolean {
  const x = ray.x - g.x,
    y = ray.y - g.y;
  if (shape === CollisionShape.Circle) {
    const initial = Math.hypot(x, y);
    if (initial <= g.radius) {
      out.distance = 0;
      out.nx = initial !== 0 && initial === g.radius ? x / initial : 0;
      out.ny = initial !== 0 && initial === g.radius ? y / initial : 0;
      return true;
    }
    if (!limit || !Number.isFinite(initial)) return false;
    const along = -(x * ray.dx + y * ray.dy);
    const across = x * ray.dy - y * ray.dx;
    if (along < 0 || beyond(Math.abs(across), g.radius)) return false;
    const ratio = Math.max(-1, Math.min(1, across / g.radius));
    const offset = g.radius * Math.sqrt(Math.max(0, 1 - ratio * ratio));
    const distance = along - offset;
    if (!Number.isFinite(distance) || distance < 0 || beyond(distance, limit))
      return false;
    out.distance = Math.min(distance, limit);
    out.nx = ratio * ray.dy - (offset / g.radius) * ray.dx;
    out.ny = -ratio * ray.dx - (offset / g.radius) * ray.dy;
    return true;
  }
  const localX = x * g.cos + y * g.sin;
  const localY = -x * g.sin + y * g.cos;
  const dx = ray.dx * g.cos + ray.dy * g.sin;
  const dy = -ray.dx * g.sin + ray.dy * g.cos;
  const nearX = dx === 0 ? -Infinity : ((dx > 0 ? -g.hx : g.hx) - localX) / dx;
  const farX = dx === 0 ? Infinity : ((dx > 0 ? g.hx : -g.hx) - localX) / dx;
  const nearY = dy === 0 ? -Infinity : ((dy > 0 ? -g.hy : g.hy) - localY) / dy;
  const farY = dy === 0 ? Infinity : ((dy > 0 ? g.hy : -g.hy) - localY) / dy;
  if (
    (dx === 0 && Math.abs(localX) > g.hx) ||
    (dy === 0 && Math.abs(localY) > g.hy)
  )
    return false;
  const distance = Math.max(0, nearX, nearY);
  const exit = Math.min(limit, farX, farY);
  if (
    !Number.isFinite(distance) ||
    Number.isNaN(exit) ||
    beyond(distance, exit)
  )
    return false;
  let nx = 0,
    ny = 0;
  if (distance === 0) {
    if (Math.abs(localX) === g.hx) nx = localX < 0 ? -1 : 1;
    else if (Math.abs(localY) === g.hy) ny = localY < 0 ? -1 : 1;
  } else if (
    nearX >= nearY ||
    (Number.isFinite(nearX) && !beyond(nearY, nearX))
  )
    nx = dx > 0 ? -1 : 1;
  else ny = dy > 0 ? -1 : 1;
  out.distance = Math.min(distance, limit);
  out.nx = nx * g.cos - ny * g.sin;
  out.ny = nx * g.sin + ny * g.cos;
  return true;
}

function gridCoordinate(value: number): number {
  const boundary = Math.round(value);
  return Math.abs(value - boundary) <= Math.abs(value) * Number.EPSILON * 4
    ? boundary
    : value;
}

/** Enumerate a closed segment's candidate cells by horizontal strips, including corner ties. */
export function visitRayTiles(
  ray: Ray,
  map: Tilemap<string>,
  limit: number,
  visit: (x: number, y: number, limit: number) => number,
): void {
  const { tileWidth: w, tileHeight: h } = map;
  const left = map.x;
  const right = left + map.width * w;
  let entry = 0;
  if (ray.dx === 0) {
    if (ray.x < left || ray.x > right) return;
  } else {
    const a = (left - ray.x) / ray.dx;
    const b = (right - ray.x) / ray.dx;
    entry = Math.max(0, Math.min(a, b));
    limit = Math.min(limit, Math.max(a, b));
    if (beyond(entry, limit)) return;
    entry = Math.min(entry, limit);
  }
  const firstY = gridCoordinate((ray.y + ray.dy * entry - map.y) / h);
  const lastY = gridCoordinate((ray.y + ray.dy * limit - map.y) / h);
  const lowY = Math.max(0, Math.ceil(Math.min(firstY, lastY)) - 1);
  const highY = Math.min(map.height - 1, Math.floor(Math.max(firstY, lastY)));
  const stepY = ray.dy < 0 ? -1 : 1;
  for (let y = stepY > 0 ? lowY : highY; y >= lowY && y <= highY; y += stepY) {
    const edgeA = ray.dy === 0 ? entry : (map.y + y * h - ray.y) / ray.dy;
    const edgeB = ray.dy === 0 ? limit : (map.y + (y + 1) * h - ray.y) / ray.dy;
    const start = Math.max(entry, Math.min(edgeA, edgeB));
    const end = Math.min(limit, Math.max(edgeA, edgeB));
    if (beyond(start, limit)) break;
    if (beyond(start, end)) continue;
    const firstX = gridCoordinate(
      (ray.x + ray.dx * Math.min(start, end) - map.x) / w,
    );
    const lastX = gridCoordinate((ray.x + ray.dx * end - map.x) / w);
    const lowX = Math.max(0, Math.ceil(Math.min(firstX, lastX)) - 1);
    const highX = Math.min(map.width - 1, Math.floor(Math.max(firstX, lastX)));
    const stepX = ray.dx < 0 ? -1 : 1;
    for (
      let x = stepX > 0 ? lowX : highX;
      x >= lowX && x <= highX;
      x += stepX
    ) {
      if (ray.dx !== 0) {
        const edge = left + (stepX > 0 ? x : x + 1) * w;
        if (beyond((edge - ray.x) / ray.dx, limit)) break;
      }
      limit = visit(x, y, limit);
    }
  }
}

export function rayHitGeometry(
  ray: Ray,
  hit: RayIntersection,
  policy: Pick<ResolvedTileCollision, "layer" | "response">,
): HitGeometry {
  return {
    point: {
      space: "world",
      x: ray.x + hit.distance * ray.dx,
      y: ray.y + hit.distance * ray.dy,
    },
    distance: hit.distance,
    normal:
      hit.nx === 0 && hit.ny === 0 ? null : { x: hit.nx || 0, y: hit.ny || 0 },
    layer: policy.layer,
    response: policy.response,
  };
}
