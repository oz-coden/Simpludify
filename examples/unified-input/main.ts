import {
  Action,
  CanvasButton,
  CanvasColumn,
  CanvasHoldButton,
  CanvasLabel,
  CanvasPanel,
  CanvasRow,
  CanvasTextInput,
  Character,
  defineActions,
  Game,
  GamepadBindings,
  GamepadButton,
  type GamepadLayout,
  gamepadButtonLabel,
  KeyboardBindings,
  KeyCode,
} from "@simpludify/web";
import { startExample } from "../shared/start";

export const Actions = defineActions({
  Move: Action.axis2D(),
  Fire: Action.button(),
  Pause: Action.button(),
});
export const game = new Game<"play">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
export type Mode = "Keyboard + pad" | "Pad only" | "Program";
const modes: readonly Mode[] = ["Keyboard + pad", "Pad only", "Program"];
function createPlayer(
  context: Parameters<Parameters<typeof game.scene>[1]>[0],
  index: number,
) {
  const controls = context.actions(Actions, {
    Move: index === 0 ? KeyboardBindings.WASD : KeyboardBindings.Arrows,
    Fire: { keys: [index === 0 ? KeyCode.F : KeyCode.Slash] },
    Pause: { keys: index === 0 ? [KeyCode.P] : [] },
  });
  const pad = game.gamepads.bind(controls, {
    index,
    bindings: {
      Move: GamepadBindings.Move,
      Fire: { buttons: [GamepadButton.South] },
      Pause: { buttons: [GamepadButton.Start] },
    },
  });
  const program = controls.createSource(),
    touch = controls.createSource();
  const touchSources = [touch];
  let time = 0;
  const actor = context.add(
    Character({
      id: `player-${index + 1}`,
      x: 250 + index * 300,
      y: 225,
      color: index === 0 ? 0x83dfc0 : 0xffcb79,
      movement: controls.reader(Actions.Move),
      speed: 100,
    }),
  );
  let mode: Mode = index === 0 ? "Keyboard + pad" : "Pad only",
    fires = 0;
  const status = CanvasLabel("", { fontSize: 12, width: "100%" });
  const modeButton = CanvasButton(
    "",
    () =>
      setMode(
        modes[(modes.indexOf(mode) + 1) % modes.length] ?? "Keyboard + pad",
      ),
    { minHeight: 44, fontSize: 13, width: "100%" },
  );
  const assign = CanvasButton(
    `P${index + 1} pad: ${index}`,
    () => {
      const indices = game.gamepads.devices.map((p) => p.index);
      const next = indices[(indices.indexOf(pad.index) + 1) % indices.length];
      if (next !== undefined) pad.assign(next);
      assign.setText(`P${index + 1} pad: ${pad.index}`);
    },
    { minHeight: 44, fontSize: 13, width: "100%" },
  );
  function setMode(value: Mode) {
    mode = value;
    controls.keyboardEnabled = value === "Keyboard + pad";
    pad.enabled = value !== "Program";
    program.enabled = value === "Program";
    for (const source of touchSources) source.enabled = value !== "Program";
    modeButton.setText(`P${index + 1}: ${value}`);
  }
  setMode(mode);
  controls.onPressed(Actions.Fire, () => {
    fires++;
    refresh();
  });
  controls.onPressed(Actions.Pause, () =>
    game.paused ? game.resume() : game.pause(),
  );
  const refresh = () =>
    status.setText(
      `P${index + 1}: South=${gamepadButtonLabel(GamepadButton.South, { layout: displayLayout ?? pad.info?.inferredLayout ?? "generic" })}; ${pad.usable ? "ready" : "no mapped pad"}; fire=${fires}`,
    );
  context.onUpdate((seconds) => {
    // Program policy belongs to the game; it writes the same source API as a transport adapter.
    time += seconds;
    program.set(Actions.Move, {
      x: Math.sin(time * 0.7 + index),
      y: 0,
    });
    actor.x = Math.max(24, Math.min(776, actor.x));
    actor.y = Math.max(24, Math.min(426, actor.y));
    refresh();
  });
  game.gamepads.onChange(refresh, context.scene);
  const hold = (caption: string, x: number, y: number) => {
    const source = controls.createSource();
    touchSources.push(source);
    return CanvasHoldButton(
      `P${index + 1} ${caption}`,
      (held) => source.set(Actions.Move, held ? { x, y } : { x: 0, y: 0 }),
      { minWidth: 48, minHeight: 44, fontSize: 13 },
    );
  };
  const touches = CanvasRow(
    [
      hold("Left", -1, 0),
      hold("Right", 1, 0),
      hold("Up", 0, -1),
      hold("Down", 0, 1),
      CanvasHoldButton(
        `P${index + 1} Fire`,
        (held) => touch.set(Actions.Fire, held),
        { minWidth: 58, minHeight: 44, fontSize: 13 },
      ),
    ],
    { gap: 4, wrap: true, width: "100%" },
  );
  return {
    controls,
    pad,
    program,
    touch,
    actor,
    setMode,
    refresh,
    status,
    touches,
    configuration: CanvasColumn([modeButton, assign, status], {
      grow: 1,
      shrink: 1,
      width: "50%",
      gap: 4,
      minWidth: 0,
    }),
  };
}
export let players: ReturnType<typeof createPlayer>[] = [];
let displayLayout: GamepadLayout | undefined;
game.scene("play", (context) => {
  players = [createPlayer(context, 0), createPlayer(context, 1)];
  const devices = CanvasLabel(
    "Focus the game; press a pad button if the browser has not exposed it yet.",
    { fontSize: 12, width: "100%" },
  );
  const refreshDevices = () =>
    devices.setText(
      game.gamepads.devices.length
        ? game.gamepads.devices
            .map(
              (p) =>
                `#${p.index} ${p.id}; ${p.mapping || "unmapped"}; ${p.buttonCount} buttons/${p.axisCount} axes; layout hint: ${p.inferredLayout}`,
            )
            .join("\n")
        : game.gamepads.available
          ? "No exposed gamepad. Focus this game and press a physical pad button."
          : "Gamepad API unavailable or blocked. Keyboard, touch and program input remain usable.",
    );
  game.gamepads.onChange(refreshDevices, context.scene);
  const field = CanvasPanel([], {
    width: "100%",
    grow: 1,
    minHeight: 140,
    background: 0x172b37,
    pointerEvents: "none",
  });
  const layouts: readonly (GamepadLayout | undefined)[] = [
    undefined,
    "generic",
    "xbox",
    "playstation",
    "nintendo",
  ];
  const labels = CanvasButton(
    "Labels: auto",
    () => {
      displayLayout =
        layouts[(layouts.indexOf(displayLayout) + 1) % layouts.length];
      labels.setText(`Labels: ${displayLayout ?? "auto"}`);
      for (const player of players) player.refresh();
    },
    { minHeight: 44, fontSize: 13 },
  );
  const pause = CanvasButton(
    "Pause / Resume",
    () => (game.paused ? game.resume() : game.pause()),
    { minHeight: 44, fontSize: 13 },
  );
  const restart = CanvasButton("New Scene", () => game.goTo("play"), {
    minHeight: 44,
    fontSize: 13,
  });
  const notes = CanvasTextInput(
    { label: "Notes", placeholder: "Native text editing owns physical input" },
    { width: "100%", height: 36, fontSize: 13 },
  );
  const ui = context.canvasUI(
    CanvasColumn(
      [
        CanvasLabel(
          { text: "Unified input · 2 players", role: "heading", level: 1 },
          { fontSize: 22 },
        ),
        CanvasColumn([devices], {
          width: "100%",
          height: 48,
          shrink: 0,
          scroll: "vertical",
          clip: true,
        }),
        CanvasRow(
          players.map((p) => p.configuration),
          { gap: 8, width: "100%", wrap: false },
        ),
        CanvasRow([labels, pause, restart], { gap: 4, wrap: true, shrink: 0 }),
        field,
        ...players.map((p) => p.touches),
        notes,
      ],
      {
        padding: 10,
        gap: 6,
        width: "100%",
        height: "100%",
        pointerEvents: "children",
        background: 0x101922,
      },
    ),
  );
  game.bindViewport(ui, field);
  context.onActivate(() => {
    game.resume();
    for (const player of players) player.refresh();
  });
});
// Expose the live sample state for diagnostics and built-site acceptance checks.
Object.assign(window, {
  inputLab: {
    game,
    Actions,
    get players() {
      return players;
    },
  },
});
await startExample(game, "play");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
