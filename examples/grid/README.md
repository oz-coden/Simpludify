# Data-only building placement

`logic.ts` uses the public Core Grid to store independent terrain/building cells, mark blocked rectangles, validate building footprints and remove buildings. It is a headless game-data example, not another browser game or a Tilemap.

```ts
import { PlacementBoard } from "./logic";
const board = new PlacementBoard(8, 6);
board.block(0, 0, 2, 2);
if (board.canPlace(2, 1, 2, 3)) board.place("house", 2, 1, 2, 3);
board.remove("house");
```

Run `npx vitest run tests/unit/grid.test.ts` from the repository root. The implementation and examples compile with the normal strict type check. Grid owns no Actors and never disposes cell objects.
