import { type InputSystem, isKeyCode } from "@simpludify/core";
import {
  blocksGameKeyboard,
  focusGameSurface,
  uiConsumesKey,
} from "./ui-keyboard";
/** Scoped keyboard adapter: editors own text; engine buttons consume only their UI keys. */
export class BrowserInput {
  private readonly controller = new AbortController();
  constructor(host: HTMLElement, input: InputSystem) {
    const source = input.createKeyboardSource();
    let compositionOwner: EventTarget | null = null;
    const down = (event: KeyboardEvent) => {
      // A removed/replaced editor must not leave a stale global composition lock.
      if (
        compositionOwner &&
        (!(compositionOwner instanceof Node) ||
          !compositionOwner.isConnected ||
          !host.contains(compositionOwner) ||
          document.activeElement !== compositionOwner)
      )
        compositionOwner = null;
      if (
        compositionOwner ||
        event.isComposing ||
        event.keyCode === 229 ||
        blocksGameKeyboard(event.target)
      ) {
        source.clear();
        return;
      }
      if (uiConsumesKey(event) || event.code === "Tab") {
        if (isKeyCode(event.code)) source.set(event.code, false);
        return;
      }
      if (!isKeyCode(event.code) || !input.acceptsKey(event.code)) return;
      event.preventDefault();
      // Released/cleared holds require a fresh keydown; autorepeat never restores them.
      if (!event.repeat) source.set(event.code, true);
    };
    const up = (event: KeyboardEvent) => {
      if (isKeyCode(event.code)) source.set(event.code, false);
    };
    const options = { signal: this.controller.signal };
    host.addEventListener("keydown", down, options);
    window.addEventListener("keyup", up, { ...options, capture: true });
    host.addEventListener(
      "compositionstart",
      (event) => {
        compositionOwner = event.target;
        source.clear();
      },
      options,
    );
    host.addEventListener(
      "compositionend",
      (event) => {
        if (compositionOwner === event.target) compositionOwner = null;
      },
      options,
    );
    window.addEventListener(
      "blur",
      () => {
        compositionOwner = null;
        source.clear();
      },
      options,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          compositionOwner = null;
          source.clear();
        }
      },
      options,
    );
    host.addEventListener(
      "focusin",
      (event) => {
        if (event.target !== compositionOwner) compositionOwner = null;
        if (blocksGameKeyboard(event.target)) source.clear();
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
        ) {
          compositionOwner = null;
          source.clear();
        }
      },
      options,
    );
    host.addEventListener(
      "pointerdown",
      (event) => {
        if (
          !event.defaultPrevented &&
          (event.target === host ||
            (event.target instanceof HTMLCanvasElement &&
              event.target.parentElement === host))
        )
          focusGameSurface(host);
      },
      options,
    );
    this.clear = () => source.dispose();
  }
  private readonly clear: () => void;
  dispose(): void {
    this.controller.abort();
    this.clear();
  }
}
