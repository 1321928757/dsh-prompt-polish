# Changelog

## [0.4.0] - 2026-10-12

### Breaking
- **DSH 0.2.0-rc.2+ required; DSH 0.1.x is no longer supported.** Host and browser-side Typert strict codecs now use the DSH 0.2 `create()` factory contract.

### Changed
- Declare DSH and Node.js runtime compatibility ranges and align DSH peer dependencies with the 0.2.0-rc.2 runtime.
- Add Host and Client Typert contract coverage, including a regression check for the rejected schema-only codec form and slot contract checks.
- Add isolated DSH 0.2 Headless and Web acceptance coverage.

### Migration
- On DSH 0.1.x, remain on plugin 0.3.2.
- On DSH 0.2.0-rc.2 or newer below 0.3.0, install plugin 0.4.0 with `dsh plugin --profile <profile> add ...` to reconcile bundle membership, then fully restart that DSH Web profile.
