import { Character, Engine, Movement } from "@simpludify/core";

const engine = new Engine(42);
engine.scene.add(Character({ id: "player", movement: Movement.WASD }));
engine.input.set("KeyD", true);
for (let frame = 0; frame < 60; frame++) engine.step(1 / 60);
console.log(JSON.stringify(engine.snapshot(), null, 2));
engine.dispose();
