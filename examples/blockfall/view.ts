import { Actor, Renderable, type Scene, Transform } from "@simpludify/core";
import { cells, type Kind, type Puzzle } from "./logic";

export const colors: Record<Kind, number> = {
  I: 0x67d9ec,
  O: 0xf7d774,
  T: 0xb9a1ee,
  S: 0x73d6ae,
  Z: 0xed8490,
  J: 0x82a8ee,
  L: 0xefaf73,
};
// Rendering is a consumer of the model. Only public Actor/Component APIs are used.
export class BoardView {
  private readonly tiles = new Map<string, { kind: string; actor: Actor }>();
  constructor(private readonly scene: Scene) {}
  sync(puzzle: Puzzle): void {
    const desired = new Map<
      string,
      {
        kind: string;
        x: number;
        y: number;
        color: number;
        opacity: number;
        zIndex: number;
      }
    >();
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 10; x++) {
        const kind = puzzle.board[y]?.[x];
        desired.set(`board:${x}:${y}`, {
          kind: kind ?? "empty",
          x,
          y,
          color: kind ? colors[kind] : 0x192933,
          opacity: 1,
          zIndex: 0,
        });
      }
    if (!puzzle.over)
      for (const [layer, piece, opacity] of [
        ["ghost", puzzle.ghost(), 0.25],
        ["active", puzzle.active, 1],
      ] as const)
        for (const { x, y } of cells(piece)) {
          if (y < 0) continue;
          desired.set(`${layer}:${x}:${y}`, {
            kind: piece.kind,
            x,
            y,
            color: colors[piece.kind],
            opacity,
            zIndex: layer === "active" ? 2 : 1,
          });
        }
    for (const [key, tile] of this.tiles)
      if (desired.get(key)?.kind !== tile.kind) {
        tile.actor.dispose();
        this.tiles.delete(key);
      }
    for (const [key, tile] of desired) {
      if (this.tiles.has(key)) continue;
      const actor = new Actor();
      actor.add(new Transform({ x: tile.x * 24 + 12, y: tile.y * 24 + 12 }));
      actor.add(
        new Renderable({
          width: 22,
          height: 22,
          color: tile.color,
          opacity: tile.opacity,
          zIndex: tile.zIndex,
        }),
      );
      this.scene.add(actor);
      this.tiles.set(key, { kind: tile.kind, actor });
    }
  }
}
export function preview(element: HTMLElement, kind: Kind | null): void {
  element.replaceChildren();
  element.setAttribute("aria-label", kind ? `Piece ${kind}` : "Empty");
  if (!kind) return;
  for (const { x, y } of cells({ kind, x: 0, y: 0, rotation: 0 })) {
    const block = document.createElement("span");
    block.style.gridColumn = String(x + 1);
    block.style.gridRow = String(y + 1);
    block.style.background = `#${colors[kind].toString(16).padStart(6, "0")}`;
    element.append(block);
  }
}
