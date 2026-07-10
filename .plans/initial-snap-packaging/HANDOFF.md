# Initial pi-coding-agent snap packaging

## Goal
Create the complete snap packaging infrastructure for pi-coding-agent, modeled after opencode-snap.

## Approach

### Build strategy
The snap reuses pi's existing `build:binary` npm script rather than writing custom build steps. Inside the LXD container:

1. **Clone** upstream pi at a pinned Git tag (e.g., `v0.80.6`)
2. **Install build tools**:
   - **Node.js 22.x** — prebuilt binary from nodejs.org (pi requires ≥22.19)
   - **Bun v1.3.14** — downloaded binary from GitHub releases (matches opencode and pi's own CI)
3. **`npm ci --ignore-scripts`** at repo root — installs all workspace deps including `@typescript/native-preview` (provides `tsgo` compiler)
4. **Install clipboard native binding** — `npm install --no-save @mariozechner/clipboard-linux-$ARCH-gnu` — this is needed before the Bun compile step so the binding gets embedded
5. **`npm run build:binary`** in `packages/coding-agent/` — invokes pi's own pipeline:
   - Builds `@earendil-works/pi-tui` → dist/
   - Builds `@earendil-works/pi-ai` (generates models + compiles) → dist/
   - Builds `@earendil-works/pi-agent-core` → dist/
   - Builds `@earendil-works/pi-coding-agent` → dist/
   - `bun build --compile` → produces standalone `dist/pi` binary
   - `copy-binary-assets` → copies package.json, README, docs, examples, wasm, themes, export templates
6. **Install binary + assets** into snap paths
7. **Build wl-clipboard** from source (needed for Wayland clipboard support)
8. **Install wrapper script** that unsets `SNAP_*` env vars before exec

### Parts in snapcraft.yaml

| Part | Plugin | What it does |
|---|---|---|
| `nodejs` | `dump` | Download and extract Node.js 22.x prebuilt binary |
| `bun` | `dump` | Download Bun v1.3.14 binary (same URL pattern as opencode) |
| `pi-build` | `nil` | Clone pi source, npm ci, install clipboards, run build:binary, install |
| `wl-clipboard` | `meson` | Build wl-clipboard from source (same as opencode) |
| `pi-configuration` | `nil` | Install wrapper script, bash completion, version derivation |

### Clipboard strategy
Pi's clipboard logic differs by session type:

| Session | Text copy | Image paste |
|---|---|---|
| **Wayland** | `wl-copy` (native addon explicitly skipped on Linux) | `wl-paste` → `xclip` |
| **X11** | `xclip` / `xsel` (native addon skipped) | `@mariozechner/clipboard` → `xclip` |

So we need **both**:
- `@mariozechner/clipboard-linux-$ARCH-gnu` — for X11 image reading
- `wl-clipboard` (source build, same as opencode) — for Wayland clipboard

### Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Base | `core26` | Ubuntu 26.04 LTS |
| Confinement | Classic | Unrestricted filesystem access |
| Binary type | Bun compiled standalone | No Node.js runtime at runtime |
| Bun version | v1.3.14 | Matches opencode + pi CI |
| Node.js version | 22.x | Pi requires ≥22.19 |
| WASM | Include `photon_rs_bg.wasm` | Full image processing (~4 MB) |
| Clipboard | Native binding + wl-clipboard | Covers X11 and Wayland |
| Wrapper | Unset all `SNAP_*` env vars | Same pattern as opencode |
| Version updates | Renovate custom regex managers | Same as opencode, no cron needed |

### Version management (Renovate)
Follow opencode's pattern: `renovate.json` with custom regex managers that match:
- `source-tag: v<version>` in `snap/snapcraft.yaml` → watches `earendil-works/pi` releases
- Expected version string in `tests/smoke/pi/task.yaml`
- Bun download URL in `snapcraft.yaml` → watches `oven-sh/bun` releases

Renovate auto-creates PRs when new upstream versions are detected. The release workflow validates that the release tag matches what's in snapcraft.yaml.

## Files to create

| File | Purpose |
|---|---|
| `snap/snapcraft.yaml` | Core build definition |
| `snap/local/pi.wrapper` | Wrapper script (unsets SNAP_*) |
| `snap/local/pi.completion` | Bash completion via `--get-yargs-completions` |
| `renovate.json` | Dependency update config |
| `AGENTS.md` | Project-specific agent rules |
| `.github/actions/install-cached-snap/action.yaml` | Snap caching composite action |
| `.github/actions/install-cached-snap/action.sh` | Snap caching script |
| `.github/workflows/snapcraft-pack.yml` | Reusable snap build workflow |
| `.github/workflows/build.yml` | CI entry point (push/PR/tag) |
| `.github/workflows/snapcraft-upload.yml` | Store upload workflow |
| `.github/workflows/snapcraft-promote.yml` | Channel promotion |
| `.github/workflows/release.yml` | Release creation and validation |
| `spread.yaml` | Spread test backend config |
| `tests/smoke/pi/task.yaml` | Basic smoke tests |
| `publishing/README.md` | Store publishing docs |
| `README.md` | Project README (update with finalized approach) |

## References
- opencode-snap: https://github.com/canonical/opencode-snap
- upstream pi: https://github.com/earendil-works/pi
- pi build:binary: `packages/coding-agent/package.json` → `scripts.build:binary`
- pi build-binaries.sh: `scripts/build-binaries.sh`
- pi clipboard text: `src/utils/clipboard.ts`
- pi clipboard image: `src/utils/clipboard-image.ts`
- pi clipboard native: `src/utils/clipboard-native.ts`
- pi photon/wasm: `src/utils/photon.ts`
- opencode renovate.json for regex manager patterns
