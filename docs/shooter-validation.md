# Triangle and Prism Raid validation

## Implementation checkpoint

Baseline: `bacdf9e4d34431704bafcce05029f0cca2657ada`.

Triangle is implemented as an upward-pointing isosceles Graphics polygon, using the bounding-box center as pivot. Core only adds the Shape value; Collider geometry and Solid response are unchanged. Local strict checks, all 153 unit tests and four Triangle browser cases passed on Chrome 156.0.8078.4 at desktop/narrow widths. The pixel/resource cases exercise both WebGL/SwiftShader and forced Canvas2D, including rotation/scales, opacity/depth/visibility, existing shapes and disposal.

Prism Raid game logic, controls, stress measurements and published-site validation are not yet complete at this checkpoint. This document will record their completed evidence and API review rather than treating planned checks as passed.

## Headless logic checkpoint

Prism Raid now has three finite waves, twin player shots, three enemy patterns, aimed enemy fire, five HP, one-second collision invulnerability, escape penalties, score, win/loss and seeded read-only inspection. The model imports only public Core exports. Seventeen targeted unit tests pass, including input-only wins for seeds 1/42/2026, identical trace replay, 100,000 accelerated steps, 100-enemy/1,000-projectile stress, simultaneous contact consumption and survivor Exit behavior. Controlled fast-projectile fixtures demonstrate discrete tunneling and bounded-substep mitigation; this does not claim CCD support.

Browser presentation/input, published integration and quantitative performance/memory measurements remain pending.
