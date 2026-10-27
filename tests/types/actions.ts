import {
  Action,
  ActionController,
  ActionMovement,
  defineActions,
  type InputSystem,
  KeyCode,
  type Scene,
} from "@simpludify/core";
export function actionTypeContracts(scene: Scene, input: InputSystem): void {
  const actions = defineActions({
    Move: Action.axis2D(),
    Fire: Action.button(),
    Yaw: Action.axis1D(),
    Aim: Action.axis3D(),
  });
  const c = new ActionController(actions, {
    scene,
    input,
    bindings: { Fire: { keys: [KeyCode.Space] } },
  });
  const source = c.createSource();
  const button: boolean = c.value(actions.Fire),
    axis: number = c.value(actions.Yaw),
    vector: { readonly x: number; readonly y: number } = c.value(actions.Move),
    vector3: { readonly z: number } = c.value(actions.Aim);
  const snapshotBoolean: boolean = c.snapshot().Fire.value;
  void [button, axis, vector, vector3, snapshotBoolean];
  source.set(actions.Fire, true);
  source.set(actions.Move, { x: 1, y: 0 });
  source.set(actions.Aim, { x: 0, y: 0, z: 1 });
  // @ts-expect-error implicit raw gameplay writes have been removed
  input.set(KeyCode.Space, true);
  // @ts-expect-error Components no longer have a raw frame-reader path
  input.capture();
  // @ts-expect-error nonexistent physical key constant
  void KeyCode.Spcae;
  // @ts-expect-error invalid static binding code
  c.rebind(actions.Fire, { keys: ["Spcae"] });
  // @ts-expect-error physical device injection also rejects unknown codes
  input.createKeyboardSource().set("Invalid", true);
  new ActionMovement(c.reader(actions.Move));
  // @ts-expect-error movement requires an Axis2D reader
  new ActionMovement(c.reader(actions.Aim));
  // @ts-expect-error movement requires an Axis2D reader
  new ActionMovement(c.reader(actions.Fire));
  // @ts-expect-error nonexistent action
  c.value(actions.Jump);
  // @ts-expect-error action tokens cannot be replaced by arbitrary strings
  c.value("Fire");
  // @ts-expect-error wrong button value
  source.set(actions.Fire, 1);
  // @ts-expect-error wrong axis value
  source.set(actions.Yaw, true);
  // @ts-expect-error wrong vector dimension
  source.set(actions.Move, { x: 0, y: 0, z: 1 });
  const threeAxes = c.value(actions.Aim);
  // @ts-expect-error a typed three-axis variable is not a two-axis source value
  source.set(actions.Move, threeAxes);
  // @ts-expect-error missing third axis
  source.set(actions.Aim, { x: 0, y: 0 });
  // @ts-expect-error button edges do not apply to vectors
  c.pressed(actions.Move);
  // @ts-expect-error axis binding does not accept button syntax
  c.rebind(actions.Yaw, { keys: [KeyCode.E] });
  // @ts-expect-error returned button value is boolean
  const invalid: number = c.value(actions.Fire);
  void invalid;
}
