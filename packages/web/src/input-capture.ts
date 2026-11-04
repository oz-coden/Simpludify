import {
  EngineError,
  InputCapture,
  type InputCaptureOptions,
  InputCaptureState,
  InputDevice,
  type InputSystem,
  isKeyCode,
  isMouseButton,
  type KeyCode,
  type MouseButton,
  type Scene,
  SceneState,
} from "@simpludify/core";
import type { GamepadState } from "./gamepads";
import { blocksGameKeyboard } from "./ui-keyboard";

interface PadButtons {
  index: number;
  id: string;
  mapping: string;
  signature: string;
  buttons: ReadonlySet<number>;
}
const mouseMasks = [
  [0, 1],
  [1, 4],
  [2, 2],
  [3, 8],
  [4, 16],
] as const;

/** @internal One Game-owned observer; existing adapters retain gameplay ownership. */
export class InputCaptureManager {
  private readonly abort = new AbortController();
  private current: InputCapture | undefined;
  private readonly keys = new Set<KeyCode>();
  private readonly blockedKeys = new Set<KeyCode>();
  private readonly blockedPointers = new Set<number>();
  private readonly blockedAuxiliary = new Set<MouseButton>();
  private mouseButtons = 0;
  private needsPadSample = false;
  private pads = new Map<number, PadButtons>();
  private readonly readyPads = new Set<number>();
  private dead = false;
  constructor(
    private readonly host: HTMLElement,
    private readonly input: InputSystem,
    private readonly scene: () => Scene,
    private readonly releasePointers: () => void,
    private readonly report: (error: unknown) => void,
  ) {
    const options = { capture: true, signal: this.abort.signal };
    window.addEventListener(
      "keydown",
      (event) => this.guard(() => this.keyDown(event)),
      options,
    );
    window.addEventListener(
      "keyup",
      (event) =>
        this.guard(() => {
          if (isKeyCode(event.code)) {
            this.keys.delete(event.code);
            this.blockedKeys.delete(event.code);
          }
          this.arm();
        }),
      options,
    );
    for (const kind of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
    ] as const)
      window.addEventListener(
        kind,
        (event) => this.guard(() => this.pointer(event)),
        options,
      );
    for (const kind of ["auxclick", "contextmenu"] as const)
      window.addEventListener(
        kind,
        (event) => {
          if (
            this.surface(event.target) &&
            isMouseButton(event.button) &&
            this.blockedAuxiliary.has(event.button)
          ) {
            this.consume(event);
            if (kind === "auxclick") this.blockedAuxiliary.delete(event.button);
          }
        },
        options,
      );
    window.addEventListener(
      "blur",
      (event) => {
        if (event.target === window) this.interrupt();
      },
      options,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.interrupt();
      },
      options,
    );
    host.addEventListener(
      "focusout",
      (event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !host.contains(event.relatedTarget) ||
          blocksGameKeyboard(event.relatedTarget)
        )
          this.interrupt();
      },
      options,
    );
    host.addEventListener(
      "focusin",
      (event) => {
        if (blocksGameKeyboard(event.target)) this.interrupt();
      },
      options,
    );
  }
  start(options: InputCaptureOptions = {}): InputCapture {
    if (this.dead)
      throw new EngineError("GAME_DISPOSED", "Capture host has been disposed");
    if (this.current)
      throw new EngineError(
        "INPUT_CAPTURE_ACTIVE",
        "Cancel the active capture before starting another",
      );
    const scene = this.scene();
    if (
      scene.state !== SceneState.Active ||
      document.hidden ||
      !document.hasFocus()
    )
      throw new EngineError(
        "INPUT_CAPTURE_UNAVAILABLE",
        "Capture requires an active Scene and focused visible document",
      );
    const capture = new InputCapture(options);
    let release: (() => void) | undefined;
    try {
      capture.onDispose(scene.onDispose(() => capture.cancel()));
      capture.onDispose(() => {
        if (this.current === capture) this.current = undefined;
        this.pads.clear();
        this.readyPads.clear();
        this.needsPadSample = false;
        release?.();
      });
      this.current = capture;
      this.needsPadSample = capture.devices.includes(InputDevice.Gamepad);
      for (const key of this.keys) this.blockedKeys.add(key);
      for (const [button, mask] of mouseMasks)
        if (this.mouseButtons & mask) this.blockedAuxiliary.add(button);
      this.releasePointers();
      if (capture.disposed) return capture;
      release = this.input.suspendLiveInput(() => capture.cancel());
      if (capture.disposed) {
        release();
        return capture;
      }
      this.host.focus({ preventScroll: true });
      this.arm();
      return capture;
    } catch (error) {
      capture.cancel();
      throw error;
    }
  }
  private arm(): void {
    const capture = this.current;
    if (
      !capture ||
      capture.state !== InputCaptureState.Arming ||
      this.needsPadSample
    )
      return;
    if (capture.devices.includes(InputDevice.Keyboard) && this.keys.size)
      return;
    if (capture.devices.includes(InputDevice.Mouse) && this.mouseButtons)
      return;
    if (
      capture.devices.includes(InputDevice.Gamepad) &&
      [...this.pads.values()].some(
        (pad) =>
          (capture.gamepadIndex === undefined ||
            capture.gamepadIndex === pad.index) &&
          pad.buttons.size,
      )
    )
      return;
    capture.arm();
  }
  private keyDown(event: KeyboardEvent): void {
    if (!(event.target instanceof Node) || !this.host.contains(event.target))
      return;
    if (
      event.isComposing ||
      event.keyCode === 229 ||
      blocksGameKeyboard(event.target)
    )
      return;
    // Native settings buttons can still invoke an explicit cancel API.
    if (event.target instanceof HTMLElement && event.target.closest("button"))
      return;
    if (!isKeyCode(event.code)) return;
    const previous = this.keys.has(event.code);
    this.keys.add(event.code);
    const capture = this.current;
    if (!capture && !this.blockedKeys.has(event.code)) return;
    this.blockedKeys.add(event.code);
    this.consume(event);
    if (capture && !previous && !event.repeat)
      capture.accept({ device: InputDevice.Keyboard, code: event.code });
  }
  private surface(target: EventTarget | null): boolean {
    return (
      target === this.host ||
      (target instanceof HTMLCanvasElement &&
        target.parentElement === this.host)
    );
  }
  private pointer(event: PointerEvent): void {
    const capture = this.current,
      mouse = event.pointerType === "mouse",
      old = this.mouseButtons;
    if (mouse)
      this.mouseButtons = event.type === "pointercancel" ? 0 : event.buttons;
    if (event.type === "pointerdown" && !capture) {
      this.blockedPointers.delete(event.pointerId);
      if (isMouseButton(event.button))
        this.blockedAuxiliary.delete(event.button);
    }
    const blocked = this.blockedPointers.has(event.pointerId);
    if (capture && this.surface(event.target)) {
      if (event.type === "pointerdown")
        this.host.focus({ preventScroll: true });
      this.blockedPointers.add(event.pointerId);
      this.consume(event);
      if (mouse && isMouseButton(event.button)) {
        const mask =
          mouseMasks.find(([button]) => button === event.button)?.[1] ?? 0;
        if (event.buttons & mask && !(old & mask)) {
          this.blockedAuxiliary.add(event.button);
          capture.accept({ device: InputDevice.Mouse, button: event.button });
        }
      }
    } else if (blocked) this.consume(event);
    if (
      event.type === "pointerup" ||
      event.type === "pointercancel" ||
      (mouse && event.buttons === 0)
    )
      this.blockedPointers.delete(event.pointerId);
    this.arm();
  }
  /** Same validated gamepad poll as gameplay; no navigator polling in this manager. */
  sample(pads: ReadonlyMap<number, GamepadState>): void {
    const capture = this.current;
    if (!capture?.devices.includes(InputDevice.Gamepad)) return;
    const before = this.pads,
      first = this.needsPadSample,
      next = new Map<number, PadButtons>();
    for (const pad of pads.values()) {
      const buttons = new Set<number>();
      pad.buttons.forEach((button, index) => {
        if (Number.isFinite(button?.value) && button.value >= 0.5)
          buttons.add(index);
      });
      const signature = JSON.stringify([
        pad.id,
        pad.mapping,
        pad.buttons.length,
      ]);
      const entry = {
        index: pad.index,
        id: pad.id,
        mapping: pad.mapping,
        signature,
        buttons,
      };
      next.set(pad.index, entry);
      if (first || before.get(pad.index)?.signature !== signature)
        this.readyPads.delete(pad.index);
      if (!buttons.size) this.readyPads.add(pad.index);
    }
    for (const index of this.readyPads)
      if (!next.has(index)) this.readyPads.delete(index);
    this.pads = next;
    this.needsPadSample = false;
    this.arm();
    if (first || capture.state !== InputCaptureState.Listening) return;
    for (const pad of [...next.values()].sort((a, b) => a.index - b.index)) {
      if (
        !this.readyPads.has(pad.index) ||
        before.get(pad.index)?.signature !== pad.signature
      )
        continue;
      for (const button of pad.buttons)
        if (
          !before.get(pad.index)?.buttons.has(button) &&
          capture.accept({
            device: InputDevice.Gamepad,
            index: pad.index,
            id: pad.id,
            mapping: pad.mapping,
            button,
          })
        )
          return;
    }
  }
  private consume(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  private guard(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.report(error);
    }
  }
  private interrupt(): void {
    this.guard(() => this.current?.cancel());
    this.keys.clear();
    this.blockedKeys.clear();
    this.blockedPointers.clear();
    this.blockedAuxiliary.clear();
    this.mouseButtons = 0;
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    this.abort.abort();
    this.interrupt();
  }
}
