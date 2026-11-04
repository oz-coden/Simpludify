import {
  Action,
  Button,
  CanvasButton,
  CanvasPanel,
  Character,
  defineActions,
  Game,
  GamepadBindings,
  GamepadButton,
  type InputCapture,
  InputDevice,
  KeyboardBindings,
  KeyCode,
  Label,
  MouseButton,
  Panel,
} from "@simpludify/web";
import { startExample } from "../shared/start";

export const Actions = defineActions({
  Move: Action.axis2D(),
  Jump: Action.button(),
  Attack: Action.button(),
});
export const game = new Game<"play">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
export let current: ReturnType<typeof createLab>;
export let capture: InputCapture | undefined;
export let lastCapture: Awaited<InputCapture["result"]>;
export let saved:
  | ReturnType<ReturnType<typeof createLab>["controls"]["exportBindings"]>
  | undefined;
function createLab(context: Parameters<Parameters<typeof game.scene>[1]>[0]) {
  const controls = context.actions(Actions, {
    Move: { ...KeyboardBindings.WASD, gamepad: GamepadBindings.LeftStick },
    Jump: {
      keys: [KeyCode.Space],
      mouse: [MouseButton.Back],
      gamepad: { buttons: [GamepadButton.South] },
    },
    Attack: { keys: [KeyCode.E], mouse: [MouseButton.Left] },
  });
  const pad = game.gamepads.bind(controls, { index: 0 });
  const actor = context.add(
    Character({
      x: 400,
      y: 300,
      movement: controls.reader(Actions.Move),
      speed: 90,
      color: 0x83dfc0,
    }),
  );
  const program = controls.createSource();
  const stick = context.virtualInput.stick(controls, Actions.Move, {
    region: { kind: "rect", x: 0, y: 0.5, width: 0.35, height: 0.5 },
    position: { x: 0.18, y: 0.78 },
    radius: 45,
  });
  const virtualButton = context.virtualInput.button(controls, Actions.Jump, {
    region: { kind: "circle", x: 0.85, y: 0.8, radius: 0.07 },
    radius: 24,
  });
  let presses = 0,
    releases = 0,
    uiClicks = 0;
  controls.onPressed(Actions.Jump, () => {
    presses++;
  });
  const status = Label(
    "Space / mouse Back / pad South → Jump. WASD / pad / stick → Move.",
  );
  const captureStatus = Label("Capture: idle");
  const refresh = () =>
    status.setText(
      `Jump=${controls.value(Actions.Jump)} presses=${presses} releases=${releases}; Attack=${controls.value(Actions.Attack)}; ${pad.usable ? "pad ready" : "pad unavailable"}`,
    );
  context.onUpdate(() => {
    releases += controls.button(Actions.Jump).releaseCount;
    actor.x = Math.max(20, Math.min(780, actor.x));
    actor.y = Math.max(230, Math.min(430, actor.y));
    refresh();
  });
  function begin(devices = Object.values(InputDevice)) {
    capture?.cancel();
    capture = game.captureInput({ devices });
    lastCapture = undefined;
    const session = capture;
    captureStatus.setText(
      "Release held inputs, then press a key, canvas mouse button or pad button. Escape is bindable.",
    );
    void session.result.then((result) => {
      if (context.scene.disposed || capture !== session) return;
      lastCapture = result;
      if (result) {
        controls.addBindings(Actions.Jump, result.binding);
        // Device assignment is separate from a portable button binding.
        if (result.device === InputDevice.Gamepad) pad.assign(result.index);
      }
      captureStatus.setText(
        result
          ? `Added Jump binding: ${JSON.stringify(result)}`
          : "Capture: cancelled",
      );
    });
    return session;
  }
  context.ui(
    Panel(
      [
        status,
        captureStatus,
        Button("Capture Jump input", () => {
          begin();
        }),
        Button("Cancel capture", () => {
          capture?.cancel();
        }),
        Button("Save bindings", () => {
          saved = controls.exportBindings();
        }),
        Button("Restore saved bindings", () => {
          if (saved) controls.importBindings(saved);
        }),
        Button("Reset Jump", () => {
          controls.resetBindings(Actions.Jump);
        }),
      ],
      { title: "Input bindings" },
    ),
  );
  const canvasButton = CanvasButton(
    "Canvas UI",
    () => {
      uiClicks++;
    },
    { minWidth: 100, minHeight: 40 },
  );
  context.canvasUI(
    CanvasPanel([canvasButton], {
      width: "100%",
      height: "100%",
      align: "center",
      justify: "end",
      padding: 16,
      pointerEvents: "children",
    }),
  );
  return {
    controls,
    pad,
    actor,
    program,
    stick,
    virtualButton,
    canvasButton,
    begin,
    get presses() {
      return presses;
    },
    get uiClicks() {
      return uiClicks;
    },
  };
}
game.scene("play", (context) => {
  current = createLab(context);
});
await startExample(game, "play");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
