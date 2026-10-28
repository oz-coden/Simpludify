import {
  Actor,
  Component,
  defineComponent,
  Engine,
  Renderable,
  Scene,
  Shape,
  SpriteAnimation,
  type SpriteClip,
  SpriteSheet,
  Transform,
} from "@simpludify/core";
import { describe, expect, it, vi } from "vitest";

const sheet = SpriteSheet.grid("hero.png", {
  frameWidth: 16,
  frameHeight: 16,
  names: { idle: 0, walk: 1 },
});
function fixture() {
  const engine = new Engine();
  const actor = engine.scene.add(new Actor());
  actor.add(new Transform());
  const view = actor.add(new Renderable({ source: sheet.get(0) }));
  const complete = vi.fn();
  const animation = actor.add(
    new SpriteAnimation({
      sheet,
      clips: {
        idle: { frames: ["idle", 1, 2, 3], fps: 4 },
        walk: { frames: ["walk", 2], frameSeconds: 0.1 },
        once: { frames: [2, 3], fps: 2, loop: false },
      },
      initial: "idle",
      onComplete: complete,
    }),
  );
  return { engine, actor, view, animation, complete };
}
describe("SpriteAnimation", () => {
  it("updates only on simulation steps, loops and preserves same-clip progress", () => {
    const f = fixture();
    f.engine.step(0.25);
    expect(f.animation.frameIndex).toBe(1);
    const revision = f.view.revision;
    f.animation.play("idle");
    expect(f.view.revision).toBe(revision);
    f.engine.step(0.5);
    expect(f.animation.frameIndex).toBe(3);
    f.engine.step(0.25);
    expect(f.animation.frameIndex).toBe(0);
    expect(f.complete).not.toHaveBeenCalled();
    f.engine.pause();
    f.engine.step(100);
    expect(f.animation.elapsed).toBe(0);
    f.engine.resume();
    f.engine.step(0.25);
    expect(f.animation.frameIndex).toBe(1);
  });
  it("pauses, resumes, stops, switches immediately and explicitly restarts", () => {
    const f = fixture();
    f.engine.step(0.3);
    f.animation.pause();
    f.animation.play("idle");
    f.engine.step(5);
    expect(f.animation.state).toBe("paused");
    expect(f.animation.elapsed).toBe(0.3);
    f.animation.resume();
    f.engine.step(0.2);
    expect(f.animation.frameIndex).toBe(2);
    f.animation.play("walk");
    expect(f.view.source).toMatchObject(sheet.get("walk"));
    expect(f.animation.elapsed).toBe(0);
    f.engine.step(0.1);
    expect(f.animation.frameIndex).toBe(1);
    f.animation.play("walk", { restart: true });
    expect(f.animation.frameIndex).toBe(0);
    f.animation.stop();
    f.engine.step(5);
    f.animation.resume();
    expect(f.animation.state).toBe("stopped");
    expect(f.animation.elapsed).toBe(0);
    f.animation.play("walk");
    expect(f.animation.state).toBe("playing");
  });
  it("holds the last frame and completes once, allowing callback playback", () => {
    const f = fixture();
    f.animation.play("once");
    f.engine.step(0.5);
    expect(f.animation.state).toBe("playing");
    f.engine.step(0.5);
    expect(f.animation.state).toBe("completed");
    expect(f.animation.frameIndex).toBe(1);
    expect(f.view.source).toMatchObject(sheet.get(3));
    f.engine.step(100);
    expect(f.complete).toHaveBeenCalledExactlyOnceWith("once");
    f.animation.play("once");
    expect(f.animation.frameIndex).toBe(0);
    f.complete.mockImplementation(() => f.animation.play("idle"));
    f.engine.step(20);
    expect(f.animation.current).toBe("idle");
    expect(f.animation.elapsed).toBe(0);
  });
  it("handles large deltas in bounded work, including finite addition overflow", () => {
    const f = fixture();
    f.engine.step(1e12 + 0.75);
    expect(f.animation.frameIndex).toBe(3);
    f.engine.step(Number.MAX_VALUE);
    expect(Number.isFinite(f.animation.elapsed)).toBe(true);
    const actor = new Actor();
    actor.add(new Transform());
    actor.add(new Renderable());
    const a = actor.add(
      new SpriteAnimation({
        sheet,
        clips: { slow: { frames: [0, 1], frameSeconds: 8e307 } },
      }),
    );
    a.update({ delta: 1e308, scene: f.engine.scene });
    a.update({ delta: 1e308, scene: f.engine.scene });
    expect(Number.isFinite(a.elapsed)).toBe(true);
    expect(a.elapsed / 1e307).toBeCloseTo(4);
  });
  it("keeps independent cursors and appearance; paused/stopped writers yield source", () => {
    const f = fixture();
    const other = f.engine.scene.add(new Actor());
    other.add(new Transform());
    other.add(new Renderable());
    const a = other.add(
      new SpriteAnimation({
        sheet,
        clips: { idle: { frames: [0, 1], fps: 2 } },
      }),
    );
    a.pause();
    f.engine.step(0.5);
    expect(a.frameIndex).toBe(0);
    expect(f.animation.frameIndex).toBe(2);
    f.view.color = 0xff0000;
    f.view.width = 72;
    f.view.opacity = 0.5;
    f.view.source = { kind: "shape", shape: Shape.Circle };
    f.engine.step(0);
    expect(f.view.source).toMatchObject(sheet.get(2));
    expect(f.view.color).toBe(0xff0000);
    expect(f.view.width).toBe(72);
    expect(f.view.opacity).toBe(0.5);
    f.animation.pause();
    f.view.source = { kind: "shape", shape: Shape.Circle };
    f.engine.step(1);
    expect(f.view.source.kind).toBe("shape");
  });
  it("respects Actor/Component gating, additions and destruction", () => {
    const f = fixture();
    f.actor.enabled = false;
    f.engine.step(1);
    expect(f.animation.elapsed).toBe(0);
    f.actor.enabled = true;
    f.animation.enabled = false;
    f.engine.step(1);
    expect(f.animation.elapsed).toBe(0);
    f.animation.enabled = true;
    f.engine.step(0.25);
    expect(f.animation.frameIndex).toBe(1);
    f.actor.dispose();
    expect(f.animation.state).toBe("stopped");
    expect(() => f.animation.play("idle")).toThrow();
    f.engine.step(1);
    const g = fixture();
    g.engine.activate(new Scene("replacement"));
    expect(g.animation.disposed).toBe(true);
    const h = fixture();
    h.actor.remove(SpriteAnimation.type);
    expect(h.animation.disposed).toBe(true);
    expect(h.view.disposed).toBe(false);
    h.engine.dispose();
  });
  it("runs in LateUpdate and starts newly added components next step", () => {
    const f = fixture();
    class Switch extends Component {
      readonly type = defineComponent("Switch");
      update() {
        f.animation.play("walk");
      }
    }
    f.actor.add(new Switch());
    f.engine.step(0.1);
    expect(f.animation.current).toBe("walk");
    expect(f.animation.frameIndex).toBe(1);
    f.actor.dispose();
    const actor = f.engine.scene.add(new Actor());
    actor.add(new Transform());
    actor.add(new Renderable());
    let animation: SpriteAnimation<"new"> | undefined;
    f.engine.scene.onUpdate(() => {
      animation ??= actor.add(
        new SpriteAnimation({
          sheet,
          clips: { new: { frames: [0, 1], fps: 2 } },
        }),
      );
    });
    f.engine.step(0.5);
    expect(animation?.frameIndex).toBe(0);
    f.engine.step(0.5);
    expect(animation?.frameIndex).toBe(1);
  });
  it("rejects invalid definitions atomically and copies clips", () => {
    const frames = [0, 1];
    const a = new SpriteAnimation({ sheet, clips: { idle: { frames } } });
    frames.length = 0;
    expect(a.state).toBe("playing");
    for (const fps of [0, -1, NaN, Infinity])
      expect(
        () =>
          new SpriteAnimation({
            sheet,
            clips: { invalid: { frames: [0], fps } },
          }),
      ).toThrow();
    expect(() => new SpriteAnimation({ sheet, clips: {} })).toThrow();
    expect(
      () => new SpriteAnimation({ sheet, clips: { empty: { frames: [] } } }),
    ).toThrow();
    expect(
      () =>
        new SpriteAnimation({
          sheet,
          clips: {
            invalid: {
              frames: [0],
              fps: 2,
              frameSeconds: 1,
            } as unknown as SpriteClip,
          },
        }),
    ).toThrow();
    expect(() => a.play("missing" as "idle")).toThrow();
    expect(a.current).toBe("idle");
  });
});
