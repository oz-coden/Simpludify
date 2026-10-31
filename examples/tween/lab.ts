import {
  type ActionReader,
  Actor,
  actorTween,
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasRow,
  CanvasScroll,
  CanvasSlider,
  CanvasTextInput,
  Character,
  canvasTween,
  Easing,
  Renderable,
  type SceneContext,
  Shape,
  SpriteAnimation,
  SpriteSheet,
  sliderTween,
  Transform,
  Tween,
  type TweenPlayback,
  type TweenRecipe,
  type TweenScheduler,
} from "@simpludify/web";

export function buildTweenLab(
  context: SceneContext,
  host: {
    readonly spriteURL: string;
    readonly movement: ActionReader<"axis2d">;
    readonly paused: () => boolean;
    readonly pause: () => void;
    readonly resume: () => void;
    readonly leave: () => Promise<void>;
    readonly restart: () => Promise<void>;
  },
) {
  const { scene, tweens: simulation, presentationTweens: display } = context;
  const handles = new Set<TweenPlayback>();
  const status = CanvasLabel(
    "Simulation drives Actors; display time drives UI, even while paused.",
    { height: 52, shrink: 0, fontSize: 14 },
  );
  const volume = CanvasSlider(
    { label: "Animated value", value: 20 },
    { height: 68, shrink: 0, width: 280 },
  );
  const hp = CanvasSlider(
    { label: "HP (logical / accessible value)", value: 100, readOnly: true },
    { height: 68, shrink: 0, width: 280 },
  );
  const field = CanvasTextInput(
    { label: "Animated native field", value: "UI and native geometry agree" },
    { height: 42, width: 250, shrink: 0, fontSize: 14 },
  );
  let hits = 0;
  const moving = CanvasButton(
    "Moving target",
    () => {
      hits++;
      status.setText(`Moving target hits: ${hits}`);
    },
    { width: 180, height: 40, shrink: 0, fontSize: 14, background: 0x006600 },
  );
  const preview = CanvasColumn([moving, field], {
    padding: 6,
    gap: 6,
    height: 108,
    shrink: 0,
    background: 0x224466,
  });
  const lanes = CanvasColumn(
    [
      CanvasLabel("Linear", { height: 50, fontSize: 14, shrink: 0 }),
      CanvasLabel("OutCubic", { height: 50, fontSize: 14, shrink: 0 }),
      CanvasLabel("InOutCubic + WASD + sprite frames", {
        height: 50,
        fontSize: 14,
        shrink: 0,
      }),
    ],
    { height: 170, shrink: 0 },
  );
  const plain = { intensity: 0 };
  const play = (clock: TweenScheduler, recipe: TweenRecipe, label?: string) => {
    let handle: TweenPlayback | undefined;
    const p = clock.play(recipe, {
      owner: root,
      onComplete: () => {
        if (handle) handles.delete(handle);
        if (label && !scene.disposed && !status.disposed)
          status.setText(`${label}: completed`);
      },
      onCancel: (reason) => {
        if (handle) handles.delete(handle);
        if (label && !scene.disposed && !status.disposed)
          status.setText(`${label}: ${reason}`);
      },
    });
    handle = p;
    if (p.state === "playing" || p.state === "paused") handles.add(p);
    return p;
  };
  const box = (id: string, y: number, color: number) => {
    const actor = scene.add(new Actor({ id }));
    actor.add(new Transform({ x: 90, y }));
    actor.add(
      new Renderable({
        width: 24,
        height: 16,
        color,
        source: { kind: "shape", shape: Shape.Box },
      }),
    );
    return actor;
  };
  const linear = box("linear", 80, 0xff0000),
    cubic = box("cubic", 130, 0x00ccff),
    sprite = context.add(
      Character({
        id: "sprite",
        x: 90,
        y: 180,
        size: 24,
        movement: host.movement,
        source: { kind: "image", url: host.spriteURL },
      }),
    );
  const sheet = SpriteSheet.grid(host.spriteURL, {
    frameWidth: 32,
    frameHeight: 32,
  });
  const animation = sprite.add(
    new SpriteAnimation({
      sheet,
      clips: { walk: { frames: [0, 1, 2, 3], fps: 6 } },
      initial: "walk",
    }),
  );
  const start = () => {
    for (const p of [...handles]) p.cancel();
    for (const actor of [linear, cubic, sprite]) {
      const v = actor.require(Renderable.type);
      v.offsetX = 0;
      v.offsetY = 0;
      v.rotation = 0;
      v.scaleX = 1;
      v.scaleY = 1;
      v.opacity = 1;
    }
    for (const [actor, easing] of [
      [linear, Easing.Linear],
      [cubic, Easing.OutCubic],
      [sprite, Easing.InOutCubic],
    ] as const)
      play(
        simulation,
        Tween.to(actorTween(actor).offsetX, 180, {
          duration: 2,
          repeat: Infinity,
          yoyo: true,
          easing,
        }),
      );
    play(
      simulation,
      Tween.parallel(
        Tween.to(actorTween(cubic).rotation, Math.PI, {
          duration: 2,
          repeat: Infinity,
          yoyo: true,
        }),
        Tween.to(actorTween(cubic).opacity, 0.25, {
          duration: 2,
          repeat: Infinity,
          yoyo: true,
        }),
        Tween.to(actorTween(cubic).scaleY, 1.8, {
          duration: 2,
          repeat: Infinity,
          yoyo: true,
        }),
      ),
    );
    status.setText(
      "WASD moves the sprite's world Transform; Tween changes only its draw offset.",
    );
  };
  const animateUI = () => {
    preview.setPresentation({ offsetX: 70, opacity: 0 });
    return play(
      display,
      Tween.sequence(
        Tween.parallel(
          Tween.to(canvasTween(preview).offsetX, 0, {
            duration: 0.8,
            easing: Easing.OutCubic,
          }),
          Tween.to(canvasTween(preview).opacity, 1, { duration: 0.5 }),
        ),
        Tween.delay(0.2),
        Tween.to(canvasTween(preview).opacity, 0.35, { duration: 0.3 }),
        Tween.to(canvasTween(preview).opacity, 1, { duration: 0.3 }),
      ),
      "UI sequence",
    );
  };
  const animateValue = () =>
    play(
      display,
      Tween.to(sliderTween(volume), 80, {
        duration: 1,
        easing: Easing.OutCubic,
      }),
      "Slider value",
    );
  const damage = () => {
    const shown = hp.displayValue;
    hp.value = hp.value <= 0 ? 100 : Math.max(0, hp.value - 25);
    hp.displayValue = shown;
    return play(
      display,
      Tween.to(sliderTween(hp, "display"), hp.value, {
        duration: 0.7,
        easing: Easing.OutCubic,
      }),
      "HP display",
    );
  };
  const compose = () =>
    play(
      simulation,
      Tween.sequence(
        Tween.parallel(
          Tween.to(actorTween(cubic).offsetX, 120, { duration: 0.6 }),
          Tween.to(actorTween(cubic).rotation, Math.PI / 2, { duration: 0.6 }),
        ),
        Tween.delay(0.2),
        Tween.parallel(
          Tween.to(actorTween(cubic).offsetX, 0, { duration: 0.6 }),
          Tween.to(actorTween(cubic).opacity, 0.2, { duration: 0.6 }),
        ),
        Tween.to(actorTween(cubic).opacity, 1, { duration: 0.3 }),
      ),
      "Actor sequence",
    );
  const button = (label: string, handler: () => void | Promise<void>) =>
    CanvasButton(label, handler, {
      width: 138,
      minHeight: 42,
      shrink: 0,
      fontSize: 14,
    });
  const buttons = CanvasRow(
    [
      button("Start / Restart", start),
      button("Pause game", () => {
        if (host.paused()) host.resume();
        else host.pause();
        status.setText(
          host.paused()
            ? "Simulation paused; UI display time still runs."
            : "Simulation resumed.",
        );
      }),
      button("Pause tweens", () => {
        for (const p of handles) p.pause();
        status.setText("Playback paused; property claims are retained.");
      }),
      button("Resume tweens", () => {
        for (const p of handles) p.resume();
        status.setText("Playback resumed.");
      }),
      button("Cancel all", () => {
        for (const p of [...handles]) p.cancel();
        status.setText(
          "Canceled: current values retained; no completion callbacks.",
        );
      }),
      button("Finish finite", () => {
        for (const p of [...handles])
          if (Number.isFinite(p.duration)) p.finish();
      }),
      button("Sequence / Parallel", () => {
        compose();
      }),
      button("Fade / Slide UI", () => {
        animateUI();
      }),
      button("Tween value to 80", () => {
        animateValue();
      }),
      button("Damage HP", () => {
        damage();
      }),
      button("Tween plain state", () => {
        play(
          display,
          Tween.to(Tween.property(plain, "intensity"), 1, {
            from: 0,
            duration: 0.8,
          }),
          "Plain state intensity",
        );
      }),
      button("Recreate Scene", host.restart),
      button("Leave Scene", host.leave),
    ],
    { wrap: true, gap: 8, shrink: 0 },
  );
  const scroll = CanvasScroll([buttons, status, volume, hp, preview], {
    gap: 10,
    grow: 1,
    minHeight: 100,
    padding: 8,
    background: 0x172630,
  });
  const root = CanvasColumn(
    [
      CanvasLabel("Tween lab", { height: 32, fontSize: 26, shrink: 0 }),
      lanes,
      scroll,
    ],
    { padding: 12, gap: 8, maxWidth: 640 },
  );
  const ui = context.canvasUI(root);
  start();
  return {
    scene,
    simulation,
    display,
    handles,
    ui,
    root,
    scroll,
    preview,
    moving,
    field,
    volume,
    hp,
    linear,
    cubic,
    sprite,
    animation,
    linearView: linear.require(Renderable.type),
    plain,
    status,
    start,
    animateUI,
    animateValue,
    damage,
    compose,
    get hits() {
      return hits;
    },
  };
}
