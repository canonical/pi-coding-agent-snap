# pi-coding-agent-snap — Agent Rules

## Project overview

This repository builds a **classic snap** of the [pi coding agent](https://github.com/earendil-works/pi)
using Snapcraft. The snap is built inside an LXD container via GitHub Actions.

## Build process

The snap reuses pi's existing `build:binary` npm script rather than custom build steps:

1. Clone upstream pi at a pinned `source-tag` in `snap/snapcraft.yaml`
2. Install Node.js (prebuilt binary) + Bun (prebuilt binary) as build tools
3. `npm ci --ignore-scripts` at repo root
4. Install platform-specific clipboard native binding
5. `npm run build:binary` in `packages/coding-agent/` (builds 4 packages + bun compile)
6. Install binary + assets into `$SNAP/bin/` (matches pi's `getPackageDir()` resolution)
7. Install `wl-clipboard` via `stage-packages` from Ubuntu for Wayland clipboard support
8. Install wrapper script + bash completion

## Key files

| File | Purpose |
|---|---|
| `snap/snapcraft.yaml` | Snap build definition with 5 parts |
| `snap/local/pi.wrapper` | Wrapper that unsets `SNAP_*` env vars |
| `snap/local/pi.completion` | Bash completion for `pi` and `pi-coding-agent` |
| `renovate.json` | Custom regex managers for version updates |
| `spread.yaml` | Spread test backend config (image-garden adhoc backend) |
| `.image-garden.mk` | image-garden cloud-init user-data templates (core26) |
| `tests/smoke/pi/task.yaml` | Smoke tests |
| `.github/workflows/build.yml` | CI entry point; delegates to `tasteful-crafts.yml` |
| `.github/workflows/tasteful-crafts.yml` | Reusable build → spread → publish orchestrator |
| `.github/workflows/snapcraft-pack.yml` | Per-architecture snap build (reusable, uses LXD) |
| `.github/workflows/snapcraft-upload.yml` | Store upload (reusable) |
| `.github/workflows/snapcraft-promote.yml` | Channel promotion (`workflow_dispatch`) |
| `.github/workflows/spread.yml` | Reusable image-garden spread runner |
| `.github/workflows/release.yml` | Create Git tags + GitHub releases from Renovate PRs |
| `.github/actions/install-cached-snap/` | Composite action: install a snap with caching |
| `publishing/export-*-credentials.sh` | Export per-channel Snap Store credentials |
| `publishing/README.md` | Publishing docs (credentials, manual + CI flow) |
| `.gitignore` | Ignore build artifacts (`*.snap`, `*.comp`, `*.spread-reuse.yaml`) |

## Architecture

- **Base**: `core26` (Ubuntu 26.04 LTS)
- **Confinement**: `classic` (needs unrestricted filesystem access)
- **Platforms**: amd64, arm64
- **Binary**: standalone Bun-compiled executable (no Node.js needed at runtime)
- **CI pipeline**: `build.yml` → `tasteful-crafts.yml` orchestrates snap build
  (LXD), image-garden spread integration tests across Ubuntu/Debian cloud
  systems, and Snap Store upload to `latest/edge` (branch) or
  `latest/candidate` (tag); `latest/stable` is reached via manual
  `snapcraft-promote`.

## Version management

Upstream pi version is pinned via `source-tag` in `snap/snapcraft.yaml`.
Renovate auto-creates PRs when new upstream releases are detected.

Update the version by changing `source-tag` in `snap/snapcraft.yaml` AND
the expected version in `tests/smoke/pi/task.yaml`.

## Clipboard strategy

Pi needs both clipboard mechanisms:

- **`@mariozechner/clipboard-linux-$ARCH-gnu`** — native binding for X11 image reading
- **`wl-clipboard`** — `wl-copy`/`wl-paste` for Wayland clipboard (pi explicitly skips
  the native addon on Linux for text operations)

## License

MIT AND Apache-2.0. The bundled pi binary is MIT (upstream); the snap packaging files in this repository are Apache-2.0 (Canonical Ltd.).
