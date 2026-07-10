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
7. Build `wl-clipboard` from source for Wayland clipboard support
8. Install wrapper script + bash completion

## Key files

| File | Purpose |
|---|---|
| `snap/snapcraft.yaml` | Snap build definition with 5 parts |
| `snap/local/pi.wrapper` | Wrapper that unsets `SNAP_*` env vars |
| `snap/local/pi.completion` | Bash completion for `pi` and `pi-coding-agent` |
| `renovate.json` | Custom regex managers for version updates |
| `spread.yaml` | Spread test backend config |
| `tests/smoke/pi/task.yaml` | Smoke tests |

## Architecture

- **Base**: `core26` (Ubuntu 26.04 LTS)
- **Confinement**: `classic` (needs unrestricted filesystem access)
- **Platforms**: amd64, arm64
- **Binary**: standalone Bun-compiled executable (no Node.js needed at runtime)

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

MIT (same as upstream pi).
