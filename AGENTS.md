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
7. Build the optional **gondolin component payload** in its own
   `gondolin-extension` part: take `index.ts` from the pi checkout staged by
   `pi-build` (so it matches this pi release's tool APIs), add the pinned
   manifest + lockfile from `snap/local/gondolin-extension/`, run
   `npm ci --omit=dev --omit=optional --ignore-scripts`, strip source
   maps/`.d.ts`, and organize it into the `gondolin` component as
   `lib/pi/extensions/gondolin`. The dependency set is pinned in
   `snap/local/gondolin-extension/` rather than inherited from pi's example
   manifest: reproducible, reviewed, and with our payload policy (no krun
   runner). The build warns when pi's own pin diverges, because the extension
   source comes from pi and may expect that API
8. Assemble the runtime payload into `$SNAP/lib/pi/`: pruned `node_modules/`
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
10. Build the [pi-acp](https://github.com/svkozak/pi-acp) ACP adapter from
    source at a pinned `source-tag` (`npm ci` → `npm run build` → `npm
    prune --omit=dev`) into the optional `pi-acp` snap component (mounted at
    `$SNAP_COMPONENTS/pi-acp/`); it runs as the `pi-acp` app on the same
    bundled node
11. Install wrapper scripts, the `pi` shim for pi-acp + bash completion
11. Build the optional **gondolin component payload** in its own
    `gondolin-extension` part: take `index.ts` from the pi checkout staged
    by `pi-build` (so it matches this pi release's tool APIs), add the
    pinned manifest + lockfile from `snap/local/gondolin-extension/`, run
    `npm ci --omit=dev --omit=optional --ignore-scripts`, strip source
    maps/`.d.ts`, adopt the package version as the component version and
    organize it into the `gondolin` component as
    `lib/pi/extensions/gondolin`
10. Build the [pi-acp](https://github.com/svkozak/pi-acp) ACP adapter from
    source at a pinned `source-tag` (`npm ci` → `npm run build` → `npm
    prune --omit=dev`) into the optional `pi-acp` snap component (mounted at
    `$SNAP_COMPONENTS/pi-acp/`); it runs as the `pi-acp` app on the same
    bundled node
12. Install wrapper scripts, the `pi` shim for pi-acp + bash completion

## Key files

| File | Purpose |
|---|---|
| `snap/snapcraft.yaml` | Snap build definition with 6 parts |
| `snap/local/pi.wrapper` | Wrapper for pi |
| `snap/local/pi-acp.wrapper` | Wrapper for the pi-acp adapter; runs it from `$SNAP_COMPONENTS/pi-acp` (or explains how to install the component), puts `pi.shim` first on `PATH` |
| `snap/local/node-exec.sh` | Shared launcher sourced by both wrappers: AppArmor onexec, unsets `SNAP_*`, riscv64 undici fix, execs bundled node |
| `snap/local/pi.shim` | `pi` command for pi-acp (installed as `lib/pi/packages/coding-agent/bin/pi`); drops itself from `PATH`, recovers `$SNAP`, execs `pi.wrapper` |
| `snap/local/pi-gondolin.wrapper` | Wrapper for the gondolin component; resolves it from `$SNAP_COMPONENTS` (or the pre-2.78 fallback), guards missing component/architecture/host QEMU, then runs `pi.wrapper -e <extension>` |
| `snap/local/gondolin-extension/` | Pinned `@earendil-works/gondolin` manifest + lockfile used to build the gondolin component payload |
| `snap/local/pi.completion` | Bash completion for `pi` and `pi-coding-agent` |
| `snap/local/pi-workspace-packages.mjs` | Derives the workspace packages to ship from compiled imports and transitive production dependencies |
| `renovate.json` | Custom regex managers for version updates |
| `spread.yaml` | Spread test backend config (image-garden adhoc backend) |
| `.image-garden.mk` | image-garden cloud-init user-data templates (core26) |
| `tests/smoke/pi/task.yaml` | Snap smoke tests, including per-package production dependency resolution checks |
| `tests/smoke/joke/task.yaml` | Offline LLM replay test (mannequin) |
| `tests/smoke/joke/recordings/joke/` | Recorded OpenAI-compatible session replayed by that test |
| `tests/smoke/gondolin/task.yaml` | Gondolin component smoke test (install, payload, dependency resolution, extension-load probe) |
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
  responses on riscv64, so `node-exec.sh` sets `UNDICI_NO_WASM_SIMD=1` there.
- **CI pipeline**: `build.yml` → `tasteful-crafts.yml` orchestrates snap build
  (LXD), image-garden spread integration tests across Ubuntu/Debian cloud
  systems, and Snap Store upload to `latest/edge` (branch) or
  `latest/candidate` (tag); `latest/stable` is reached via manual
  `snapcraft-promote`.
- **Gondolin component** (optional): carries pi's upstream tool-routing
  extension plus `@earendil-works/gondolin`. `pi-gondolin` resolves it through
  `$SNAP_COMPONENTS` (2.78+), falling back to
  `${SNAP%/*}/components/$SNAP_REVISION`, *before* `pi.wrapper` unsets `SNAP*`,
  then execs `pi.wrapper -e <extension>`.
  The sandbox must run in pi's process — gondolin's workspace VFS providers are
  host-side JavaScript objects served over an in-process RPC channel, and its
  sandbox server has no cross-process API — so a separate confined snap cannot
  host it. Consumes host QEMU (`qemu-system-*` and `qemu-img`); the
  experimental krun runner is deliberately omitted. riscv64 refuses at runtime
  (no gondolin guest images).

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

pi-acp is pinned separately via its own `source-tag` (Renovate watches
`svkozak/pi-acp` releases). The Renovate and `release.yml` regexes anchor on
each part's `source:` URL, so keep `source`, `source-type` and `source-tag`
adjacent and in that order.

## pi-acp

pi-acp ships as the optional `pi-acp` snap component
(`snap install pi-coding-agent+pi-acp`), built into the component by
`organize: {pi-acp: (component/pi-acp)}` so the component root is the npm
package root. Its `version` is set statically in `components:` because
craftctl rejects the hyphen in `components.pi-acp.version`, so `adopt-info`
cannot set it. Renovate bumps it together with the part's `source-tag` (keep
`version` directly after `type: standard`). The build produces
`pi-coding-agent+pi-acp_<version>.comp`. Apps cannot live in components, so
the `pi-acp` app, its wrapper and the shim stay in the snap; the wrapper
exits with install instructions when the component is absent. snapd only
exports `$SNAP_COMPONENTS` from 2.78 (2.77 stable does not), so the wrapper
falls back to `${SNAP%/*}/components/$SNAP_REVISION`, the same mount point. CI already
packs, uploads (`snapcraft upload --component`) and spread-installs `.comp`
files alongside the snap.

pi-acp spawns `pi` by bare name (`pi --mode rpc`, `--terminal-login`,
`pi --version`, and `which pi` for `/changelog`). `pi-acp.wrapper`
prepends `$SNAP/lib/pi/packages/coding-agent/bin` (holding `pi.shim`) to
`PATH`. pi-acp runs with `SNAP_*` unset, but the shim's own directory is
exactly that `PATH` entry, so the shim strips it from `PATH` (keeping it
out of the shells pi runs), recovers `$SNAP` by removing the fixed suffix,
and execs `pi.wrapper`. The shim lives two levels below coding-agent so
`/changelog` finds the shipped `CHANGELOG.md`.
The gondolin pin lives in
`snap/local/gondolin-extension/package.json` + `package-lock.json`
(Renovate's npm manager; regenerate the lockfile with npm 10, the
version bundled with Node 22). Keep it at a release supporting
Node >= 22.19 (0.13.0 or later) and check the build log for the warning
when pi's own pin diverges.

## gondolin component

gondolin ships as the optional `gondolin` snap component
(`snap install pi-coding-agent+gondolin`), built by the
`gondolin-extension` part from pi's upstream tool-routing extension plus
the pinned `@earendil-works/gondolin` dependency set. Its `version` is
adopted from the installed package (`adopt-info: gondolin-extension` +
`craftctl set components.gondolin.version`) rather than set statically
like pi-acp's, since craftctl only rejects the hyphens in that name. The
wrapper uses `$SNAP_COMPONENTS` when snapd exports it (2.78+) and falls
back to `${SNAP%/*}/components/$SNAP_REVISION`. Unlike pi-acp, the sandbox
must run in pi's process: gondolin's workspace VFS providers are host-side
JavaScript objects served over an in-process RPC channel, and its sandbox
server has no cross-process API, so a separate confined snap cannot host
it. It consumes host QEMU (`qemu-system-*` and `qemu-img`); the
experimental krun runner is deliberately omitted, and riscv64 refuses at
runtime (no gondolin guest images).

## Clipboard strategy

Pi needs both clipboard mechanisms:

- **`@earendil-works/pi-tui` native X11 helper** — bundled Linux prebuild `linux-platform-x11.node` provides X11 clipboard image reading
- **`wl-clipboard`** — `wl-copy`/`wl-paste` for Wayland clipboard (pi explicitly skips
  the native addon on Linux for text operations)

## License

MIT AND Apache-2.0. The bundled pi code is MIT (upstream); the bundled Node.js runtime is MIT (Node.js contributors); the pi-acp adapter component is MIT (Sergii Kozak); the snap packaging files in this repository are Apache-2.0 (Canonical Ltd.).
