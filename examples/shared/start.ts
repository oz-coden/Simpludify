// Example host integration, not a new engine API.
import type { Game } from "@simpludify/web";

export async function startExample<Id extends string>(
  game: Game<Id>,
  id?: Id,
): Promise<void> {
  const shutdown = new AbortController();
  const dispose = () => {
    shutdown.abort();
    game.dispose();
  };
  window.addEventListener("pagehide", dispose, { signal: shutdown.signal });
  window.addEventListener("simpludify:dispose", dispose, {
    signal: shutdown.signal,
  });
  // A back/forward-cache restore must not resume a disposed engine.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && game.engine.disposed) window.location.reload();
  });
  try {
    await game.run(id);
  } catch (error) {
    dispose();
    const message = document.createElement("section");
    message.setAttribute("role", "alert");
    message.style.cssText =
      "padding:2rem;color:#e2ece5;background:#101922;font:16px/1.8 system-ui;max-width:42rem;margin:auto";
    const heading = document.createElement("h1");
    heading.textContent = "サンプルを起動できませんでした / Unable to start";
    const help = document.createElement("p");
    help.textContent =
      "WebGLに対応するブラウザと、ハードウェアアクセラレーションの設定を確認してください。他の起動エラーの場合はページを再読み込みし、開発者コンソールを確認してください。 / Check WebGL support, browser settings and the developer console.";
    const retry = document.createElement("button");
    retry.textContent = "再読み込み / Reload";
    retry.onclick = () => window.location.reload();
    message.append(heading, help, retry);
    document.body.replaceChildren(message);
    console.error(error);
  }
}
