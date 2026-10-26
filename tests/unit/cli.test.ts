import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

function cli(...args: string[]) {
  const result = spawnSync(
    process.execPath,
    ["scripts/cli.mjs", ...args, "--json"],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    data: JSON.parse((result.stdout || result.stderr).trim()) as {
      ok: boolean;
      diagnostics: Array<{ code: string }>;
    },
  };
}
it("emits structured diagnostics and meaningful exit codes", () => {
  expect(cli("doctor")).toMatchObject({ status: 0, data: { ok: true } });
  expect(cli("build", "--target", "windows")).toMatchObject({
    status: 2,
    data: { ok: false, diagnostics: [{ code: "TARGET_UNSUPPORTED" }] },
  });
  expect(cli("build", "--example", "missing")).toMatchObject({
    status: 2,
    data: { diagnostics: [{ code: "EXAMPLE_NOT_FOUND" }] },
  });
  expect(cli("create", ".")).toMatchObject({
    status: 2,
    data: { diagnostics: [{ code: "DESTINATION_EXISTS" }] },
  });
  expect(cli("unknown")).toMatchObject({
    status: 2,
    data: { diagnostics: [{ code: "INVALID_ARGUMENT" }] },
  });
});
