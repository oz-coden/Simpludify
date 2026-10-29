import { expect, it } from "vitest";
// @ts-expect-error The CLI validator is a JavaScript tooling module.
import { validateCoreDependency } from "../../scripts/core-boundary.mjs";

it("rejects external and escaping relative imports even when type-only", () => {
  for (const specifier of [
    "pixi.js",
    "node:fs",
    "../../../web/src/game",
    "../../../../outside",
  ]) {
    expect(() =>
      validateCoreDependency(
        "/repo/core",
        "/repo/core/ui/model.ts",
        specifier,
        true,
      ),
    ).toThrow("CORE_BOUNDARY");
  }
});
it("enforces data/UI dependency directions while permitting Scene's type-only input ownership", () => {
  expect(() =>
    validateCoreDependency(
      "/repo/core",
      "/repo/core/scene/scene.ts",
      "../interaction/input",
      true,
    ),
  ).not.toThrow();
  expect(() =>
    validateCoreDependency(
      "/repo/core",
      "/repo/core/scene/scene.ts",
      "../interaction/input",
    ),
  ).toThrow();
  expect(() =>
    validateCoreDependency(
      "/repo/core",
      "/repo/core/graphics/components.ts",
      "../game/motion",
    ),
  ).toThrow();
  expect(() =>
    validateCoreDependency(
      "/repo/core",
      "/repo/core/ui/model.ts",
      "../runtime/engine",
    ),
  ).toThrow();
  expect(() =>
    validateCoreDependency(
      "/repo/core",
      "/repo/core/ui/model.ts",
      "../foundation/lifetime",
    ),
  ).not.toThrow();
});
