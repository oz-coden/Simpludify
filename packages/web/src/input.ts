import type { InputState } from "@simpludify/core";
/** Keyboard belongs to the focused game surface; native controls keep their keys. */
export class BrowserInput {
  private readonly controller = new AbortController();
  constructor(
    host: HTMLElement,
    input: InputState,
    accepts: (code: string) => boolean,
  ) {
    const source = input.createSource();
    const editable = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest(
        'input, textarea, select, button, [contenteditable="true"]',
      );
    const down = (event: KeyboardEvent) => {
      if (editable(event.target)) return;
      if (!accepts(event.code)) return;
      event.preventDefault();
      source.set(event.code, true);
    };
    const up = (event: KeyboardEvent) => source.set(event.code, false);
    const options = { signal: this.controller.signal };
    host.addEventListener("keydown", down, options);
    window.addEventListener("keyup", up, options);
    window.addEventListener("blur", () => source.clear(), options);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) source.clear();
      },
      options,
    );
    host.addEventListener(
      "focusout",
      (event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !host.contains(event.relatedTarget) ||
          editable(event.relatedTarget)
        )
          source.clear();
      },
      options,
    );
    host.addEventListener(
      "pointerdown",
      (event) => {
        if (!editable(event.target)) host.focus({ preventScroll: true });
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
