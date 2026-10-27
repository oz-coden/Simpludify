const root = document.documentElement;
const theme = document.querySelector("button[data-theme-toggle]");
const updateThemeButton = () =>
  theme?.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
updateThemeButton();
theme?.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  updateThemeButton();
  try {
    localStorage.setItem("simpludify-docs-theme", root.dataset.theme);
  } catch {
    /* optional storage */
  }
});
const menu = document.querySelector(".menu-toggle");
menu?.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("menu-open", open);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("menu-open")) {
    document.body.classList.remove("menu-open");
    menu?.setAttribute("aria-expanded", "false");
    menu?.focus();
  }
});
const player = document.querySelector(".playground");
const slot = document.querySelector("[data-frame-slot]");
const status = document.querySelector("[data-player-status]");
let current, launcher, frame;
function release() {
  // Explicit disposal also handles browsers that skip iframe pagehide.
  const retired = frame;
  frame = undefined;
  try {
    retired?.contentWindow?.dispatchEvent(new Event("simpludify:dispose"));
  } finally {
    retired?.remove();
  }
}

function launch(button) {
  release();
  current = button.dataset.launch;
  launcher = button;
  player.hidden = false;
  const title = button.closest("section").querySelector("h2").textContent;
  document.querySelector("#player-title").textContent = title;
  status.textContent =
    "読み込み中… WebGLが利用できない場合はゲーム内の案内を確認してください。";
  frame = document.createElement("iframe");
  frame.title = `${title} — 操作可能なサンプル`;
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
  frame.setAttribute("allow", "fullscreen");
  frame.src = `${document.body.dataset.base}play/${current}/index.html`;
  frame.addEventListener("load", () => {
    status.textContent = "読み込み完了。ゲーム内で操作を開始してください。";
  });
  slot.append(frame);
  player.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
}
for (const button of document.querySelectorAll("[data-launch]"))
  button.addEventListener("click", () => launch(button));
document
  .querySelector("[data-restart]")
  ?.addEventListener("click", () => launch(launcher));
document.querySelector("[data-stop]")?.addEventListener("click", () => {
  release();
  player.hidden = true;
  launcher?.focus();
});
window.addEventListener("pagehide", release);
