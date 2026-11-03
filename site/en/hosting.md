# Builds, hosting and transport

Build a repository example with npm run build -- --target web --example character --base /my-game/. Output is dist. Independent SDK applications use their own Vite build. Serve generated HTML/JS/CSS/assets through HTTP(S); file:// is not the supported Web module deployment path.

## Documentation site

```sh
npm ci
npm run site:build -- --base /Simpludify/
npm run site:check
npm run site:serve
```

The site emits paired Japanese/English documentation, shared assets, independent play/example-id games and license/dependency notices in site-dist. SITE_BASE or --base chooses a safe absolute slash-terminated path; / hosts at a custom-domain root. Test both / and /Simpludify/. Only .site-build and site-dist are replaced; the example CLI dist is separate.

Vite builds static documents/examples and markdown-it converts trusted repository Markdown at build time. There is no runtime Markdown service or mandatory application UI framework. site/config.mjs defines routes, language counterparts, audiences and samples. Relative document links are rewritten; link/anchor and code-example checks remain part of validation. Internal reports/measurements are separated from current user guides.

## Pages and custom hosting

.github/workflows/ci.yml checks types/static validation, units, browser renderers, production examples, both documentation bases, Windows/Linux package/starter consumers and the external game candidate. Main push deploys the project site only after required jobs succeed, then runs live published-site fixtures. Ordinary validation has contents:read; only deployment receives pages:write/id-token:write. An administrator must enable Pages; workflows do not change repository visibility, DNS or custom-domain settings.

The configured public site is https://github.oz-coden.com/Simpludify/ . The github.io project URL may redirect. Output also works on other static hosts with the correct base. Configure DNS/domain/certificates separately and rebuild for the actual path; tooling does not silently add CNAME or mutate DNS.

Static delivery requires an HTTP server, but the standalone games need no game API, AI service or authentication after loading. A static client can contact a service if the application adds one; that does not imply engine networking support. No Service Worker/offline installation, server protocol, P2P or dedicated-server authority is implemented. Transport, simulation location and authority remain separate application design decisions.
