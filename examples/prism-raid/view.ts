import {
  Actor,
  Renderable,
  type Scene,
  Shape,
  Transform,
} from "@simpludify/core";
import { arena, type Kind, type Raid, Unit } from "./logic";

const appearance: Record<
  Kind,
  {
    source: { kind: "shape"; shape: (typeof Shape)[keyof typeof Shape] };
    width: number;
    height: number;
    color: number;
    zIndex: number;
  }
> = {
  player: {
    source: { kind: "shape", shape: Shape.Triangle },
    width: 28,
    height: 36,
    color: 0x65a8ed,
    zIndex: 10,
  },
  scout: {
    source: { kind: "shape", shape: Shape.Triangle },
    width: 28,
    height: 34,
    color: 0xff887e,
    zIndex: 3,
  },
  drifter: {
    source: { kind: "shape", shape: Shape.Triangle },
    width: 36,
    height: 30,
    color: 0xffcc73,
    zIndex: 3,
  },
  gunner: {
    source: { kind: "shape", shape: Shape.Triangle },
    width: 42,
    height: 48,
    color: 0xbf9af0,
    zIndex: 4,
  },
  "player-shot": {
    source: { kind: "shape", shape: Shape.Box },
    width: 4,
    height: 16,
    color: 0x9be9ff,
    zIndex: 6,
  },
  "enemy-shot": {
    source: { kind: "shape", shape: Shape.Circle },
    width: 10,
    height: 10,
    color: 0xff698d,
    zIndex: 7,
  },
};
export function presentRaid(scene: Scene, round?: Raid): void {
  const stars: Transform[] = [];
  for (let i = 0; i < 42; i++) {
    const actor = new Actor();
    stars.push(
      actor.add(
        new Transform({
          x: (i * 97 + 13) % arena.width,
          y: (i * 131) % arena.height,
        }),
      ),
    );
    actor.add(
      new Renderable({
        width: i % 5 === 0 ? 2 : 1,
        height: i % 5 === 0 ? 7 : 3,
        color: 0x7da5bc,
        opacity: 0.15 + (i % 4) * 0.08,
        zIndex: -10,
      }),
    );
    scene.add(actor);
  }
  scene.onUpdate((delta) => {
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      if (star) star.y = (star.y + (12 + (i % 3) * 10) * delta) % arena.height;
    }
    if (!round) return;
    for (const actor of round.units) {
      const unit = actor.require(Unit.type);
      let render = actor.get(Renderable.type);
      if (!render) render = actor.add(new Renderable(appearance[unit.kind]));
      if (unit.kind === "player")
        render.opacity =
          round.invulnerable > 0 && Math.floor(round.elapsed * 16) % 2 === 0
            ? 0.35
            : 1;
      else if (unit.kind === "gunner") render.opacity = 0.88;
    }
  });
  // Initial actors must be visible before the first update as well.
  if (round)
    for (const actor of round.units)
      actor.add(new Renderable(appearance[actor.require(Unit.type).kind]));
}
