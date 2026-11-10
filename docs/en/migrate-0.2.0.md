# Migrate from Simpludify v0.1.7 to v0.2.0

Install the v0.2.0 release from npm and commit the updated lockfile. Web installs the matching Core package. Projects that also declare Core directly should update both dependencies together.

```sh
npm install --save-exact @simpludify/web@0.2.0
```

If both are direct dependencies, use this command.

```sh
npm install --save-exact @simpludify/core@0.2.0 @simpludify/web@0.2.0
```

## 1. Keep existing Scene navigation and image URLs

Continue to call `game.changeScene(id)`. The default still disposes the outgoing Scene and creates a fresh instance when its ID is entered again. Existing input bindings and URL-based Renderable, SpriteSheet and Tilemap images keep their existing behavior.

Opt into retention for a Scene whose simulation state should survive a visit to another Scene. Its setup runs once per instance. Its Actors, scoped assets, simulation timers and tweens are kept while rendering and ordinary input stop. Activation hooks run again and the presentation is rebuilt on return. Use the default disposal policy for screens whose navigation should restart them.

```ts verify
import { Game, Label } from "@simpludify/web";

const game = new Game<"menu" | "play">();
game.scene("menu", ({ ui }) => ui(Label("Menu")));
game.scene("play", ({ ui }) => ui(Label("Play")), { retention: "retain" });
await game.run("menu");
await game.changeScene("play");
```

## 2. Choose an Asset owner and load explicitly where needed

Use the `assets` passed to a Scene factory for Scene-owned media. Use `game.assets` for shared application resources or `game.assets.scope()` for a temporary loading batch. Keep a handle alive until the next owner has acquired its own reference. A retained Scene keeps its scope until disposal.

```ts verify
import { Actor, Game, Renderable, Transform } from "@simpludify/web";

const game = new Game<"stage">({ assets: { cacheEntries: 8 } });
game.scene("stage", async ({ add, assets }) => {
  const image = assets.load({ kind: "image", url: "./hero.png" });
  const rules = assets.load({ kind: "json", url: "./rules.json" });
  await Promise.all([image.ready, rules.ready]);
  // Validate rules.value before treating the JSON as application data.
  const actor = add(new Actor());
  actor.add(new Transform({ x: 100, y: 100 }));
  actor.add(new Renderable({ source: image.source }));
});
await game.run("stage");
```

The default renderer shares the initial URL image resource with implicit consumers. Use the managed `image.source` for fallback and generation updates, including `image.source.url` in a SpriteSheet or Tilemap. Passing the original URL still uses the implicit path. [Asset options, progress and retry](api.md#assets).

## 3. Add audio or a Game font

Load audio and fonts through the same Asset API. Use the Scene as the playback owner if disposal should stop the voice. Playback remains owned while a retained Scene is inactive. For audio that should pause on exit, call `pause()` and `resume()` from the Scene lifecycle hooks. The browser may defer playback until a trusted gesture.

```ts verify
import { Game } from "@simpludify/web";

const game = new Game<"stage">();
const font = game.assets.load({ kind: "font", url: "./ui.woff2" });
game.setFont(font);
font.release(); // The Game holds its own reference until reset or disposal.

game.scene(
  "stage",
  ({ assets, scene, onActivate, onDeactivate }) => {
    const theme = assets.load({ kind: "audio", url: "./theme.ogg" });
    const voice = game.audio.play(theme, {
      owner: scene,
      group: "music",
      loop: true,
    });
    game.audio.group("music").volume = 0.6;
    onDeactivate(() => voice.pause());
    onActivate(() => voice.resume());
  },
  { retention: "retain" },
);
await game.run("stage");
```

[Audio, voice limits and font registration](api.md#audio-and-fonts).

## 4. Move error reporting to structured diagnostics

`GameOptions.onError` continues to receive its existing runtime errors and is deprecated. For new code, subscribe to `game.logger` before starting the game. Catch rejected `run()` and `changeScene()` calls as usual. The Console sink can be disabled independently of subscribers.

```ts verify
import { Game, Lifetime } from "@simpludify/web";

const reporting = new Lifetime();
const game = new Game({ logging: { console: false } });
game.logger.subscribe((entry) => {
  if (entry.fatal) console.warn(entry.message);
}, reporting);
await game.run();
// Dispose reporting when its consumer is removed.
```

Engine output uses safe summaries. Diagnostic subscribers can inspect the original cause and details. [Logger settings and ownership](api.md#logger-and-diagnostics).
