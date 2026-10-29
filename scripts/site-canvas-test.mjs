import assert from "node:assert/strict";
/** Works with a gallery Frame or a standalone Page; exercises production output. */
export async function testCanvasUI(frame, page) {
  await frame.waitForFunction(
    () => window.canvasDemo?.game.engine.scene.state === "active",
  );
  await frame
    .getByRole("button", { name: "Start", exact: true })
    .press("Enter");
  await frame.waitForFunction(
    () =>
      window.canvasDemo.game.engine.scene.id === "field" &&
      window.canvasDemo.game.engine.scene.state === "active",
  );
  const pixel = await frame.evaluate(async () => {
    const d = window.canvasDemo;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const b = d.buttons.Pause.bounds,
      canvas = d.game.element.querySelector("canvas"),
      copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const c = copy.getContext("2d");
    c.drawImage(canvas, 0, 0);
    const ratio = canvas.width / canvas.clientWidth;
    return [
      ...c.getImageData(
        Math.round((b.x + 8) * ratio),
        Math.round((b.y + 8) * ratio),
        1,
        1,
      ).data,
    ].slice(0, 3);
  });
  assert.deepEqual(pixel, [35, 89, 78]);
  await frame.locator(".simpludify").focus();
  await page.keyboard.down("KeyD");
  await frame.waitForFunction(
    () =>
      Math.abs(window.canvasDemo.game.engine.scene.find("explorer").x - 434) <
        1e-6 && window.canvasDemo.world.tileDiagnostics.contacts > 0,
  );
  await page.keyboard.up("KeyD");
  await frame
    .getByRole("button", { name: "Pause", exact: true })
    .press("Enter");
  await frame.waitForFunction(() => window.canvasDemo.game.paused);
  await frame
    .getByRole("button", { name: "Resume", exact: true })
    .press("Space");
  await frame.waitForFunction(() => !window.canvasDemo.game.paused);
  await frame.getByRole("button", { name: "Menu", exact: true }).press("Enter");
  await frame.waitForFunction(
    () => window.canvasDemo.game.engine.scene.id === "title",
  );
  await frame
    .getByRole("button", { name: "Start", exact: true })
    .press("Enter");
  await frame.waitForFunction(
    () => window.canvasDemo.game.engine.scene.id === "field",
  );
  const r = await frame.evaluate(() => ({
    x: window.canvasDemo.game.engine.scene.find("explorer").x,
    buttons: document.querySelectorAll(".s-canvas-accessibility button").length,
    captures: window.canvasDemo.game.pointerDiagnostics.captures,
  }));
  assert.equal(r.x, 250);
  assert.equal(r.buttons, 7);
  assert.equal(r.captures, 0);
  return { pixel, ...r };
}
