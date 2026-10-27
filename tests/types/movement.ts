import {
  Action,
  ActionController,
  ActionMovement,
  Character,
  type ComponentPhase,
  defineActions,
  Engine,
  Motion,
} from "@simpludify/core";
export function movementTypes(): void {
  const engine = new Engine({ seed: 42 }),
    actions = defineActions({ Move: Action.axis2D(), Turn: Action.axis1D() });
  const controls = new ActionController(actions, {
    scene: engine.scene,
    input: engine.input,
  });
  const player = Character(),
    motion = player.require(Motion.type);
  motion.speed = 0;
  motion.direction.x = 2;
  const adapter = new ActionMovement(controls.reader(actions.Move), {
    scale: 2,
  });
  adapter.scale = 0.5;
  // @ts-expect-error direction identity cannot be replaced
  motion.direction = { x: 0, y: 0 };
  // @ts-expect-error speed is numeric
  motion.speed = "fast";
  // @ts-expect-error scale is numeric
  adapter.scale = true;
  // @ts-expect-error movement requires Axis2D, not Axis1D
  new ActionMovement(controls.reader(actions.Turn));
  // @ts-expect-error phases are a closed named union
  const phase: ComponentPhase = "physics";
  void phase;
  player.dispose();
  engine.dispose();
}
