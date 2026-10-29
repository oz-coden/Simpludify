import {
  Action,
  ActionController,
  Character,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  defineActions,
  Engine,
  Grid,
  KeyboardBindings,
  KeyCode,
  SpriteSheet,
  Tilemap,
} from "@simpludify/core";
import { expect, it } from "vitest";

it.each([1 / 60, 0.05, 1 / 120])(
  "reaches the geometric wall at x434 with actual ActionMovement at delta %s",
  (delta) => {
    const engine = new Engine(),
      scene = engine.scene,
      actions = defineActions({ Move: Action.axis2D() });
    const controls = new ActionController(actions, {
      scene,
      input: engine.input,
      bindings: { Move: KeyboardBindings.WASD },
    });
    const keyboard = engine.input.createKeyboardSource();
    new CollisionWorld(scene);
    const sheet = SpriteSheet.grid("unused.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    new Tilemap({
      sheet,
      tiles: Grid.generate(20, 16, (x, y) =>
        x === 14 && y >= 4 && y <= 12 ? 0 : null,
      ),
      tileWidth: 32,
      tileHeight: 32,
      collision: { tiles: [{ tile: 0, response: CollisionResponse.Solid }] },
    }).place(scene);
    const actor = scene.add(
      Character({
        x: 250,
        y: 240,
        size: 40,
        movement: controls.reader(actions.Move),
      }),
    );
    actor.add(new CollisionBody());
    actor.add(
      new Collider({
        shape: CollisionShape.Circle,
        radius: 14,
        response: CollisionResponse.Solid,
      }),
    );
    keyboard.set(KeyCode.D, true);
    // 424 is ordinary free-space progress, ten units before the geometric boundary.
    if (delta === 1 / 60) {
      for (let i = 0; i < 58; i++) engine.step(delta);
      expect(actor.x).toBeCloseTo(424);
      expect(controls.value(actions.Move)).toEqual({ x: 1, y: 0 });
    }
    for (let i = 0; i < 240; i++) engine.step(delta);
    expect(actor.x).toBe(434);
    keyboard.set(KeyCode.D, false);
    engine.step(delta);
    expect(actor.x).toBe(434);
    keyboard.set(KeyCode.S, true);
    for (let i = 0; i < 10; i++) engine.step(delta);
    expect(actor.y).toBeGreaterThan(240);
    engine.dispose();
    expect(engine.input.sourceCount).toBe(0);
  },
);
