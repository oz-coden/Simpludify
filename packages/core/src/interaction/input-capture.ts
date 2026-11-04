import { EngineError } from "../foundation/diagnostics";
import { Lifetime, type LifetimeOwner } from "../foundation/lifetime";
import type { ActionBinding } from "./action-bindings";
import { gamepadIndex } from "./gamepad-bindings";
import { parseKeyCode } from "./key-code";
import {
  InputDevice,
  type PhysicalInput,
  parseMouseButton,
} from "./physical-input";

export const InputCaptureState = Object.freeze({
  Arming: "arming",
  Listening: "listening",
  Completed: "completed",
  Cancelled: "cancelled",
} as const);
export type InputCaptureState =
  (typeof InputCaptureState)[keyof typeof InputCaptureState];
export interface InputCaptureOptions {
  readonly devices?: readonly InputDevice[];
  readonly gamepadIndex?: number;
  readonly owner?: LifetimeOwner;
}
export type CapturedInput = PhysicalInput & {
  readonly binding: ActionBinding<"button">;
};

/** A portable single-input session. Hosts supply neutral arming and physical events. */
export class InputCapture implements LifetimeOwner {
  private readonly life = new Lifetime();
  private status: InputCaptureState = InputCaptureState.Arming;
  readonly devices: readonly InputDevice[];
  readonly gamepadIndex: number | undefined;
  readonly result: Promise<CapturedInput | undefined>;
  private settle: (input: CapturedInput | undefined) => void = () => {};
  constructor(options: InputCaptureOptions = {}) {
    if (
      !options ||
      typeof options !== "object" ||
      Array.isArray(options) ||
      Object.keys(options).some(
        (key) => !["devices", "gamepadIndex", "owner"].includes(key),
      )
    )
      throw new EngineError(
        "INVALID_INPUT_CAPTURE",
        "Invalid input capture options",
      );
    const devices = options.devices ?? Object.values(InputDevice);
    if (
      !Array.isArray(devices) ||
      !devices.length ||
      devices.some((device) => !Object.values(InputDevice).includes(device))
    )
      throw new EngineError(
        "INVALID_INPUT_CAPTURE",
        "Select at least one known capture device",
      );
    this.devices = Object.freeze([...new Set(devices)]);
    this.gamepadIndex =
      options.gamepadIndex === undefined
        ? undefined
        : gamepadIndex(options.gamepadIndex);
    if (options.owner?.disposed)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Capture owner has been disposed",
      );
    this.result = new Promise((resolve) => {
      this.settle = resolve;
    });
    if (options.owner)
      this.life.onDispose(options.owner.onDispose(() => this.cancel()));
  }
  get state(): InputCaptureState {
    return this.status;
  }
  get disposed(): boolean {
    return this.life.disposed;
  }
  onDispose(callback: () => void): () => void {
    return this.life.onDispose(callback);
  }
  /** @internal Hosts call only after all eligible preheld buttons/keys are neutral. */
  arm(): void {
    if (this.status === InputCaptureState.Arming)
      this.status = InputCaptureState.Listening;
  }
  /** @internal Offer one fresh physical down, never a repeat or opening gesture. */
  accept(input: PhysicalInput): boolean {
    if (this.status !== InputCaptureState.Listening) return false;
    if (
      !input ||
      typeof input !== "object" ||
      !Object.values(InputDevice).includes(input.device)
    )
      throw new EngineError(
        "INVALID_INPUT_CAPTURE",
        "Unknown physical input device",
      );
    if (!this.devices.includes(input.device)) return false;
    let descriptor: PhysicalInput, binding: ActionBinding<"button">;
    if (input.device === InputDevice.Keyboard) {
      const code = parseKeyCode(input.code);
      descriptor = { device: InputDevice.Keyboard, code };
      binding = Object.freeze({ keys: Object.freeze([code]) });
    } else if (input.device === InputDevice.Mouse) {
      const button = parseMouseButton(input.button);
      descriptor = { device: InputDevice.Mouse, button };
      binding = Object.freeze({ mouse: Object.freeze([button]) });
    } else {
      const index = gamepadIndex(input.index),
        button = gamepadIndex(input.button);
      if (this.gamepadIndex !== undefined && this.gamepadIndex !== index)
        return false;
      if (typeof input.id !== "string" || typeof input.mapping !== "string")
        throw new EngineError(
          "INVALID_INPUT_CAPTURE",
          "Gamepad capture requires device facts",
        );
      descriptor = {
        device: InputDevice.Gamepad,
        index,
        button,
        id: input.id,
        mapping: input.mapping,
      };
      binding = Object.freeze({
        gamepad: Object.freeze({ buttons: Object.freeze([button]) }),
      });
    }
    this.finish(
      InputCaptureState.Completed,
      Object.freeze({ ...descriptor, binding }),
    );
    return true;
  }
  private finish(
    state: InputCaptureState,
    input: CapturedInput | undefined,
  ): void {
    if (this.disposed) return;
    this.status = state;
    try {
      this.life.dispose();
    } finally {
      this.settle(input);
    }
  }
  cancel(): void {
    this.finish(InputCaptureState.Cancelled, undefined);
  }
  dispose(): void {
    this.cancel();
  }
}
