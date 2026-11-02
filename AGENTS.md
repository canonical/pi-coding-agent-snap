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
   for coding-agent) from the workspace packages pi-coding-agent needs. The
   package set is **derived** by `snap/local/pi-workspace-packages.mjs` from
   both compiled `@earendil-works/*` imports and the transitive production
   workspace dependencies declared by each selected package (not
   `devDependencies`). Compiled imports alone do not reach every runtime
   package: `pi-ai` imports `@earendil-works/pi-telemetry` only as a type,
   which compiles away. Dangling
   workspace symlinks are pruned from `node_modules/`, then build artifacts
   that are never loaded at runtime (source maps, `.d.ts` type declarations,
   and the `dist/bundle` duplicate) are stripped to keep the snap lean
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
| `snap/local/pi-workspace-packages.mjs` | Derives the workspace packages to ship from compiled imports and transitive production dependencies |
| `renovate.json` | Custom regex managers for version updates |
| `spread.yaml` | Spread test backend config (image-garden adhoc backend) |
| `.image-garden.mk` | image-garden cloud-init user-data templates (core26) |
| `tests/smoke/pi/task.yaml` | Snap smoke tests, including per-package production dependency resolution checks |
| `tests/smoke/joke/task.yaml` | Offline LLM replay test (mannequin) |
| `tests/smoke/joke/recordings/joke/` | Recorded OpenAI-compatible session replayed by that test |
| `tests/unit/pi-workspace-packages.test.mjs` | Regression test for the workspace selector (`node --test tests/unit/*.test.mjs`; not yet wired into CI) |
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
- **Platforms**: amd64, arm64, riscv64
- **Runtime**: bundled Node.js staged at `$SNAP/node/bin/node`; pi runs as a
  plain Node.js CLI (`packages/coding-agent/dist/cli.js`) via `pi.wrapper`,
  so no host Node.js install is needed
- **riscv64 specifics**: nodejs.org publishes no riscv64 binaries, so Node.js
  comes from the Node.js project's unofficial-builds (`unofficial-builds.
  nodejs.org`), which publishes the same pinned version (v22.23.1) — every
  architecture uses the same node/npm source and version. The pi-tui native
  clipboard prebuild is x64/arm64-only and is skipped; pi falls back to
  command-line clipboard tools. The build-time compiler needs a swap: pi
  pins tsgo, which has no linux-riscv64 binary, so pi-build installs the
  shipped `typescript@7.0.2` (which does ship one) and shims `tsgo` to its
  `tsc --target es2024`. llhttp's WASM SIMD build misparses HTTP/1.1
  responses on riscv64, so `pi.wrapper` sets `UNDICI_NO_WASM_SIMD=1` there.
- **CI pipeline**: `build.yml` → `tasteful-crafts.yml` orchestrates snap build
  (LXD), image-garden spread integration tests across Ubuntu/Debian cloud
  systems, and Snap Store upload to `latest/edge` (branch) or
  `latest/candidate` (tag); `latest/stable` is reached via manual
  `snapcraft-promote`.

## Tests

- `tests/smoke/pi` — install, runtime layout, clipboard, payload checks.
- `tests/smoke/joke` — installs the `mannequin` snap in its own `prepare:`,
  serves `recordings/joke` on 127.0.0.1:8090 from a transient `systemd-run`
  unit, points a throw-away `PI_CODING_AGENT_DIR/models.json` provider at it
  and asserts that `pi -p` prints the recorded answer. No credentials are
  committed: the recording was captured against a local synthetic
  OpenAI-compatible SSE mock, and mannequin's request envelopes don't keep
  headers.
- The strictly-confined mannequin snap reads the recordings via its
  auto-connected `home` interface, which uses AppArmor owner matches — hence
  the `chown -R root:root` in `spread.yaml`'s global `prepare:` (spread's
  file delivery preserves the uid from the git checkout).
- mannequin is published for amd64 and arm64 only; adding riscv64 spread
  systems needs a guard or a task-level `systems:` restriction.

## Version management

Upstream pi version is pinned via `source-tag` in `snap/snapcraft.yaml`.
Renovate auto-creates PRs when new upstream releases are detected.

Update the version by changing `source-tag` in `snap/snapcraft.yaml` AND
the expected version in `tests/smoke/pi/task.yaml`.

## Clipboard strategy

Pi needs both clipboard mechanisms:

- **`@earendil-works/pi-tui` native X11 helper** — bundled Linux prebuild `linux-platform-x11.node` provides X11 clipboard image reading
- **`wl-clipboard`** — `wl-copy`/`wl-paste` for Wayland clipboard (pi explicitly skips
  the native addon on Linux for text operations)

## License

MIT AND Apache-2.0. The bundled pi code is MIT (upstream); the bundled Node.js runtime is MIT (Node.js contributors); the snap packaging files in this repository are Apache-2.0 (Canonical Ltd.).
