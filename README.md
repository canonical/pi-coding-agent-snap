# pi-coding-agent snap

This repository contains snap packaging for the [pi coding agent](https://github.com/earendil-works/pi).

The snap packaging is modeled after [opencode-snap](https://github.com/canonical/opencode-snap) and maintained separately from the upstream pi repository.

The snap is named **`pi-coding-agent`** with two apps:
- `pi-coding-agent` — default app (runs as `pi-coding-agent`)
- `pi` — alias target (runs as `pi-coding-agent.pi`; an alias from `pi` can be requested on the Snap Store forum)

After the alias is granted, users can run just `pi`.

## What is pi?

Pi is a minimal, extensible terminal coding agent. It gives LLMs four core tools — `read`, `write`, `edit`, and `bash` — and lets you extend it with TypeScript extensions, skills, prompt templates, themes, and shareable pi packages.

- Upstream repo: [github.com/earendil-works/pi](https://github.com/earendil-works/pi)
- Website: [pi.dev](https://pi.dev)
- npm: [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)

## Approach

The snap is a **classic snap** with **`base: core26`** (Ubuntu 26.04 LTS), since pi needs unrestricted filesystem access to work as a coding agent.

### Build strategy

The snap reuses pi's existing [`build:binary`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/package.json) npm script rather than writing custom build steps. Inside the LXD build container:

1. **Clone** upstream pi at a pinned Git tag (e.g., `v0.80.6`)
2. **Install build tools**:
   - **Node.js 22.x** — prebuilt binary from nodejs.org (pi requires ≥22.19)
   - **Bun v1.3.14** — downloaded binary from GitHub releases
3. **`npm ci --ignore-scripts`** at repo root — installs all workspace deps including `@typescript/native-preview` (provides the `tsgo` TypeScript compiler)
4. **Install clipboard native binding** — `npm install --no-save @mariozechner/clipboard-linux-$ARCH-gnu`
5. **`npm run build:binary`** in `packages/coding-agent/` — invokes pi's own pipeline:
   - Builds `@earendil-works/pi-tui` → `dist/`
   - Builds `@earendil-works/pi-ai` (generates models + compiles) → `dist/`
   - Builds `@earendil-works/pi-agent-core` → `dist/`
   - Builds `@earendil-works/pi-coding-agent` → `dist/`
   - `bun build --compile` → produces standalone `dist/pi` binary
   - `copy-binary-assets` → copies package.json, README, docs, examples, wasm, themes, export templates
6. **Install binary + assets** into `$SNAP/bin/` — this matches pi's `getPackageDir()` which resolves `dirname(process.execPath)` for Bun compiled binaries
7. **Install `wl-clipboard`** from Ubuntu package via `stage-packages` for Wayland clipboard support
8. **Install wrapper script** that unsets `SNAP_*` env vars before exec

### Parts in snapcraft.yaml

| Part | Plugin | What it does |
|---|---|---|
| `nodejs` | `nil` | Download and extract Node.js 22.x prebuilt binary |
| `bun` | `dump` | Download Bun v1.3.14 binary |
| `pi-build` | `nil` | Clone pi source, `npm ci`, install clipboards, run `build:binary`, install |
| `wl-clipboard` | `nil` | Stage-package from Ubuntu for Wayland clipboard |
| `pi-configuration` | `nil` | Install wrapper script and bash completion files |

### Clipboard strategy

Pi's clipboard logic differs by display server — so we need **both** mechanisms:

| Session | Text copy | Image paste |
|---|---|---|
| **Wayland** | `wl-copy` (native addon explicitly skipped on Linux) | `wl-paste` → `xclip` |
| **X11** | `xclip` / `xsel` (native addon skipped) | `@mariozechner/clipboard` → `xclip` |

- `@mariozechner/clipboard-linux-$ARCH-gnu` is installed next to the binary and handles X11 image reading
- `wl-clipboard` (Ubuntu package via `stage-packages`) provides `wl-copy`/`wl-paste` for Wayland clipboard

### Runtime assets included

| Asset | Purpose | Source |
|---|---|---|
| `pi` binary | Standalone compiled executable | `bun build --compile` output |
| `package.json` | Version info | Staged by `copy-binary-assets` |
| `photon_rs_bg.wasm` | Image processing (resize, format convert) | `@silvia-odwyer/photon-node` |
| `theme/*.json` | Interactive mode themes | `src/modes/interactive/theme/` |
| `assets/*.png` | UI assets | `src/modes/interactive/assets/` |
| `export-html/` | Session export templates | `src/core/export-html/` |
| `docs/` | Documentation | `docs/` directory |
| `examples/` | Extension examples | `examples/` directory |

## Version management

Version updates are handled by **Renovate** with custom regex managers — no cron jobs needed:

- `source-tag: v<version>` in `snap/snapcraft.yaml` → watches `earendil-works/pi` GitHub releases
- Expected version string in `tests/smoke/pi/task.yaml`
- Bun download URL in `snapcraft.yaml` → watches `oven-sh/bun` releases

When a new upstream pi version is released, Renovate auto-creates a PR updating all three locations.

## Project structure

```
pi-coding-agent-snap/
├── snap/
│   ├── local/
│   │   ├── pi.wrapper              # Wrapper script (unsets SNAP_* env vars)
│   │   └── pi.completion           # Bash completion
│   └── snapcraft.yaml              # Snap build definition
├── tests/
│   └── smoke/
│       └── pi/
│           └── task.yaml           # Basic smoke test
├── publishing/
│   └── README.md                   # Publishing documentation
├── .github/
│   ├── actions/
│   │   └── install-cached-snap/    # Snap caching action
│   └── workflows/
│       ├── build.yml               # CI entry point (push/PR/tag)
│       ├── snapcraft-pack.yml      # Reusable build workflow
│       ├── snapcraft-upload.yml    # Store upload workflow
│       ├── snapcraft-promote.yml   # Channel promotion
│       └── release.yml             # Release creation
├── renovate.json                    # Dependency update configuration
├── spread.yaml                      # Spread test backend config
├── AGENTS.md                        # Agent instructions for this repo
├── README.md                        # This file
└── LICENSE                          # MIT (same as upstream)
```

## Building

```bash
# Install snapcraft
sudo snap install snapcraft --classic

# Build the snap
snapcraft pack -v

# Install locally
sudo snap install --classic --dangerous ./pi-coding-agent_*.snap

# Run (default app)
pi-coding-agent

# Or via the alias target (before alias is requested)
pi-coding-agent.pi
```

## Testing with spread

Tests in this repository use [spread](https://github.com/snapcore/spread), the multi-machine test runner from the snap core team.

```bash
sudo snap install image-garden
image-garden.spread
```

## Publishing

See [publishing/README.md](publishing/README.md) for details on store publishing, credentials, and release workflow.

## Contributing

See [AGENTS.md](AGENTS.md) for project-specific rules. The snap packaging is maintained separately from upstream pi — upstream contributions should go to [github.com/earendil-works/pi](https://github.com/earendil-works/pi).

## License

MIT — see [LICENSE](LICENSE). Same license as the upstream pi project.

## See also

- [opencode-snap](https://github.com/canonical/opencode-snap) — the template this packaging is modeled after
- [pi.dev](https://pi.dev) — pi project website
