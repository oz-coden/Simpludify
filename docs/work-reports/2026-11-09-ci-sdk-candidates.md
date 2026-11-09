# SDK candidate CI and registry acceptance

Baseline `main` was `280219894102c7401ee22a887a90a7c0db462d68`. The [baseline CI](https://github.com/oz-coden/Simpludify/actions/runs/42314428597) completed in 10m 34s with 20 validation jobs and Pages deployment.

The baseline package job exercised freshly packed SDKs. The starter ran the published v0.1.3 SDK, and each Run To Exit matrix cell installed v0.1.3 before swapping in candidate archives. The Linux starter spent 479 seconds in Playwright setup, including 461 seconds downloading 21.1 MB of Ubuntu font packages. Two Windows jobs spent 194 and 200 seconds in Playwright setup. A [published-site failure](https://github.com/oz-coden/Simpludify/actions/runs/42230226993/job/127940133873) recorded an Aim-direction assertion immediately after two touches were moved by a single CDP command.

The redesigned CI passes a single archive pair to independent package, starter and Run To Exit fixtures. Windows and Linux each exercise installed package contents and the starter. Run To Exit typechecking, unit tests and its production build run once before browser tests consume the same build. Registry verification is separately callable with a published version and validates the SDK with fresh npm caches. Chromium uses the runner's installed libraries when the pinned browser can launch. Published acceptance waits for pointer-event delivery and verifies which site revision is served.


## Coverage and execution model

| Check                          | Baseline                                                   | Redesigned                                                                                                       |
| ------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Archive builds per complete CI | 8 pairs across package and external consumer jobs          | 1 pair, checked by SHA512 in consumers                                                                           |
| Package and starter checks     | 4 jobs on Linux and Windows, starter used published v0.1.3 | 2 jobs on the same systems, both use candidate bytes                                                             |
| Run To Exit                    | 6 jobs each reinstall, typecheck, run units and build      | 1 isolated production build, 4 Playwright jobs covering all 6 original projects                                  |
| Tooling boundary checks        | 2 extra jobs                                               | Linux covered by quality units, Windows covered by the Windows package job, including native package compilation |
| Site                           | Both bases, Pages and live E2E                             | Both bases retained, separate Pages and live E2E jobs with a source-revision check                               |
| Totals on main push            | 20 validation jobs plus one deploy job                     | 18 validation jobs plus deploy and live E2E                                                                      |
| Chromium setup on main push    | 18 installs with OS dependency setup                       | 16 setups, Linux installs system libraries only when Chromium reports they are missing                           |

The Web-only package fixture verifies real npm transitive Core resolution via a scoped loopback registry. Core-only verifies a Node import without Web or PixiJS. The package checks also cover source maps, archive allowlists, CSS and public declarations, then run development and production browser flows at three viewport sizes. The starter checks type safety, production subpath and notices, including the missing-license failure path. Its distribution pins published v0.1.6 with npm's original integrity values. The temporary starter and Run To Exit locks point to the candidate files and verify the installed package origin, integrity, version and physical directory. The original lockfiles are preserved. Run To Exit verifies labels, UI, touch and both renderers on the same production build.

The publish workflow passes its validated source revision and version to the read-only registry workflow after both packages are visible. Registry package and starter checks each start with an empty npm cache. The publish workflow's archive and integrity gates remain in place. The standalone acceptance workflow can be run for a published version from its matching source ref.

Desktop browser coverage is spread over four runners, with two retained for narrow viewports. The two-shard checkpoint recorded desktop test times of 9m 24s and 9m 54s. The first main run used three desktop shards, and the slowest job still took 9m 41s. Grouping its measured per-file test times by the four-shard split reduced the projected largest group from about 560s to 394s. The Playwright lists confirm that all 224 desktop cases are assigned exactly once. All shards retain one foreground worker.

The baseline took 10m 34s elapsed and 68m 25s summed job runtime, including 18m 41s summed Chromium setup. Standard Linux setups took 15–20 seconds. The 479-second Linux outlier fetched optional browser OS dependencies through the Ubuntu mirror. The Windows logs put the long setup inside Playwright's browser download step. CI now probes the pinned headless shell on the hosted image, falls back to Playwright's OS installer for missing shared libraries, and uses a versioned Chromium download cache on Windows. npm reuses downloaded content keyed by lockfiles and prefers cached content. The prior common cache key used only the workspace lock. The package job now also keys on the starter lock, and the consumer build and E2E jobs key on the same pinned toolchain lock. CI still performs locked installations on the target OS.

The failed live run sampled actions immediately after asking Chromium to swap both contacts in one CDP command. The log records the failing Aim direction. The revised driver gives contacts distinct positions during the crossing and waits for each real pointer event before sampling. The test still verifies the original IDs, opposing directions, a third touch, cancellation, input handoff and scene cleanup. Playwright retries are disabled for the external candidate matrix. Superseded first attempts can cancel, reruns have separate concurrency groups, and failed jobs can reuse candidate artifacts from their run. Pages deployment checks the head of main. Live acceptance checks the deployed revision and can be rerun independently.

## npm download attribution

npm's [download API](https://github.com/npm/registry/blob/main/docs/download-counts.md) aggregates by UTC day. npm describes a download as a successful tarball response, including automated clients. A lockfile, metadata query, cache hit, local file read or loopback registry request does not by itself add a public tarball response. A clean install of the baseline Run To Exit lock logged one public v0.1.3 tarball response per package. A second install with the same cache and `--prefer-offline` logged none. The two new clean public acceptance commands together logged two v0.1.6 tarball responses per package. Candidate starter and isolated Run To Exit installs logged no public SDK tarball requests.

| UTC date   |  Core |   Web | Simpludify CI runs created |
| ---------- | ----: | ----: | -------------------------: |
| 2026-11-02 |   474 |   418 |                         48 |
| 2026-11-03 |   420 |   413 |                         30 |
| 2026-11-04 |   343 |   317 |                         19 |
| 2026-11-05 |   232 |   243 |                          5 |
| 2026-11-06 |   189 |   187 |                         22 |
| 2026-11-07 |    33 |    25 |                          0 |
| 2026-11-08 |    18 |     8 |                          0 |
| Total      | 1,709 | 1,611 |                        124 |

Sources are npm's [Core daily range](https://api.npmjs.org/downloads/range/2026-11-02:2026-11-08/@simpludify/core), [Web daily range](https://api.npmjs.org/downloads/range/2026-11-02:2026-11-08/@simpludify/web) and the [Actions workflow runs API](https://api.github.com/repos/oz-coden/Simpludify/actions/workflows/ci.yml/runs?created=2026-11-02..2026-11-08&per_page=100). npm's version breakdown for the same completed week recorded 796 Core and 771 Web downloads for v0.1.3. The v0.1.6 counts were 167 Core and 168 Web.

| Path                                                 | Expected public SDK tarball responses per cold successful run, Core / Web                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Baseline package, quality, browser, builds and Pages | 0 / 0. Workspace installs or candidate tarballs and loopback                                                                      |
| Baseline starters                                    | 2 / 2. One registry-locked pair per OS                                                                                            |
| Baseline Run To Exit matrix                          | 6 / 6. One initial v0.1.3 pair per matrix job before the candidate swap                                                           |
| Redesigned regular CI                                | 0 / 0. Scope lookup is confined to local files or loopback                                                                        |
| Redesigned public acceptance                         | About 2 / 2. One pair for the package fixture with its own shared cold cache, one pair for the starter with a separate cold cache |

Of 124 historical runs, 65 were cancelled, 11 failed and 48 succeeded. The committed configuration was available for 122 runs. Of those, 47 had two starter jobs and 75 also had the six-cell consumer matrix. Running every configured install once with cold caches gives 694 modeled downloads per package. That includes 614 v0.1.3 opportunities. The successful runs with known configuration account for 266 cold-cache opportunities. These are configuration-based scenarios, with no attribution to any individual request. Seven additional attempts are visible in Actions. They can repeat some jobs, while cancellations, warm caches and runner failures can prevent downloads. A failed request may be retried, and only successful tarball responses count. Some early starters pinned v0.1.1 or v0.1.2. This model excludes release workflows, Run To Exit's own CI, developer installs, mirrors and bots. The separate Run To Exit repository had 38 runs in the interval, including 11 that defined six v0.1.3 installs each. Those 66 additional first-attempt opportunities are also a cold-cache scenario. The daily totals and version breakdown therefore cannot identify either unique users or actual CI share.

## Verification

The [first branch checkpoint](https://github.com/oz-coden/Simpludify/actions/runs/42627446535) validates the pipeline before main integration. Locally, the architecture, types, Biome and license checks passed along with 891 Simpludify unit tests and 35 Run To Exit unit tests. The external application passed typechecking and production build using candidate archives. The consumer archive was extracted to a different directory and successfully reinstalled from its portable lock. Both public-registry acceptance commands passed locally for v0.1.6, including six package browser combinations and the starter. The revised virtual-input script passed eight local site runs with four renderer/viewport combinations each. Local browser checks used the same Chrome Headless Shell revision as Playwright 1.64.1. Biome formatting for changed documentation and actionlint passed. Eight baseline runs also passed locally, so the historical Aim failure could not be reproduced under local conditions. A [later checkpoint](https://github.com/oz-coden/Simpludify/actions/runs/42628654078) exposed that setup-node could not hash the fixture lock outside the repository. The browser jobs now stage a cache-key copy inside the repository while installing and running the application in the isolated directory.

The [first main CI with the isolated consumer fix](https://github.com/oz-coden/Simpludify/actions/runs/42629162478) validated commit `c9339d7ad3a5086e355aaf4e3739b516fed80ef3`. All 17 pre-deployment jobs passed with the three-way desktop split. The jobs spent 1m 23s in Chromium setup before deployment. For context, three successful first attempts using the same baseline workflow file took 10m 34s, 19m 57s and 26m 14s end to end. The single-run comparisons below include the queue, runner performance and Pages time.

The [four-shard branch checkpoint](https://github.com/oz-coden/Simpludify/actions/runs/42631152122/job/129207483063) exposed a related race in the Canvas UI simultaneous-touch test. The test read the hold log immediately after CDP cancellation and sometimes saw only the hold event. It now waits for the application's pointer capture counts to transition through 2, 1 and 0 before checking the existing hold and keyboard assertions.

### Main results

The [final main CI](https://github.com/oz-coden/Simpludify/actions/runs/42632553592) passed on `0607ffb2718f022cb2f2ee08e8855cd173943254`. All 18 validation jobs, Pages deployment and the [published E2E job](https://github.com/oz-coden/Simpludify/actions/runs/42632553592/job/129217368315) passed. The site served the tested revision before and after the six published acceptance scripts. GitHub CI passed 891 Simpludify unit tests and 448 browser tests, the Windows and Linux package/starter suites, production smoke builds, both site bases and the Run To Exit suite with 35 unit tests and 66 browser tests. The revised Canvas UI touch test also passed 32 local repetitions across viewport and renderer combinations with retries disabled. The registry acceptance results above come from running the two public-registry commands locally for v0.1.6.

| Measurement                          | Baseline CI with two desktop shards | Three-shard main checkpoint | Final main CI |
| ------------------------------------ | ----------------------------------- | --------------------------- | ------------- |
| Validation jobs before Pages         | 20                                  | 17                          | 18            |
| Elapsed through published acceptance | 10m 34s                             | 16m 00s                     | 12m 07s       |
| Elapsed through last validation job  | 8m 41s                              | 10m 04s                     | 7m 33s        |
| Summed job time                      | 68m 25s                             | 59m 29s                     | 58m 41s       |
| Summed Chromium setup                | 18m 41s                             | 1m 29s                      | 1m 31s        |
| Pages deploy action                  | 6s                                  | 3m 21s                      | 1m 20s        |

The longest final desktop job took 7m 12s, compared with 9m 41s on the three-shard main checkpoint. The workflow times reflect runner and Pages variability. The apt fallback and first download after a Playwright version change can still add setup time. Run To Exit stays pinned for reproducibility, so an intentional API break can require updating the fixture and its pinned source before integration.

The [same-commit branch run](https://github.com/oz-coden/Simpludify/actions/runs/42632464181/job/129211958428) had one intermittent desktop Canvas2D tilemap timeout. The [trace](https://github.com/oz-coden/Simpludify/actions/runs/42632464181/artifacts/13681737700) showed one camera poll taking 3.1 seconds inside a 5-second assertion window. The page snapshot showed the explorer at the stone wall with game focus. The case passed on main and in eight local repetitions with retries disabled. The cause of the intermittent camera observation remains open and its assertion is retained.

Implementation entry points include the CI, publish and registry workflows in `.github/workflows/`, the Chromium setup action, the SDK consumer scripts under `scripts/`, the Canvas UI browser spec and `templates/npm-vite/`. The English and Japanese roadmaps, publishing guides and SDK consumer guides describe the two verification paths.
