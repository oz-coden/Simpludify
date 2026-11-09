# SDK candidate CI and registry acceptance

Baseline `main` was `280219894102c7401ee22a887a90a7c0db462d68`. The [baseline CI](https://github.com/oz-coden/Simpludify/actions/runs/42314428597) completed in 10m 34s with 20 validation jobs and Pages deployment.

The baseline package job exercised freshly packed SDKs. The starter ran the published v0.1.3 SDK, and each Run To Exit matrix cell installed v0.1.3 before swapping in candidate archives. The Linux starter spent 479 seconds in Playwright setup, including 461 seconds downloading 21.1 MB of Ubuntu font packages. Two Windows jobs spent 194 and 200 seconds in Playwright setup. A [published-site failure](https://github.com/oz-coden/Simpludify/actions/runs/42230226993/job/127940133873) recorded an Aim-direction assertion immediately after two touches were moved by a single CDP command.

The redesigned CI passes a single archive pair to independent package, starter and Run To Exit fixtures. Windows and Linux each exercise installed package contents and the starter. Run To Exit typechecking, unit tests and its production build run once before browser tests consume the same build. Registry verification is separately callable with a published version and validates the SDK with fresh npm caches. Chromium uses the runner's installed libraries when the pinned browser can launch. Published acceptance waits for pointer-event delivery and verifies which site revision is served.

Validation and download attribution are pending at this checkpoint.
