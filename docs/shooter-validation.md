# Triangle and Prism Raid validation

## Implementation checkpoint

Baseline: `bacdf9e4d34431704bafcce05029f0cca2657ada`.

Triangle is implemented as an upward-pointing isosceles Graphics polygon, using the bounding-box center as pivot. Core only adds the Shape value; Collider geometry and Solid response are unchanged. Local strict checks, all 153 unit tests and four Triangle browser cases passed on Chrome 156.0.8078.4 at desktop/narrow widths. The pixel/resource cases exercise both WebGL/SwiftShader and forced Canvas2D, including rotation/scales, opacity/depth/visibility, existing shapes and disposal.

Prism Raid game logic, controls, stress measurements and published-site validation are not yet complete at this checkpoint. This document will record their completed evidence and API review rather than treating planned checks as passed.
