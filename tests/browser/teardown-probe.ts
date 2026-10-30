import type { Game } from "@simpludify/web";

/** Temporary synchronous teardown tracing; wrappers preserve return values and exceptions. */
export function traceGameDisposal(game: Game): void {
  const wrap = (object: object, key: string, label: string) => {
    const record = object as Record<string, unknown>;
    const original = record[key];
    if (typeof original !== "function") return;
    record[key] = function (this: unknown, ...args: unknown[]) {
      const started = performance.now();
      console.log("TEARDOWN_BEGIN", label);
      try {
        return Reflect.apply(original, this, args);
      } finally {
        console.log("TEARDOWN_END", label, performance.now() - started);
      }
    };
  };
  const host = game as unknown as {
    renderer: {
      app: {
        renderer: {
          runners: { destroy: { items: object[] } };
          context?: {
            gl: WebGLRenderingContext;
            extensions: { loseContext?: object };
          };
        };
      };
    };
    engine: object;
  };
  const renderer = host.renderer.app.renderer;
  for (const [i, system] of renderer.runners.destroy.items.entries())
    wrap(system, "destroy", `${i}:${system.constructor.name}.destroy`);
  const context = renderer.context;
  if (context) {
    console.log(
      "TEARDOWN_GL_VERSION",
      context.gl.getParameter(context.gl.VERSION),
    );
    for (const key of [
      "useProgram",
      "deleteProgram",
      "deleteShader",
      "finish",
      "flush",
    ])
      wrap(context.gl, key, `gl.${key}`);
    if (context.extensions.loseContext)
      wrap(context.extensions.loseContext, "loseContext", "gl.loseContext");
  }
  wrap(host.renderer, "dispose", "PixiRenderer.dispose");
  wrap(host.engine, "dispose", "Engine.dispose");
  wrap(game, "dispose", "Game.dispose");
}
