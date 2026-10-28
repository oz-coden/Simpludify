import { Grid, SpriteSheet, Tilemap } from "@simpludify/core";
export function tileTypes() {
  const sheet = SpriteSheet.grid("tiles", {
    frameWidth: 16,
    frameHeight: 16,
    names: { grass: 0, water: 1 },
  });
  const map = new Tilemap({
    sheet,
    tiles: [["grass", null, 2]],
    tileWidth: 16,
    tileHeight: 20,
  });
  map.set(0, 0, "water");
  // @ts-expect-error named frame typo
  map.set(0, 0, "watre");
  // @ts-expect-error constructor must not widen frame names
  new Tilemap({ sheet, tiles: [["typo"]], tileWidth: 16, tileHeight: 16 });
  // @ts-expect-error dimensions required
  new Tilemap({ sheet, tiles: [[0]] });
  new Tilemap({
    sheet,
    tiles: [[0]],
    tileWidth: 16,
    tileHeight: 16,
    // @ts-expect-error invalid display option
    visible: "yes",
  });
  new Tilemap({
    sheet,
    tiles: new Grid<number | null>(2, 2, null),
    tileWidth: 16,
    tileHeight: 16,
  });
  // @ts-expect-error snapshot retains names
  map.copyTiles().set(0, 0, "typo");
}
