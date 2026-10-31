/** Host-only ownership metadata; native editing is never reconstructed from game keys. */
const gameButtons = new WeakSet<HTMLButtonElement>();
const consumed = new WeakSet<KeyboardEvent>();
export function registerGameButton(
  button: HTMLButtonElement,
  signal: AbortSignal,
): void {
  gameButtons.add(button);
  // Preserve native DOM activation defaults while reserving these keys for UI.
  button.addEventListener(
    "keydown",
    (event) => {
      if (event.code === "Enter" || event.code === "Space") consumed.add(event);
    },
    { signal },
  );
}
export function uiConsumesKey(event: KeyboardEvent): boolean {
  return consumed.has(event) || event.defaultPrevented;
}
/** Unmanaged native buttons retain the previous isolated keyboard behavior. */
export function blocksGameKeyboard(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest("input,textarea,select"))
    return true;
  const button = target.closest("button");
  return !!button && !gameButtons.has(button);
}
/** Grant surface focus from outside/editing; do not evict a compatible UI button. */
export function focusGameSurface(host: HTMLElement): void {
  const active = document.activeElement;
  if (
    active === host ||
    (active instanceof HTMLElement &&
      host.contains(active) &&
      !blocksGameKeyboard(active))
  )
    return;
  host.focus({ preventScroll: true });
}
