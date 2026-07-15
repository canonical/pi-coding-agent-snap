#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Canonical Ltd.
#
# Export snapcraft credentials for publishing to latest/candidate.
#
# Run this on a machine with snapcraft installed and authenticated
# (snapcraft login). The resulting token is saved to candidate-credentials.
#
# Usage:
#   ./export-candidate-credentials.sh

set -euo pipefail

SNAP_NAME="pi-coding-agent"

snapcraft export-login \
  --snaps="${SNAP_NAME}" \
  --channels=latest/candidate \
  --acls=package_upload,package_release \
  candidate-credentials

echo "Credentials exported to candidate-credentials"