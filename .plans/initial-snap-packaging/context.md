# Planning context: initial-snap-packaging

## Goal
Create the initial snap packaging for pi-coding-agent, modeled after opencode-snap.

## Decisions made

### Build approach
- **Bun compiled binary** (Option A) — reuse pi's existing `build:binary` npm script
- Snap parts: Node.js + Bun + pi-source → binary + assets
- No Node.js runtime in the snap (standalone binary)

### Build tools
- **Bun v1.3.14** — same version opencode-snap and pi's own CI use
- **Node.js 22.x** — downloaded as prebuilt binary from nodejs.org (pi requires ≥22.19.0)
- Both needed: Node.js for npm workspace + TypeScript (tsgo), Bun for final `bun build --compile`

### WASM support
- **Include** `photon_rs_bg.wasm` for full image processing
- Graceful degradation if absent, but we bundle it (~4 MB)

### Snap base
- **core26** (Ubuntu 26.04 LTS)

### Confinement
- **Classic** — pi needs unrestricted filesystem access

### Wrapper pattern
- Same as opencode: unset all `SNAP_*` env vars before exec

### Clipboard
- **Both** the native binding AND wl-clipboard:
  - `@mariozechner/clipboard-linux-$ARCH-gnu` (X11 image reading)
  - `wl-clipboard` from source (Wayland clipboard — pi explicitly skips native addon on Linux for text, and doesn't try it on Wayland for images)
  - Pi's clipboard priority on Wayland: `wl-paste` → `xclip`
  - Pi's clipboard priority on X11: native addon → `xclip`
  - Matches opencode's approach of bundling wl-clipboard

### Version updates
- **Renovate** with custom regex managers (same as opencode):
  - Match `source-tag: v<version>` in snapcraft.yaml → update pi version
  - Match expected version in smoke test task.yaml
  - Match Bun download URL in snapcraft.yaml → update Bun version
- No cron job needed — Renovate polls and creates PRs

### Upstream pi version
- Pin to a specific release tag (e.g., v0.80.6) in `source-tag`

## Key references
- Upstream pi: https://github.com/earendil-works/pi
- opencode-snap (template): https://github.com/canonical/opencode-snap
- opencode renovate.json: custom regex managers for version updates
- Pi docs/containerization.md — patterns for isolation
- pi `build:binary` script in `packages/coding-agent/package.json`
- pi `scripts/build-binaries.sh` — full binary build pipeline
- pi `src/utils/clipboard.ts` — text clipboard (skips native addon on Linux, uses wl-copy/xclip/xsel)
- pi `src/utils/clipboard-native.ts` — native binding loader (X11-only)
- pi `src/utils/clipboard-image.ts` — image clipboard (wl-paste on Wayland, native on X11)
- pi `src/utils/photon.ts` — WASM loading (graceful fallback)

## Files to create
1. `snap/snapcraft.yaml` — core build definition
2. `snap/local/pi.wrapper` — wrapper script
3. `snap/local/pi.completion` — bash completion
4. `AGENTS.md` — agent instructions
5. `.github/workflows/snapcraft-pack.yml` — reusable build workflow
6. `.github/workflows/build.yml` — CI entry point
7. `.github/workflows/release.yml` — release workflow
8. `.github/workflows/snapcraft-promote.yml` — promotion
9. `.github/workflows/snapcraft-upload.yml` — store upload
10. `.github/actions/install-cached-snap/action.yaml` + `action.sh` — caching
11. `tests/smoke/pi/task.yaml` — smoke test
12. `spread.yaml` — spread test config
13. `renovate.json` — dependency update config (custom regex managers)
14. `publishing/README.md` — publishing docs
15. Update `README.md` with final approach
