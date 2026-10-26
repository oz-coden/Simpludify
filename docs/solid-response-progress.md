# Solid response implementation checkpoint

Base: main at `3f3d935`. Work branch: `codex/solid-response`.

- Implemented: Trigger/Solid response policy, separate static/dynamic CollisionBody, circle/OBB minimum translation geometry, inverse-mass position correction, bounded deterministic iterations, contact queries and post-response events.
- Validated: existing unit suite plus response geometry, filtering, ownership, removal, failure recovery, repeated corner pressure, determinism and discrete tunneling limitations. Run `npm test` and `npm run check`.
- Pending: Signal Run walls, camera follow, browser/production validation, isolated frame profiling, longer memory sampling, final API/architecture/performance documentation.
- The solver corrects positions only. It has no angular response, impulses, friction or continuous collision detection. Body-less Solid colliders are fixed; existing Collider defaults remain Trigger.
