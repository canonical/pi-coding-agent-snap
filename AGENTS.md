# pi-coding-agent-snap — Agent Rules

## Project overview

This repository builds a **classic snap** of the [pi coding agent](https://github.com/earendil-works/pi)
using Snapcraft. The snap is built inside an LXD container via GitHub Actions.

## Build process

The snap builds pi from source with npm and bundles a real Node.js
runtime for execution:

1. Clone upstream pi at a pinned `source-tag` in `snap/snapcraft.yaml`
2. Install Node.js (prebuilt binary) as build tool; the same binary is
   staged into the snap as the runtime `node` executable
3. Fetch the matching `@earendil-works/pi-ai` npm tarball and copy its
   pre-generated `dist/providers/data` into `packages/ai/src/providers/data`
   (that directory is not committed to git — it is normally produced by a
   live network call — and using the published npm snapshot keeps the build
   deterministic and offline-safe)
4. `npm ci --ignore-scripts` at repo root
5. `npm run build:offline` (builds all workspace packages with pi's plain
   npm pipeline, reusing the model data staged in step 3)
6. `npm prune --omit=dev --ignore-scripts` so only production deps ship
7. Assemble the runtime payload into `$SNAP/lib/pi/`: pruned `node_modules/`
   plus `dist/` + `package.json` + `README.md` (and docs/examples/CHANGELOG
   for coding-agent) from the workspace packages pi-coding-agent needs
   (telemetry, ai, protocol, agent, tui, client, coding-agent)
8. Bundle the Node.js runtime executable into `$SNAP/node/bin/node`;
   `pi.wrapper` execs it against `packages/coding-agent/dist/cli.js`
9. Install `wl-clipboard` via `stage-packages` from Ubuntu for Wayland
   clipboard support
10. Install wrapper script + bash completion

## Key files

| File | Purpose |
|---|---|
| `snap/snapcraft.yaml` | Snap build definition with 4 parts |
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
- **Runtime**: bundled Node.js staged at `$SNAP/node/bin/node`; pi runs as a
  plain Node.js CLI (`packages/coding-agent/dist/cli.js`) via `pi.wrapper`,
  so no host Node.js install is needed
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

MIT AND Apache-2.0. The bundled pi code is MIT (upstream); the bundled Node.js runtime is MIT (Node.js contributors); the snap packaging files in this repository are Apache-2.0 (Canonical Ltd.).
