import {
  type Diagnostic,
  EngineError,
  Lifetime,
  Logger,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";

describe("Logger", () => {
  it("deduplicates only consecutive complete matches in the standard output", () => {
    const output: Diagnostic[] = [];
    const diagnostics: Diagnostic[] = [];
    const logger = new Logger({ sink: (entry) => output.push(entry) });
    logger.subscribe((entry) => diagnostics.push(entry));

    logger.warn("A", { details: { id: 1, category: "image" } });
    logger.warn("A", { details: { category: "image", id: 1 } });
    logger.warn("A", { details: { id: 2, category: "image" } });
    logger.warn("A", { details: { id: 2, category: "image" } });
    logger.warn("B");
    logger.warn("B");
    logger.warn("A", { details: { id: 1, category: "image" } });

    expect(
      output.map(({ message, details }) => [message, details?.id]),
    ).toEqual([
      ["A", 1],
      ["A", 2],
      ["B", undefined],
      ["A", 1],
    ]);
    expect(diagnostics).toHaveLength(7);
  });

  it("preserves causes, origins, details and fatality while sending only safe fault summaries", () => {
    const output: Diagnostic[] = [];
    const logger = new Logger({ sink: (entry) => output.push(entry) });
    const root = new Error("failed at /private/runtime/path");
    const cause = new EngineError(
      "ASSET_LOAD_FAILED",
      "Could not decode",
      {
        asset: "hero",
      },
      { cause: root, source: "engine.assets", fatal: false },
    );
    logger.report(cause);
    logger.report(cause);
    logger.report(cause, { fatal: true });
    logger.report(
      new EngineError(
        "ASSET_LOAD_FAILED",
        "Could not decode",
        {
          asset: "hero",
        },
        {
          cause: new Error("different failure"),
          source: "engine.assets",
          fatal: true,
        },
      ),
    );

    expect(output).toHaveLength(3);
    expect(output[0]).toMatchObject({
      level: "error",
      message: "Unexpected runtime error",
      code: "ASSET_LOAD_FAILED",
      source: "engine.assets",
      fatal: false,
      details: { asset: "hero" },
      cause,
    });
    expect(cause.cause).toBe(root);
    expect(output[1]?.fatal).toBe(true);
  });

  it("isolates filtered, muted, owned and throwing observers", async () => {
    const shown: string[] = [];
    const received: string[] = [];
    const logger = new Logger({
      minimumLevel: "warn",
      deduplicate: false,
      sink: (entry) => {
        shown.push(entry.message);
        throw new Error("broken sink");
      },
    });
    logger.subscribe(() => {
      logger.error("recursive");
      throw new Error("broken subscriber");
    });
    logger.subscribe(async () => {
      throw new Error("async subscriber");
    });
    const owner = new Lifetime();
    logger.subscribe((entry) => received.push(entry.message), owner);
    logger.debug("hidden");
    logger.warn("shown");
    logger.warn("shown");
    owner.dispose();
    logger.error("last");
    expect(shown).toEqual(["shown", "shown", "last"]);
    expect(received).toEqual(["hidden", "shown", "shown"]);
    expect(() => logger.subscribe(() => {}, owner)).toThrowError(
      expect.objectContaining({ code: "OWNER_DISPOSED" }),
    );

    const muted = new Logger();
    muted.subscribe((entry) => received.push(entry.message));
    muted.error("muted");
    expect(received.at(-1)).toBe("muted");
    await Promise.resolve();
  });

  it("distinguishes errors whose name or message is inherited from a prototype getter", () => {
    class HostException extends Error {
      constructor(text: string, kind: string) {
        super();
        Reflect.deleteProperty(this, "message");
        Object.defineProperties(Object.getPrototypeOf(this), {
          name: {
            configurable: true,
            get: () => kind,
          },
          message: {
            configurable: true,
            get: () => text,
          },
        });
      }
    }
    const output: Diagnostic[] = [];
    const logger = new Logger({ sink: (entry) => output.push(entry) });
    logger.report(new HostException("first host failure", "NotFoundError"));
    logger.report(new HostException("second host failure", "SyntaxError"));
    expect(output).toHaveLength(2);
  });
});
