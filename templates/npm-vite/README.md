# npm / Vite starter

Independent TypeScript game using published `@simpludify/web@0.1.2`. No source aliases, copied engine files or unreleased API. Core and PixiJS resolve transitively; `package-lock.json` pins the complete dependency tree. Requires Node >=22.12 (tested Node 24 in CI).

Copy this directory into an empty project, then run these same commands in Windows PowerShell, Command Prompt or a Linux shell:

```sh
npm ci
npm run dev
npm run check
npm run build -- --base /my-game/
npm run preview
```

Open the Vite URL. Click/Tab into the world and use WASD, or use **Move right** on touch. Pause/Resume and Restart use Scene-owned UI and input. The example imports scoped CSS explicitly; automatic Web-entry CSS is supported too. Give the application's parent a height. Scene replacement releases the previous Actors/UI/controls. Removing the host component must call `game.dispose()`; this example also handles pagehide and Vite HMR. Startup rejection disposes partial resources.

`npm run build` accepts `--base` directly and runs typechecking, license generation and Vite. Set `/my-game/` to your repository name for GitHub Pages; upload the entire `dist/` via Pages Actions. For custom-domain root hosting use `/`. The default `./` supports relative static hosting. There is no server component.

The build includes `LICENSE.txt` and `THIRD-PARTY-NOTICES.txt`, generated from the installed locked production packages, including nested dependencies. Missing texts fail the build. A version-specific MIT fallback for `@pixi/colord@2.9.6` includes its upstream provenance in `third-party/colord`. Review those files after dependency upgrades; the script verifies available notices rather than deciding the legal suitability of arbitrary future licenses. Platform-specific absent optional packages are excluded from that host's redistributed notices. Build tool licenses are not runtime notices.

`LICENSE` initially contains the starter's MIT license. Preserve it for this code and choose/document your game's own licensing as appropriate. Commit the lockfile after intentional dependency changes. The Canvas HUD and world region are connected with `Game.bindViewport`, so viewport geometry follows the resolved UI layout and Scene disposal.
