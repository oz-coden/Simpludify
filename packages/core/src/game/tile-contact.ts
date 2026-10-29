import { defineEvent } from "../foundation/events";
import type { Tilemap } from "../game/tilemap";
import type { Actor } from "../scene/actor";
import type { Collider, ContactGeometry } from "./collider";
import type { ResolvedTileCollision } from "./tilemap-collision";
/** Cell observation at detection; delivered after all position correction. */
export interface TileContact extends ContactGeometry {
  readonly self: Collider;
  readonly selfActor: Actor;
  readonly map: Tilemap<string>;
  readonly tileX: number;
  readonly tileY: number;
  readonly tileId: number | string | null;
  /** Frozen normalized cell policy at observation, distinct from the pair response. */
  readonly policy: ResolvedTileCollision;
}
export const TileContactEnter = defineEvent<TileContact>("TileContactEnter");
export const TileContactStay = defineEvent<TileContact>("TileContactStay");
export const TileContactExit = defineEvent<TileContact>("TileContactExit");
