import {
  Action,
  ActionController,
  Actor,
  defineActions,
  Engine,
  KeyCode,
  Scene,
  Transform,
  Tween,
} from "@simpludify/core";
import { expect, it } from "vitest";

it("freezes retained actors, clocks and input until the same scene resumes", () => {
  const engine = new Engine();
  const home = new Scene("home");
  const away = new Scene("away");
  const actor = home.add(new Actor());
  const transform = actor.add(new Transform());
  const actions = defineActions({ Use: Action.button() });
  const controls = new ActionController(actions, {
    scene: home,
    input: engine.input,
    bindings: { Use: { keys: [KeyCode.Space] } },
  });
  const keyboard = engine.input.createKeyboardSource();
  const events: string[] = [];
  home.onActivate(() => events.push("activate"));
  home.onDeactivate(() => events.push("deactivate"));
  home.onDispose(() => events.push("dispose"));
  home.after(1, () => events.push("timer"));
  const position = Tween.bind({
    target: transform,
    key: "x",
    read: () => transform.x,
    write: (value) => {
      transform.x = value;
    },
    owner: actor,
    scope: () => home,
  });
  home.tweens.play(Tween.to(position, 10, { duration: 1 }));

  engine.activate(home);
  keyboard.set(KeyCode.Space, true);
  engine.step(0.5);
  expect(controls.value(actions.Use)).toBe(true);
  expect(transform.x).toBe(5);
  engine.activate(away, { previous: "retain" });
  expect(home.state).toBe("inactive");
  expect(controls.active).toBe(false);
  expect(engine.input.acceptsKey(KeyCode.Space)).toBe(false);
  keyboard.set(KeyCode.Space, true);
  engine.step(5);
  expect(transform.x).toBe(5);
  expect(events).toEqual(["activate", "deactivate"]);
  expect(() => new Engine().activate(home)).toThrowError(
    expect.objectContaining({ code: "SCENE_OWNERSHIP" }),
  );

  engine.activate(home);
  expect(away.disposed).toBe(true);
  engine.step(0.5);
  expect(controls.value(actions.Use)).toBe(false);
  expect(transform.x).toBe(10);
  expect(events).toEqual(["activate", "deactivate", "activate", "timer"]);
  engine.activate(new Scene("last"), { previous: "retain" });
  engine.dispose();
  expect(home.disposed && actor.disposed && controls.disposed).toBe(true);
  expect(events).toEqual([
    "activate",
    "deactivate",
    "activate",
    "timer",
    "deactivate",
    "dispose",
  ]);
});
