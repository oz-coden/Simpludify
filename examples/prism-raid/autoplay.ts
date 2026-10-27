import type { InputState } from "@simpludify/core";
import type { Raid } from "./logic";

// Inspection is read-only. Every action uses the same public input path as a player.
export function autopilot(round: Raid, input: Pick<InputState, "set">): void {
  const state = round.snapshot();
  const player = state.units.find((unit) => unit.kind === "player");
  if (!player) return;
  const target = state.units
    .filter(
      (unit) =>
        unit.kind === "scout" ||
        unit.kind === "drifter" ||
        unit.kind === "gunner",
    )
    .sort(
      (a, b) =>
        b.y - a.y || Math.abs(a.x - player.x) - Math.abs(b.x - player.x),
    )[0];
  let destination = 180;
  if (target) {
    const time = Math.max(
      0,
      (player.y - target.y) / (300 + (target.speed ?? 0)),
    );
    destination =
      (target.baseX ?? target.x) +
      Math.sin(
        ((target.flightAge ?? 0) + time) * (target.omega ?? 0) +
          (target.offset ?? 0),
      ) *
        (target.amplitude ?? 0);
  }
  const danger = state.units.find(
    (unit) =>
      unit.kind === "enemy-shot" &&
      unit.y < player.y + 15 &&
      unit.y > player.y - 100 &&
      Math.abs(
        unit.x +
          (unit.dx ?? 0) * ((player.y - unit.y) / Math.max(1, unit.dy ?? 1)) -
          player.x,
      ) < 24,
  );
  if (danger) destination = player.x + (player.x < danger.x ? -65 : 65);
  input.set("ArrowLeft", destination < player.x - 7);
  input.set("ArrowRight", destination > player.x + 7);
  input.set("ArrowUp", false);
  input.set("ArrowDown", false);
  input.set("Space", true);
}
