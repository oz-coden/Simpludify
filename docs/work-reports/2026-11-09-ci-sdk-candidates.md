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
| Totals on main push            | 20 validation jobs plus one deploy job                     | 16 validation jobs plus deploy and live E2E                                                                      |
| Chromium setup on main push    | 18 installs with OS dependency setup                       | 14 setups, Linux installs system libraries only when Chromium reports they are missing                           |

The Web-only package fixture verifies real npm transitive Core resolution via a scoped loopback registry. Core-only verifies a Node import without Web or PixiJS. The package checks also cover source maps, archive allowlists, CSS and public declarations, then run development and production browser flows at three viewport sizes. The starter checks type safety, production subpath and notices, including the missing-license failure path. Its distribution pins published v0.1.6 with npm's original integrity values. The temporary starter and Run To Exit locks point to the candidate files and verify the installed package origin, integrity, version and physical directory. The original lockfiles are preserved. Run To Exit verifies labels, UI, touch and both renderers on the same production build.

The publish workflow passes its validated source revision and version to the read-only registry workflow after both packages are visible. Registry package and starter checks each start with an empty npm cache. The publish workflow's archive and integrity gates remain in place. The standalone acceptance workflow can be run for a published version from its matching source ref.

The baseline took 10m 34s elapsed and 68m 25s summed job runtime, including 18m 41s summed Chromium setup. Standard Linux setups took 15–20 seconds. The 479-second Linux outlier fetched optional browser OS dependencies through the Ubuntu mirror. The Windows logs put the long setup inside Playwright's browser download step. CI now probes the pinned headless shell on the hosted image, falls back to Playwright's OS installer for missing shared libraries, and uses a versioned Chromium download cache on Windows. npm reuses downloaded content keyed by lockfiles and prefers cached content. It still performs locked installations on the target OS.

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

Of 124 historical runs, 65 were cancelled, 11 failed and 48 succeeded. The committed configuration was available for 122 runs. Of those, 47 had two starter jobs and 75 also had the six-cell consumer matrix. Running every configured install once with cold caches gives 694 modeled downloads per package. That includes 614 v0.1.3 opportunities. The successful runs with known configuration account for 266 cold-cache opportunities. These are configuration-based scenarios, with no attribution to any individual request. Seven additional attempts are visible in Actions. They can repeat some jobs, while cancellations, warm caches and runner failures can prevent downloads. A failed request may be retried, and only successful tarball responses count. Some early starters pinned v0.1.1 or v0.1.2. This model excludes release workflows, Run To Exit's own CI, developer installs, mirrors and bots. The daily totals and version breakdown therefore cannot identify either unique users or actual CI share.

## Verification

The [first branch checkpoint](https://github.com/oz-coden/Simpludify/actions/runs/42627446535) validates the pipeline before main integration. Locally, the architecture, types, Biome and license checks passed along with 891 Simpludify unit tests and 35 Run To Exit unit tests. The external application passed typechecking and production build using candidate archives. The consumer archive was extracted to a different directory and successfully reinstalled from its portable lock. Both public-registry acceptance commands passed locally for v0.1.6, including six package browser combinations and the starter. The revised virtual-input script passed eight local site runs with four renderer/viewport combinations each. Local browser checks used the same Chrome Headless Shell revision as Playwright 1.64.1. Biome formatting for changed documentation and actionlint passed. Final CI, deployment and timing are recorded below after integration.
