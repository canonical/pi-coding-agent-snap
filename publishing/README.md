# Publishing

This snap is published to the Snap Store under the name `pi`.

## CI/CD publishing

The CI pipeline in `.github/workflows/build.yml` publishes automatically:

| Event | Channel | Requires |
|---|---|---|
| Push to `main` | `latest/edge` | `SNAPCRAFT_STORE_CREDENTIALS` secret |
| Tag push `v*` | `latest/candidate` | `SNAPCRAFT_STORE_CREDENTIALS` secret |

### Setting up store credentials

1. Create a Snap Store account and register the `pi` snap name.
2. Generate store credentials locally:

```bash
snapcraft export-login \
  --snaps=pi \
  --channels=latest/edge,latest/candidate,latest/stable \
  --acls=package_upload,package_release \
  pi.credentials
```

3. Add the contents of `pi.credentials` as a GitHub Actions secret named
   `SNAPCRAFT_STORE_CREDENTIALS` in each environment:
   - `latest/edge` — branch builds
   - `latest/candidate` — tag builds (release candidates)
   - `latest/stable` — promotions

## Manual publishing

### Build and publish a revision

```bash
snapcraft pack -v
snapcraft upload --release latest/edge pi_*.snap
```

### Promote a channel

```bash
snapcraft promote --from-channel=latest/candidate --to-channel=latest/stable pi
```

Or use the `snapcraft promote` GitHub Actions workflow (manual trigger).

## Release workflow

1. Wait for Renovate to open a PR updating `source-tag` in `snap/snapcraft.yaml`
   (or manually update it to the desired upstream pi version).
2. Merge the PR to `main`.
3. Run the `release` GitHub Actions workflow with the matching version tag
   (e.g., `v0.80.6`). The workflow validates that the tag matches the
   `source-tag` in `snap/snapcraft.yaml`, then creates a GitHub release.
4. The tag push triggers `build.yml`, which builds, tests, and publishes to
   `latest/candidate`.
5. After verification, use `snapcraft promote` to move to `latest/stable`.
