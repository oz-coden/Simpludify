/** Type-only design proposal. No implementation and no Core/Web export. */
import type {
  Actor,
  Collider,
  CollisionResponse,
  EventType,
  Tilemap,
  TilemapOptions,
  WorldPoint,
} from "@simpludify/core";

export interface TileCollisionPolicy {
  readonly response: CollisionResponse;
  readonly layer?: number;
  readonly mask?: number;
}
export interface NormalizedTilePolicy {
  readonly response: CollisionResponse;
  readonly layer: number;
  readonly mask: number;
}
export interface TileCollisionOptions<Name extends string> {
  readonly tiles: readonly (TileCollisionPolicy & {
    readonly tile: number | NoInfer<Name>;
  })[];
}
export declare class ProposedTilemap<
  Name extends string = never,
> extends Tilemap<Name> {
  constructor(
    options: TilemapOptions<Name> & { collision?: TileCollisionOptions<Name> },
  );
  get collisionEnabled(): boolean;
  set collisionEnabled(value: boolean);
  get collisionRevision(): number;
  getCollision(x: number, y: number): Readonly<NormalizedTilePolicy> | null;
  setCollision(x: number, y: number, policy: TileCollisionPolicy | null): void;
  resetCollision(x: number, y: number): void;
  setTileCollision(
    tile: number | NoInfer<Name>,
    policy: TileCollisionPolicy | null,
  ): void;
}
export type CollisionTarget =
  | Readonly<{ kind: "collider"; collider: Collider; actor: Actor }>
  | Readonly<{
      kind: "tile";
      map: Tilemap<string>;
      tileX: number;
      tileY: number;
      tileId: number | string | null;
      policy: Readonly<NormalizedTilePolicy>;
    }>;
export interface ProposedContact {
  readonly self: Collider;
  readonly selfActor: Actor;
  readonly other: CollisionTarget;
  readonly normalX: number;
  readonly normalY: number;
  readonly depth: number;
  readonly response: CollisionResponse;
  readonly resolved: boolean;
  /** World Transform origin / other Transform origin or tile top-left, at end of solving. */
  readonly selfPosition: WorldPoint;
  readonly otherPosition: WorldPoint;
}
/** Formal stage will migrate the existing tokens, not publish this suffix or parallel families. */
export declare const ProposedContactEnter: EventType<ProposedContact>;
