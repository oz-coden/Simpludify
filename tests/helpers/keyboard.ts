import type { Engine, KeyboardSource } from "@simpludify/core";

const sources = new WeakMap<Engine, KeyboardSource>();
/** Device integration fixture. Gameplay automation should use ActionSource instead. */
export function keyboard(engine: Engine): KeyboardSource {
  let source = sources.get(engine);
  if (!source) {
    source = engine.input.createKeyboardSource();
    sources.set(engine, source);
  }
  return source;
}
