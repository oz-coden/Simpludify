# npm SDK documentation review — 2026-11-02

Baseline: main `536118ea1b5a5fccae216ddbb198e5ac47f734c0`; PR #7 head `6da3ca5e649c5c1a4c8d9828660e142d59e8b1e3`.

Reviewed the six changed documentation files against the SDK exports and Run To Exit's `docs/engine-review.md`. The viewport is host-local CSS pixels; UI bounds require multiplication by `CanvasUI.scale` when it differs from one. `Tween.property` supports the plain progress record shown in the sketch. Simulation `onUpdate` stops while paused, which the sketch explicitly calls out. Published npm archives remain immutable; corrected package READMEs take effect in a later release.

The original head failed the repository formatter on two Markdown files. Applied only the required formatting corrections. Runtime API changes and executable integration examples belong to a separate implementation PR.

Validation checkpoint: `npm ci` succeeded. The initial `npm run check` failed solely on those two formatter errors. Revalidation and CI are pending at this checkpoint; do not merge until CI succeeds.

Completion: corrected head `fc148e660cd44ae3373e5654f1380dbeae8ef9f3` passed local check and all CI jobs ([run 41342668958](https://github.com/oz-coden/Simpludify/actions/runs/41342668958)). PR #7 merged as `315efb7c83cf9ffa707558322f69d4c74e078ef9`. The runtime work is separate in PR #8.
