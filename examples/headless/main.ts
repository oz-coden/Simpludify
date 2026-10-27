import {
  Action,
  ActionController,
  Character,
  defineActions,
  Engine,
} from "@simpludify/core";

const engine = new Engine(42);
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: engine.scene,
  input: engine.input,
});
engine.scene.add(
  Character({ id: "player", movement: controls.reader(Actions.Move) }),
);
const source = controls.createSource();
source.set(Actions.Move, { x: 1, y: 0 });
for (let i = 0; i < 60; i++) engine.step(1 / 60);
console.log(JSON.stringify(engine.snapshot(), null, 2));
engine.dispose();
