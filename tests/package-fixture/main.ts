import { Engine } from "@simpludify/core";
import {
  Action,
  ActionController,
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasPanel,
  CanvasTextInput,
  Character,
  defineActions,
  Game,
  GamepadButton,
  type InputCapture,
  KeyboardBindings,
  KeyCode,
  MouseButton,
  VirtualRegions,
  VirtualStickMode,
} from "@simpludify/web";

// Explicit CSS is optional: the Web entry also includes it automatically.
const game = new Game<"first" | "second">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
const actions = defineActions({ Move: Action.axis2D(), Jump: Action.button() });
let currentControls: ActionController<typeof actions>;
let capture: InputCapture | undefined;
const image = new URL("./sprite.svg", import.meta.url).href;
let clicks = 0;
let disposals = 0;
let player = Character();
let button = CanvasButton("Next scene", () => {});
let ui: ReturnType<typeof CanvasColumn>;
let virtualDisposed = () => false;
for (const id of ["first", "second"] as const) {
  game.scene(id, ({ scene, add, canvasUI, virtualInput }) => {
    scene.onDispose(() => {
      disposals++;
    });
    const controls = new ActionController(actions, {
      scene,
      input: game.engine.input,
      bindings: {
        Move: KeyboardBindings.WASD,
        Jump: {
          keys: [KeyCode.Space],
          mouse: [MouseButton.Left],
          gamepad: { buttons: [GamepadButton.South] },
        },
      },
    });
    currentControls = controls;
    game.gamepads.bind(controls, { index: 0 });
    const stick = virtualInput.stick(controls, actions.Move, {
      region: VirtualRegions.Right,
      mode: VirtualStickMode.Floating,
      enabled: false,
      visible: false,
    });
    virtualDisposed = () => stick.disposed;
    player = add(
      Character({
        x: 100,
        y: 250,
        movement: controls.reader(actions.Move),
        source: { kind: "image", url: image },
      }),
    );
    add(Character({ x: 200, y: 250, source: { kind: "image", url: image } }));
    button = CanvasButton("Next scene", () => {
      clicks++;
      return game.goTo(id === "first" ? "second" : "first");
    });
    ui = CanvasColumn(
      [
        CanvasLabel({ text: "Packed SDK", role: "heading", level: 1 }),
        button,
        CanvasTextInput({
          label: "Coordinate",
          value: "001",
          inputMode: "numeric",
        }),
      ],
      {
        padding: 16,
        gap: 12,
      },
    );
    const region = CanvasPanel([], {
      grow: 1,
      minHeight: 100,
      pointerEvents: "none",
    });
    const canvas = canvasUI(CanvasColumn([ui, region], { height: "100%" }));
    game.bindViewport(canvas, region);
  });
}
await game.run("first");
if (!(game.engine instanceof Engine)) throw new Error("Duplicate Core runtime");
const probe = {
  game,
  get jump() {
    game.engine.step(0);
    return currentControls.value(actions.Jump);
  },
  roundTrip() {
    const actor = player;
    const saved = currentControls.exportBindings();
    currentControls.rebind(actions.Jump, {});
    currentControls.importBindings(saved);
    return (
      actor === player &&
      JSON.stringify(saved) === JSON.stringify(currentControls.exportBindings())
    );
  },
  beginCapture() {
    capture = game.captureInput({ devices: ["keyboard"] });
    return capture.state;
  },
  async readCapture() {
    const input = await capture?.result;
    if (input) currentControls.addBindings(actions.Jump, input.binding);
    return input;
  },
  get x() {
    return player.x;
  },
  get clicks() {
    return clicks;
  },
  get disposals() {
    return disposals;
  },
  get bounds() {
    return { ...button.bounds };
  },
  get uiDisposed() {
    return ui.disposed;
  },
  get virtualDisposed() {
    return virtualDisposed();
  },
  dispose() {
    game.dispose();
    game.dispose();
  },
};
declare global {
  interface Window {
    packageProbe: typeof probe;
  }
}
window.packageProbe = probe;
