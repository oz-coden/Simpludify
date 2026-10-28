import { Actor, SpriteAnimation, SpriteSheet } from "@simpludify/core";
export function spriteTypes() {
  const sheet = SpriteSheet.grid("hero.png", {
    frameWidth: 32,
    frameHeight: 32,
    names: { idle: 0, walk: 1 },
  });
  sheet.get("idle");
  sheet.get(3);
  // @ts-expect-error unknown frame name
  sheet.get("idel");
  const actor = new Actor();
  const animation = actor.add(
    new SpriteAnimation({
      sheet,
      clips: {
        idle: { frames: ["idle"], fps: 4 },
        walk: { frames: [1, 2, 3], frameSeconds: 0.1 },
      },
      initial: "idle",
    }),
  );
  animation.play("walk");
  // @ts-expect-error unknown clip
  animation.play("wolk");
  new SpriteAnimation({
    sheet,
    clips: { idle: { frames: [0] } },
    // @ts-expect-error invalid initial must not widen clip names
    initial: "typo",
  });
  // @ts-expect-error unknown named sheet frame
  new SpriteAnimation({ sheet, clips: { idle: { frames: ["typo"] } } });
  new SpriteAnimation({
    sheet,
    // @ts-expect-error timing alternatives are exclusive
    clips: { idle: { frames: [0], fps: 4, frameSeconds: 1 } },
  });
  // @ts-expect-error invalid loop type
  new SpriteAnimation({ sheet, clips: { idle: { frames: [0], loop: "yes" } } });
  const rects = SpriteSheet.rects("atlas.png", {
    face: { x: 0, y: 0, width: 16, height: 20 },
  } as const);
  rects.get("face");
  // @ts-expect-error unknown atlas frame
  rects.get("faces");
}
