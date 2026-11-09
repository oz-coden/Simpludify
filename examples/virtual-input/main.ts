import {
  Action,
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasPanel,
  CanvasRow,
  Character,
  defineActions,
  Game,
  GamepadBindings,
  GamepadButton,
  KeyboardBindings,
  KeyCode,
  Motion,
  type Point,
  VirtualStickMode,
} from "@simpludify/web";
import { startExample } from "../shared/start";

export const Actions = defineActions({
  Move: Action.axis2D(),
  Aim: Action.axis2D(),
  Fire: Action.button(),
  Boost: Action.button(),
});
export const game = new Game<"play">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
export let current: ReturnType<typeof createLab>;
function createLab(context: Parameters<Parameters<typeof game.scene>[1]>[0]) {
  const controls = context.actions(Actions, {
    Move: KeyboardBindings.WASD,
    Aim: KeyboardBindings.Arrows,
    Fire: { keys: [KeyCode.Space] },
    Boost: { keys: [KeyCode.ShiftLeft] },
  });
  const virtual = context.virtualInput;
  const move = virtual.stick(controls, Actions.Move, {
    region: { kind: "rect", x: 0, y: 0, width: 0.44, height: 1 },
    position: { x: 0.22, y: 0.68 },
    radius: 60,
    deadZone: 0.15,
  });
  const aim = virtual.stick(controls, Actions.Aim, {
    region: { kind: "rect", x: 0.56, y: 0, width: 0.44, height: 1 },
    position: { x: 0.78, y: 0.68 },
    radius: 60,
    deadZone: 0.15,
    color: 0xffc879,
  });
  const fire = virtual.button(controls, Actions.Fire, {
    region: { kind: "circle", x: 0.85, y: 0.25, radius: 0.09 },
    radius: 28,
    direction: true,
    deadZone: 0.15,
    color: 0xffa6a6,
  });
  const boost = virtual.button(controls, Actions.Boost, {
    region: { kind: "circle", x: 0.15, y: 0.25, radius: 0.09 },
    radius: 28,
    color: 0xa9bfff,
    holdDelay: 0.5,
  });
  const pad = game.gamepads.bind(controls, {
    index: 0,
    bindings: {
      Move: GamepadBindings.Move,
      Aim: GamepadBindings.RightStick,
      Fire: { buttons: [GamepadButton.South] },
    },
  });
  const program = controls.createSource();
  program.enabled = false;
  const actor = context.add(
    Character({
      id: "player",
      x: 400,
      y: 225,
      movement: controls.reader(Actions.Move),
      speed: 100,
      color: 0x83dfc0,
    }),
  );
  const aimMarker = context.add(
    Character({ id: "aim", x: 460, y: 225, size: 12, color: 0xffc879 }),
  );
  let fired = 0,
    commits = 0,
    cancels = 0,
    holds = 0,
    priorityClicks = 0;
  let lastDirection: Point = { x: 0, y: 0 };
  controls.onPressed(Actions.Fire, () => {
    fired++;
  });
  fire.onCommit((event) => {
    commits++;
    lastDirection = event.direction;
  });
  fire.onCancel(() => {
    cancels++;
  });
  boost.onHold(() => {
    holds++;
  });
  const title = CanvasLabel(
    { text: "Virtual input · move + aim", role: "heading", level: 1 },
    { fontSize: 20 },
  );
  const status = CanvasLabel("Move 0,0 · Aim 0,0", {
    fontSize: 13,
    textWrap: true,
  });
  const show = CanvasButton("Hide input UI", () => {
    virtual.visible = !virtual.visible;
    show.setText(virtual.visible ? "Hide input UI" : "Show input UI");
  });
  const enable = CanvasButton("Disable virtual input", () => {
    virtual.enabled = !virtual.enabled;
    enable.setText(
      virtual.enabled ? "Disable virtual input" : "Enable virtual input",
    );
  });
  const modes = [
    VirtualStickMode.Fixed,
    VirtualStickMode.Floating,
    VirtualStickMode.Follow,
  ];
  const mode = CanvasButton("Stick: fixed", () => {
    const next =
      modes[(modes.indexOf(move.mode) + 1) % modes.length] ??
      VirtualStickMode.Fixed;
    move.mode = next;
    aim.mode = next;
    mode.setText(`Stick: ${next}`);
  });
  const auto = CanvasButton("Program: off", () => {
    program.enabled = !program.enabled;
    controls.keyboardEnabled = !program.enabled;
    pad.enabled = !program.enabled;
    virtual.enabled = !program.enabled;
    if (program.enabled) program.set(Actions.Move, { x: 0.5, y: 0 });
    auto.setText(program.enabled ? "Program: on" : "Program: off");
    enable.setText(
      virtual.enabled ? "Disable virtual input" : "Enable virtual input",
    );
  });
  const pause = CanvasButton("Pause game", () => {
    if (game.engine.paused) game.resume();
    else game.pause();
    pause.setText(game.engine.paused ? "Resume game" : "Pause game");
  });
  const priority = CanvasButton("Canvas priority", () => {
    priorityClicks++;
  });
  const world = CanvasPanel([priority], {
    grow: 1,
    minHeight: 130,
    pointerEvents: "children",
    padding: 8,
    align: "start",
  });
  const small = { fontSize: 12, padding: 7, minHeight: 36 };
  for (const button of [show, enable, mode, auto, pause, priority])
    button.setStyle(small);
  const restart = CanvasButton(
    "Restart scene",
    () => game.changeScene("play"),
    small,
  );
  const root = CanvasColumn(
    [
      title,
      status,
      CanvasRow([show, enable, mode, auto, pause, restart], {
        wrap: true,
        gap: 6,
      }),
      world,
      CanvasLabel(
        "Left: MOVE · Right: AIM · Middle 12%: no stick. Blue: BOOST/hold · Red: FIRE/drag/release. Cross fingers freely; mouse also works. WASD / arrows / Space remain available.",
        { fontSize: 12, textWrap: true },
      ),
    ],
    { height: "100%", gap: 6, padding: 8 },
  );
  const ui = context.canvasUI(root);
  game.bindViewport(ui, world);
  context.onUpdate(() => {
    const movement = controls.value(Actions.Move),
      direction = controls.value(Actions.Aim);
    actor.require(Motion.type).speed = controls.value(Actions.Boost)
      ? 180
      : 100;
    actor.x = Math.max(24, Math.min(776, actor.x));
    actor.y = Math.max(24, Math.min(426, actor.y));
    aimMarker.x = actor.x + direction.x * 65;
    aimMarker.y = actor.y + direction.y * 65;
    status.setText(
      `Move ${movement.x.toFixed(2)},${movement.y.toFixed(2)} · Aim ${direction.x.toFixed(2)},${direction.y.toFixed(2)} · Fire ${fired} · Commit ${commits} · Hold ${holds} · UI ${priorityClicks}`,
    );
  });
  return {
    controls,
    virtual,
    move,
    aim,
    fire,
    boost,
    pad,
    program,
    actor,
    aimMarker,
    ui,
    world,
    get commits() {
      return commits;
    },
    get cancels() {
      return cancels;
    },
    get holds() {
      return holds;
    },
    get fired() {
      return fired;
    },
    get priorityClicks() {
      return priorityClicks;
    },
    get lastDirection() {
      return lastDirection;
    },
  };
}
game.scene("play", (context) => {
  game.resume();
  current = createLab(context);
});
// Live diagnostics are also used by the built-site acceptance fixture.
Object.assign(window, {
  virtualLab: {
    game,
    Actions,
    get current() {
      return current;
    },
  },
});
await startExample(game, "play");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
