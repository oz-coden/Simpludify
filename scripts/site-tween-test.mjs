import assert from "node:assert/strict";
/** Exercise the real production sample, both standalone and in the gallery. */
export async function testTween(frame, page) {
  // Numeric/lifecycle checks must not require an extra WebGL-rendered RAF just
  // to observe an already applied value on software-driver runners.
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
    const button = frame.getByRole("button", { name, exact: true });
    await button.focus();
    assert.equal(
      await button.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Enter");
  };
  await press("Pause game");
  await wait(() => window.tweenDemo.game.paused);
  const x = await frame.evaluate(() => window.tweenDemo.lab.linearView.offsetX);
  await press("Fade / Slide UI");
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
  await press("Tween value to 80");
  await wait(
    () =>
      window.tweenDemo.lab.volume.value === 80 &&
      window.tweenDemo.lab.display.diagnostics.active === 0,
  );
  await press("Damage HP");
  await wait(
    () =>
      window.tweenDemo.lab.hp.value === 75 &&
      window.tweenDemo.lab.hp.displayValue === 75,
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
  const step = await frame.evaluate(() => window.tweenDemo.game.engine.stepCount);
  await wait((count) => window.tweenDemo.game.engine.stepCount > count, step);
  await frame.locator(".simpludify").focus();
  const before = await frame.evaluate(() => ({
    x: window.tweenDemo.lab.sprite.x,
    steps: window.tweenDemo.game.engine.stepCount,
  }));
  await page.keyboard.down("d");
  try {
    await wait((before) => {
      const d = window.tweenDemo;
      if (d.game.engine.disposed)
        throw Error(`Disposed during movement: ${document.body.textContent}`);
      return d.lab.sprite.x > before.x + 5;
    }, before);
  } catch (error) {
    console.error(
      "Tween movement diagnostic",
      await frame.evaluate((before) => {
        const d = window.tweenDemo;
        return {
          before,
          scene: d.game.engine.scene.id,
          paused: d.game.paused,
          disposed: d.game.engine.disposed,
          steps: d.game.engine.stepCount,
          x: d.lab.sprite.x,
          input: d.game.engine.input.snapshot(),
          hidden: document.hidden,
          active: document.activeElement?.outerHTML,
        };
      }, before),
    );
    throw error;
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
    await frame.evaluate(() => window.tweenDemo.lab.simulation.diagnostics.active),
    4,
  );
}
