# Collision review and Tilemap integration

Status: design review complete; formal Tilemap collision remains the next implementation stage. This branch does **not** implement Tilemap collision as a supported engine feature.

Base: `codex/working-tilemap` at `77479d59b58f26aadc4e89f773d90b9b5ba1752b`.
Work branch: `codex/working-collision-design`. Main, Sprite and Tilemap refs were checked before work; none is a write target.

## Source inventory

- `packages/core/src/collider.ts`: one immutable box/circle geometry, Trigger/Solid policy and bidirectional 32-bit filters per Actor. Transform required; Renderable not required.
- `collision-body.ts`: passive static/dynamic inverse-mass correction weight; neither velocity nor movement integration. Body absent/disabled/static means zero weight.
- `collision-geometry.ts`: transformed circle/OBB geometry and circle-circle, closest-point box-circle, four-axis SAT box-box manifolds. Signed scale reflects offsets; boxes use absolute extents; nonuniform absolute circle scaling rejects; zero scale excludes.
- `collision-response.ts`: inverse-mass weighted positional translation, overflow validation before writes, preserving Motion intent and tangent displacement.
- `collision.ts`: optional Scene-owned CollisionWorld, structural-revision reconciliation, X sweep/Y/filter rejection, bounded iterative response, final Trigger detection, persistent pair table and ordered contact delivery.
- `scene.ts`, `actor.ts`, `component.ts`, `events.ts`: captured update plans; synchronous removal/disable; reverse/idempotent cleanup; synchronous ordered handlers with aggregate errors.
- `tilemap.ts`: copied finite Grid, one internal Actor/passive TilemapLayer; no Collider, Transform or per-cell Actor. Rendering and collision visibility must remain independent.
- `tests/unit/collision.test.ts`, `response.test.ts`: geometry, policy, mass, movement ordering, lifecycle, reentry, error recovery, sliding/corners, discrete tunneling and determinism.
- `tests/browser/signal-run.spec.ts`: real game's Actor contacts/response, restart and cleanup. Existing Tilemap fixtures test rendering/lifetime only, **not** terrain collision.

## Contracts to preserve

The world is opt-in (`new CollisionWorld(scene)`), including in Web: Game does not silently install it. One world per Scene; it registers a post-update hook. Update order is Input → Update → Integrate → LateUpdate → post-update hooks (registration order, collision here) → timers → Scene callbacks. Actor/component updates added during a step wait until the next step; a Collider added before collision capture can already collide in the current pass.

Both policies must be Solid for correction. Trigger/Trigger and Trigger/Solid only detect. Dynamic bodies share translation inversely to mass; static/static still report overlap. Default budget is six iterations (1..32 allowed); tolerance is `1e-7` world units. No response scans without an eligible movable Solid. Each iteration recaptures geometry after changes, allowing subsequent iterations to find overlaps caused by earlier corrections. The last scan samples Triggers at corrected positions. Solids encountered during solving remain observed for that pass even if later separated. Detection, correction and notification are conceptually distinct; only CollisionWorld orchestrates their order.

Pairs use discovery serials, **not** Actor string IDs, X sort order or renderer IDs. Each notified side gets Enter once, then Stay on later observed passes. Absent/invalid pairs get Exit on the next collision pass. Disabled surviving colliders receive Exit; disposed colliders do not. Removal/disable suppresses later Enter/Stay for invalid pairs immediately. A side suppressed before its first Enter never gets an unmatched Exit. Scene/world disposal clears silently, stops delivery and releases hooks. Callback geometry/addition edits apply next pass. Errors aggregate after eligible notifications; correction is not rolled back. Recursive stepping rejects.

Normal points from self toward other at detection; depth is the largest manifold recorded by scans that pass; resolved means this pair performed at least one translation, **not** a convergence guarantee. Exit retains the last observation. Scalar payloads are reused; contactsFor allocates scalar copies with live Actor/Collider references. Current payloads contain no corrected-position snapshot: callbacks read live Transform, and an earlier callback can already have changed it.

Camera, visible tiles, Viewport and texture readiness have no collision role. No local frame, input, rendering or Tilemap event creates collision automatically.

## Risks requiring explicit decisions

- Contact hard-codes other Collider/Actor. A tile cannot safely satisfy it. A typed target migration is required before shared events can represent terrain.
- X sweep is quadratic for dense or vertically aligned populations; candidate diagnostics include repeated solver scans. Triggers can also create quadratic persistent pairs.
- Per-cell walls have seams and deep embeddings can conflict; direct lookup does not prove response quality. An isolated response probe and acceptance gates are required.
- Tilemap image revision alone cannot represent collision policy changes. Need independent policy state and per-pass sampling, no whole-map rebuild on set.
- Finite iteration budgets and endpoint-only geometry do not guarantee depenetration, CCD, stable stacks, moving platforms, friction or restitution.
- A failed geometry pass can retain previous tracked pairs in diagnostics while contactsFor filters by current pass; this is not transactional rollback.

No confirmed local runtime defect requiring a solver patch was found in the reviewed paths. The findings are scalability/observation limits and missing terrain contracts, rather than evidence that the existing Actor system should be replaced. The linked tests document boundaries that were previously implicit or lightly tested.

## Executable evidence

24 new focused tests pass: twelve current Actor contract cases, four candidate-search cases, five policy/identity cases, three naive response probes. Strict TypeScript passes with positive/negative proposed API examples. These probes are under `tests/prototypes`, not exported or installed into Scenes.

The naive shared circle/box narrow phase + per-cell correction probe **reproduces seam-induced circle tangent displacement** and unresolved deep embedding. This is a formal implementation acceptance gate, not a fixed production defect: current Tilemap does not yet have collision. A normal single cell separates correctly. Candidate strategy equality alone must not be mistaken for solver correctness.

The only production changes relax _internal parameter types_: narrow phase accepts shape/geometry without Actor/Transform ownership, and correction accepts x/y positions. Function bodies and existing Actor behavior are unchanged. No tile Actor, Collider instance, Scene hook, public collision API or runtime dependency is introduced.

`tests/prototypes/collision-api.ts` is a declaration-only API sketch; `tests/types/collision-proposal.ts` checks inferred names, explicit policies and target narrowing. The preferred shape is one existing Contact event family with `other.kind` and a deliberate source migration, rather than pretending a tile is an Actor or installing duplicate physics worlds. The contract document lists migration sites and alternatives. Native TypeScript completion checks also verify proposed tile names and target-specific fields.

All 216 search runs and their 4320 measured per-pass samples are retained with environment/source provenance. The benchmark report separates search/index costs from unmeasured production terrain solver/event costs. An additional integrity test validates every stored run and percentile summary. Final regression totals are 391 unit tests and 166 browser tests; see validation.md for exact scope.

## Review deliverables

- [Tilemap API, ownership, target migration and event contract](tilemap-contract.md)
- [216 search measurements, current Actor sweep costs, response counterexamples and algorithm recommendation](performance.md)
- [Next formal implementation scope, changed files, tests, acceptance gates and open hypotheses](implementation-plan.md)
- [Validation, browser environment and recovery checkpoints](validation.md)

The recommendation is direct local lookup with shared CollisionWorld orchestration and stable per-cell identity. A naive per-cell solver is **not** approved for release: seam response remains a concrete implementation gate. The proposed target union is a deliberate future source migration; this review branch keeps the existing Contact API unchanged.

## Clarifications, not silent behavior changes

- Existing API documentation already separates Collider policy, Body correction weight and Motion intent. Keep that separation; no new body class or generic manager is needed.
- "Stable order" means Collider discovery serial, not Actor creation order: a Collider attached later is discovered later. New tests exercise this difference.
- "After correction" describes the notification phase. It does not make live Transform reads immutable across callbacks. The proposed position values address this ambiguity without changing current callback semantics here.
- "Resolved" means this pair translated a body. An impossible gap can still have unresolved contacts; a new test records that distinction.
- Geometry failures are nontransactional: a tracked pair count may survive while contactsFor filters by the new failed pass. Recovery is tested; adding transactional rollback is outside scope.

[Implementation acceptance gates](implementation-plan.md) distinguish chosen contracts from unverified response/topology and allocation hypotheses. There is no claim that all edge cases of the existing solver or the future integration have been exhaustively proven.
