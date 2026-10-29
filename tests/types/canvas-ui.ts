import {
  Action,
  CanvasButton,
  CanvasHoldButton,
  CanvasLabel,
  CanvasPanel,
  CanvasRow,
  type CanvasStyle,
  defineActions,
  Game,
  KeyboardBindings,
  PointerClick,
} from "@simpludify/web";

const game = new Game<"title" | "play">();
const A = defineActions({
  Move: Action.axis2D(),
  Fire: Action.button(),
  Aim: Action.axis3D(),
});
game.scene("play", ({ actions, canvasUI, pointer }) => {
  const c = actions(A, { Move: KeyboardBindings.WASD });
  const b = CanvasHoldButton("Fire", (held) => s.set(A.Fire, held));
  const s = c.createSource(b);
  const label = CanvasLabel("HUD");
  canvasUI(
    CanvasPanel([
      CanvasRow([label, b], { width: "50%", wrap: true }),
      CanvasButton("Menu", () => game.goTo("title")),
    ]),
  );
  pointer.events.on(PointerClick, (e) => {
    const x: number = e.world.x;
    label.setText(`${x}`);
  });
  // @ts-expect-error unknown Action name
  actions(A, { Unknown: KeyboardBindings.WASD });
  // @ts-expect-error wrong Action dimension
  s.set(A.Move, true);
  // @ts-expect-error unknown UI style
  b.setStyle({ flexFlow: "row" });
  // @ts-expect-error invalid direction
  CanvasRow([], { direction: "reverse" });
  // @ts-expect-error invalid dimension unit
  CanvasPanel([], { width: "10vw" });
  // @ts-expect-error click payload has no actor union
  pointer.events.on(PointerClick, (e) => e.otherActor);
});
const valid: CanvasStyle = {
  width: "100%",
  height: 50,
  grow: 1,
  shrink: 0,
  align: "center",
  justify: "space-around",
};
CanvasPanel([], valid);
// @ts-expect-error UI callback signal is AbortSignal
CanvasButton("bad", (x: number) => {
  console.log(x);
});
game.actions(A, { Move: KeyboardBindings.Arrows });
// @ts-expect-error Axis3D binding cannot stand in for Axis2D values
const wrong: import("@simpludify/web").ActionReader<"axis2d"> = game
  .actions(A)
  .reader(A.Aim);
console.log(wrong);
