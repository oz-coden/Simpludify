import assert from "node:assert/strict";

// Run against the built site, including inline theme initialization and real bubbling.
export async function testSiteTheme(browser, site) {
  const read = (page) => page.locator("html").getAttribute("data-theme");
  for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.goto(site);
    assert.equal(await read(page), colorScheme, "OS preference is the default");
    await page.locator("article h1").click();
    assert.equal(
      await read(page),
      colorScheme,
      "body click must not toggle theme",
    );
    await page.locator("main").click({ position: { x: 4, y: 4 } });
    assert.equal(
      await read(page),
      colorScheme,
      "whitespace must not toggle theme",
    );
    await page
      .locator("header")
      .getByRole("link", { name: "サンプル", exact: true })
      .click();
    assert.equal(
      await read(page),
      colorScheme,
      "navigation must not toggle theme",
    );
    await page.locator('[data-launch="character"]').click();
    assert.equal(await read(page), colorScheme, "launch must not toggle theme");
    await page.locator("[data-stop]").click();
    assert.equal(await read(page), colorScheme, "stop must not toggle theme");
    const toggle = page.getByRole("button", { name: "テーマを切り替える" });
    const other = colorScheme === "dark" ? "light" : "dark";
    await toggle.click();
    assert.equal(await read(page), other, "button toggles exactly once");
    assert.equal(
      await toggle.getAttribute("aria-pressed"),
      String(other === "dark"),
    );
    await page.reload();
    assert.equal(
      await read(page),
      other,
      "explicit preference survives reload",
    );
    await page.emulateMedia({ colorScheme });
    await page.goto(`${site}en/index.html`);
    assert.equal(
      await read(page),
      other,
      "explicit preference survives navigation and OS default",
    );
    await toggle.focus();
    await page.keyboard.press("Enter");
    assert.equal(await read(page), colorScheme, "native Enter activation");
    await page.keyboard.press("Space");
    assert.equal(await read(page), other, "native Space activation");
    await context.close();
  }
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.goto(site);
  assert.equal(
    await read(page),
    "dark",
    "OS preference survives blocked storage",
  );
  await page.getByRole("button", { name: "テーマを切り替える" }).click();
  assert.equal(await read(page), "light", "toggle works without storage");
  await context.close();
}
