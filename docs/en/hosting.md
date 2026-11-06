# Builds, hosting and transport

Simpludify distinguishes single-game application builds from the full official documentation and example site. The game simulation runs independently of hosting infrastructure and external cloud services.

## Building the integrated documentation site

```sh
npm ci
npm run site:build -- --base /Simpludify/
npm run site:check
npm run site:serve
```

`site-dist/` receives paired Japanese and English documentation, shared CSS and JavaScript assets, standalone runnable sample games (`play/character/`, `play/ui-scenes/`, `play/composition/`, `play/signal-run/`, etc.), and third-party license notices. Open the printed local URL with `/Simpludify/`.

Use the `SITE_BASE` environment variable or `--base` argument to configure the path. The default is `/Simpludify/`; use `/` for a custom domain root. The path must be absolute and terminate in `/`:

```sh
npm run site:build -- --base /
```

Output is purely static files deployable to any HTTP(S) host. The generator cleans and regenerates only `.site-build/` and `site-dist/`; the example CLI `dist/` is separate. Always serve over HTTP(S), not `file://`.

## Technology choices and site generator

The site generator uses Vite to build static pages and compiled sample bundles, converting Markdown into HTML using markdown-it at build time. No runtime Markdown parser, Vue, React, or heavy client-side documentation framework is shipped. Pages and sample metadata are defined in `scripts/site-config.mjs`, with source documents residing under `docs/ja/` and `docs/en/`. Relative links between documents are rewritten to site routes at build time, while links to repository files outside the site link out to GitHub.

## GitHub Pages deployment

`.github/workflows/ci.yml` runs typechecking, unit tests, production example builds, link and asset checks, and browser integration fixtures across desktop and mobile viewports. On pushes to `main`, successful runs trigger the deployment job.

GitHub Pages uses the **GitHub Actions** deployment source. Only the deployment job requests `pages: write` and `id-token: write` permissions; standard validation jobs retain read-only repository access (`contents: read`).

The public documentation site is published at `https://github.oz-coden.com/Simpludify/`. An administrator must explicitly enable Pages in repository settings; automated workflows do not configure DNS or enable public visibility automatically.

## Concepts: static delivery vs networking

| Concept                 | Meaning in Simpludify                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Static delivery         | Serving HTML, JS, CSS, and asset files. An HTTP server is required for delivery.         |
| Standalone offline play | Once loaded, the game requires no API, authentication, database, or external game server |
| Online communication    | Client code can connect to external WebSockets/REST APIs; engine networking is optional  |
| Dedicated game server   | An architectural choice for multiplayer; not mandated by the core runtime                |

No Service Worker or P2P networking is bundled in the default engine. The absence of external service dependencies means standalone games run locally in the browser once downloaded.
