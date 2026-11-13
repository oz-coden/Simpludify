import type { InputSystem, MouseSource, PointerInfo } from "@simpludify/core";
import {
  containsScreenPoint,
  isMouseButton,
  MouseButton,
  PointerRouting,
  screenPoint,
  type ViewTransform,
  type WorldPoint,
} from "@simpludify/core";
import { blocksGameKeyboard, focusGameSurface } from "./ui-keyboard";

interface PointerProjection {
  screen: PointerInfo["screen"];
  world: WorldPoint;
  view: ViewTransform;
}

const mouseMasks = [
  [MouseButton.Left, 1],
  [MouseButton.Middle, 4],
  [MouseButton.Right, 2],
  [MouseButton.Back, 8],
  [MouseButton.Forward, 16],
] as const;
/** One DOM capture-phase adapter per Game; Pixi federated events never route these widgets. */
export class BrowserPointer {
  readonly routing: PointerRouting;
  private readonly abort = new AbortController();
  private readonly mouse: MouseSource | undefined;
  private readonly mouseStates = new Map<number, number>();
  private readonly blockedMouse = new Set<number>();
  private readonly auxiliary = new Set<MouseButton>();
  private mouseAnchor: PointerInfo["screen"] | undefined;
  private readonly offInput: (() => void) | undefined;
  constructor(
    private readonly host: HTMLElement,
    private readonly project: (event: {
      clientX: number;
      clientY: number;
    }) => PointerProjection | undefined,
    private readonly report: (error: unknown) => void,
    private readonly flush: () => void,
    private readonly input?: InputSystem,
    private readonly onActivity?: (device: "mouse" | "touch") => void,
  ) {
    this.routing = new PointerRouting((id) => {
      if (host.hasPointerCapture(id)) host.releasePointerCapture(id);
    });
    this.mouse = input?.createMouseSource();
    this.offInput = input?.addAdapter({
      sample: () => {},
      reset: () => this.resetMouse(),
      dispose: () => this.dispose(),
    });
    const options = { signal: this.abort.signal, capture: true };
    host.addEventListener(
      "pointerdown",
      (e) =>
        this.guard(() => {
          if (!this.surface(e.target)) return;
          if (e.pointerType === "mouse") {
            this.releaseMouse(e.pointerId);
            this.blockedMouse.delete(e.pointerId);
            if (isMouseButton(e.button)) this.auxiliary.delete(e.button);
          }
          this.flush();
          const data = this.data(e);
          if (!data) return this.release();
          // Capture before delivery: callbacks may remove the target or navigate.
          try {
            host.setPointerCapture(e.pointerId);
          } catch {
            /* Window capture listeners also cover synthetic events. */
          }
          const target = this.routing.down(data);
          this.updateMouse(e);
          if (this.routing.has(e.pointerId)) {
            if (
              input?.liveInput &&
              (e.pointerType === "mouse" || e.pointerType === "touch")
            ) {
              this.mouseAnchor =
                e.pointerType === "mouse" ? data.screen : undefined;
              this.onActivity?.(e.pointerType);
            }
            e.preventDefault();
            // UI gestures retain compatible focus; an explicit world click selects the game.
            if (target) focusGameSurface(host);
            else host.focus({ preventScroll: true });
          } else {
            if (this.routing.owns(e.pointerId)) e.preventDefault();
            if (host.hasPointerCapture(e.pointerId))
              host.releasePointerCapture(e.pointerId);
          }
        }),
      options,
    );
    host.addEventListener(
      "wheel",
      (e) =>
        this.guard(() => {
          if (!this.surface(e.target)) return;
          this.flush();
          const projected = this.project(e);
          if (!projected) return;
          const { screen } = projected;
          const unit =
            e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? host.clientHeight : 1;
          if (
            this.routing.scroll(
              screen.x,
              screen.y,
              e.deltaX * unit,
              e.deltaY * unit,
            )
          ) {
            if (input?.liveInput && (e.deltaX || e.deltaY))
              this.onActivity?.("mouse");
            e.preventDefault();
          }
        }),
      { ...options, passive: false },
    );
    window.addEventListener(
      "pointermove",
      (e) =>
        this.guard(() => {
          if (!this.routing.owns(e.pointerId) && !this.surface(e.target)) {
            if (e.pointerType === "mouse") {
              this.mouseAnchor = undefined;
              this.releaseMouse(e.pointerId);
            }
            if (this.routing.hasHover(e.pointerId)) {
              const data = this.data(e);
              if (data) this.routing.leave(data);
              else this.release();
            }
            return;
          }
          this.flush();
          const data = this.data(e);
          if (!data) return this.release();
          this.updateMouse(e);
          this.routing.move(data);
          if (
            e.pointerType === "mouse" &&
            data.inside &&
            input?.liveInput &&
            !document.hidden &&
            document.hasFocus() &&
            host.contains(document.activeElement) &&
            !blocksGameKeyboard(document.activeElement)
          ) {
            this.mouseAnchor ??= data.screen;
            const anchor = this.mouseAnchor;
            if (
              Math.hypot(data.screen.x - anchor.x, data.screen.y - anchor.y) >=
              8
            ) {
              this.mouseAnchor = data.screen;
              this.onActivity?.("mouse");
            }
          } else if (e.pointerType === "mouse") this.mouseAnchor = undefined;
        }),
      options,
    );
    window.addEventListener(
      "pointerup",
      (e) =>
        this.guard(() => {
          if (e.pointerType === "mouse") this.releaseMouse(e.pointerId);
          if (this.routing.owns(e.pointerId)) {
            e.preventDefault();
            this.flush();
            const data = this.data(e);
            if (data) this.routing.up(data);
            else this.release();
          }
        }),
      options,
    );
    window.addEventListener(
      "pointercancel",
      (e) =>
        this.guard(() => {
          this.releaseMouse(e.pointerId);
          this.blockedMouse.delete(e.pointerId);
          this.routing.cancel(e.pointerId, false);
        }),
      options,
    );
    host.addEventListener(
      "lostpointercapture",
      (e) =>
        this.guard(() => {
          this.releaseMouse(e.pointerId);
          if (e.pointerType === "mouse" && e.buttons !== 0)
            this.blockedMouse.add(e.pointerId);
          else this.blockedMouse.delete(e.pointerId);
          this.routing.cancel(e.pointerId);
        }),
      options,
    );
    host.addEventListener(
      "pointerleave",
      (e) =>
        this.guard(() => {
          const data = this.data(e);
          if (data) this.routing.leave(data);
          else this.release();
        }),
      options,
    );
    window.addEventListener(
      "blur",
      (event) => {
        if (event.target === window) this.release();
      },
      options,
    );
    host.addEventListener(
      "focusout",
      (event) =>
        this.guard(() => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !host.contains(event.relatedTarget) ||
            blocksGameKeyboard(event.relatedTarget)
          ) {
            this.resetMouse();
            this.routing.releaseVirtual();
          }
        }),
      options,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.release();
      },
      options,
    );
    for (const kind of ["auxclick", "contextmenu"] as const)
      host.addEventListener(
        kind,
        (event) => {
          if (
            this.surface(event.target) &&
            isMouseButton(event.button) &&
            this.auxiliary.has(event.button) &&
            input?.acceptsMouse(event.button)
          ) {
            event.preventDefault();
            if (kind === "auxclick") this.auxiliary.delete(event.button);
          }
        },
        options,
      );
  }
  private applyMouse(): void {
    let buttons = 0;
    for (const state of this.mouseStates.values()) buttons |= state;
    for (const [button, mask] of mouseMasks)
      this.mouse?.set(button, (buttons & mask) !== 0);
  }
  private releaseMouse(id: number): void {
    if (this.mouseStates.delete(id)) this.applyMouse();
  }
  private updateMouse(event: PointerEvent): void {
    if (event.pointerType !== "mouse" || !this.mouse) return;
    if (event.buttons === 0) this.blockedMouse.delete(event.pointerId);
    const world =
      this.routing.worldOwns(event.pointerId) &&
      !this.blockedMouse.has(event.pointerId) &&
      this.input?.liveInput;
    if (world) this.mouseStates.set(event.pointerId, event.buttons);
    else this.mouseStates.delete(event.pointerId);
    if (isMouseButton(event.button)) {
      if (world && this.input?.acceptsMouse(event.button))
        this.auxiliary.add(event.button);
      else this.auxiliary.delete(event.button);
    }
    this.applyMouse();
  }
  private resetMouse(): void {
    this.mouseAnchor = undefined;
    for (const id of this.mouseStates.keys()) this.blockedMouse.add(id);
    this.mouseStates.clear();
    this.auxiliary.clear();
    this.mouse?.clear();
  }
  private surface(target: EventTarget | null): boolean {
    return (
      target === this.host ||
      (target instanceof HTMLCanvasElement &&
        target.parentElement === this.host)
    );
  }
  private data(e: PointerEvent): PointerInfo | undefined {
    const projected = this.project(e);
    if (!projected) return undefined;
    const { screen, world, view } = projected;
    return Object.freeze({
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      button: e.button,
      buttons: e.buttons,
      time: e.timeStamp / 1000,
      screen: Object.freeze(screenPoint(screen.x, screen.y)),
      world: Object.freeze(world),
      inside: containsScreenPoint(view, screen),
    });
  }
  private guard(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.report(error);
    }
  }
  release(): void {
    this.resetMouse();
    this.guard(() => this.routing.release());
  }
  dispose(): void {
    this.abort.abort();
    this.offInput?.();
    this.resetMouse();
    this.mouse?.dispose();
    this.blockedMouse.clear();
    this.guard(() => this.routing.dispose());
  }
}
