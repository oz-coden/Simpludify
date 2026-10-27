import {
  Button,
  containsScreenPoint,
  Game,
  Label,
  Layout,
  Panel,
} from "@simpludify/web";
import { startExample } from "../shared/start";
import { Beacon, BeaconCollected, createPlayer, spawnBeacon } from "./logic";

const game = new Game<"field">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
game.scene("field", ({ scene, ui, signal, onActivate }) => {
  createPlayer(scene, game.engine.input);
  const score = Label("Beacons collected: 0");
  const spawn = () => {
    if (scene.actors.filter((actor) => actor.get(Beacon.type)).length < 24)
      spawnBeacon(
        scene,
        60 + game.engine.random() * 680,
        90 + game.engine.random() * 300,
      );
  };
  for (let i = 0; i < 6; i++) spawn();
  scene.every(2, spawn);
  scene.events.on(
    BeaconCollected,
    ({ total }) => score.setText(`Beacons collected: ${total}`),
    scene,
  );
  onActivate(() => {
    game.camera.x = 0;
    game.camera.y = 0;
    game.camera.zoom = 1;
  });
  ui(
    Panel(
      [
        Label(
          "Move with WASD to collect the amber beacons. Click empty world space to add one.",
          { muted: true },
        ),
        score,
        Panel(
          [
            Button("Add beacon", spawn),
            Button("Zoom", () => {
              game.camera.zoom = game.camera.zoom === 1 ? 1.5 : 1;
            }),
            Button("Restart", () => game.goTo("field")),
          ],
          { layout: Layout.Row },
        ),
      ],
      { title: "Beacon field" },
    ),
  );
  game.element.addEventListener(
    "pointerup",
    (event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(".s-panel")
      )
        return;
      const point = game.pointerToWorld(event);
      if (containsScreenPoint(game.view, game.worldToScreen(point)))
        spawnBeacon(scene, point.x, point.y);
    },
    { signal },
  );
});
await startExample(game, "field");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
