import assert from "node:assert/strict";
/** Exercise the real production sample, both standalone and in the gallery. */
export async function testTween(frame, page) {
  // Numeric/lifecycle checks must not require an extra WebGL-rendered RAF just
  // to observe an already applied value on software-driver runners.
  await page.bringToFront();
  const wait = (predicate, arg) =>
    frame.waitForFunction(predicate, arg, { polling: 50 });
  await wait(() => window.tweenDemo?.game.engine.scene.state === "active");
  // SwiftShader can spend seconds rendering one frame. The Host deliberately caps
  // its delta, so a wall-clock wait cannot imply 1.6 simulation/display seconds.
  // Exercise real RAF and public speed control here; deterministic browser tests
  // separately assert intermediate pixels, normal speed and the Host delta cap.
  await frame.evaluate(() => {
    window.tweenDemo.lab.display.speed = 100;
  });
  const press = async (name) => {
    // Gallery iframes can be shorter than the controls list. Use the engine's
    // logical focus/reveal API before sending a real native keyboard event.
    await frame.evaluate((name) => {
      const d = window.tweenDemo;
      if (d.game.engine.scene.id !== "lab" || d.lab.root.disposed) return;
      const pending = [d.lab.root];
      while (pending.length) {
        const node = pending.shift();
        if (node.kind === "button" && node.text === name) {
          d.lab.ui.focus(node);
          d.game.setViewport();
          return;
        }
        pending.push(...node.children);
      }
      throw Error(`Missing lab button: ${name}`);
    }, name);
    if (typeof frame.frameElement === "function")
      await (await frame.frameElement()).focus();
    const button = frame.getByRole("button", { name, exact: true });
    await button.focus();
    assert.equal(
      await button.evaluate(
        (el) => el === document.activeElement && document.hasFocus(),
      ),
      true,
    );
    await page.keyboard.press("Enter");
  };
  const advanceDisplay = () =>
    frame.evaluate(() => {
      const d = window.tweenDemo;
      d.lab.scene.advancePresentation(0.05);
      d.game.setViewport();
    });
  await press("Pause game");
  await wait(() => window.tweenDemo.game.paused);
  const x = await frame.evaluate(() => window.tweenDemo.lab.linearView.offsetX);
  await press("Fade / Slide UI");
  await advanceDisplay();
  try {
    await wait(() => {
      const d = window.tweenDemo;
      if (d.game.engine.disposed)
        throw Error(`Tween sample disposed: ${document.body.textContent}`);
      return (
        d.lab.preview.presentation.opacity === 1 &&
        d.lab.display.diagnostics.active === 0
      );
    });
  } catch (error) {
    console.error(
      "Tween display diagnostic",
      await frame.evaluate(() => {
        const d = window.tweenDemo;
        return {
          disposed: d.game.engine.disposed,
          paused: d.game.paused,
          presentation: d.lab.preview.presentation,
          active: d.lab.display.diagnostics.active,
          status: d.lab.status.text,
          handles: [...d.lab.handles].map((p) => ({
            state: p.state,
            elapsed: p.elapsed,
            duration: p.duration,
            reason: p.reason,
          })),
          body: document.body.textContent,
        };
      }),
    );
    throw error;
  }
  assert.equal(
    await frame.evaluate(() => window.tweenDemo.lab.linearView.offsetX),
    x,
  );
  assert.equal(
    await frame.evaluate(() => window.tweenDemo.lab.status.text),
    "UI sequence: completed",
  );
  await press("Tween value to 80");
  await advanceDisplay();
  await wait(
    () =>
      window.tweenDemo.lab.volume.value === 80 &&
      window.tweenDemo.lab.display.diagnostics.active === 0,
  );
  assert.equal(
    await frame.evaluate(() => window.tweenDemo.lab.status.text),
    "Slider value: completed",
  );
  await press("Damage HP");
  await advanceDisplay();
  await wait(
    () =>
      window.tweenDemo.lab.hp.value === 75 &&
      window.tweenDemo.lab.hp.displayValue === 75,
  );
  assert.equal(
    await frame.evaluate(() => window.tweenDemo.lab.status.text),
    "HP display: completed",
  );
  await press("Cancel all");
  assert.equal(
    await frame.evaluate(
      () => window.tweenDemo.lab.simulation.diagnostics.active,
    ),
    0,
  );
  await press("Pause game");
  await wait(() => !window.tweenDemo.game.paused);
  await frame.evaluate(() => window.tweenDemo.game.whenReady());
  if (typeof frame.frameElement === "function")
    await (await frame.frameElement()).scrollIntoViewIfNeeded();
  if (typeof frame.frameElement === "function")
    await (await frame.frameElement()).focus();
  await frame.locator(".simpludify").focus();
  assert.equal(await frame.evaluate(() => document.hasFocus()), true);
  const before = await frame.evaluate(() => {
    const d = window.tweenDemo;
    d.game.setViewport();
    return {
      x: d.lab.sprite.x,
      pixels: d.game.element.querySelector("canvas").toDataURL(),
    };
  });
  await page.keyboard.down("d");
  try {
    const after = await frame.evaluate(() => {
      const d = window.tweenDemo;
      d.game.engine.step(0.05);
      d.game.pause();
      d.game.setViewport();
      return {
        x: d.lab.sprite.x,
        pixels: d.game.element.querySelector("canvas").toDataURL(),
      };
    });
    assert.ok(after.x > before.x + 5);
    assert.notEqual(after.pixels, before.pixels);
  } finally {
    await page.keyboard.up("d");
  }
  const old = await frame.evaluateHandle(() => window.tweenDemo.lab);
  await press("Leave Scene");
  await wait(() => window.tweenDemo.game.engine.scene.id === "empty");
  assert.deepEqual(
    await old.evaluate((lab) => ({
      scene: lab.scene.disposed,
      root: lab.root.disposed,
      simulation: lab.simulation.diagnostics.active,
      display: lab.display.diagnostics.active,
      handles: lab.handles.size,
    })),
    { scene: true, root: true, simulation: 0, display: 0, handles: 0 },
  );
  await old.dispose();
  await press("Return to lab");
  await wait(
    () =>
      window.tweenDemo.game.engine.scene.id === "lab" &&
      window.tweenDemo.game.engine.scene.state === "active",
  );
  assert.equal(
    await frame.evaluate(
      () => window.tweenDemo.lab.simulation.diagnostics.active,
    ),
    4,
  );
  await frame.evaluate(() => window.tweenDemo.game.pause());
}
