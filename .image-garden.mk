# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Canonical Ltd.

define DEBIAN_CLOUD_INIT_USER_DATA_TEMPLATE
$(CLOUD_INIT_USER_DATA_TEMPLATE)
- snap wait system seed.loaded
- snap install --beta snapd
- snap install core26
packages:
- snapd
endef

define UBUNTU_CLOUD_INIT_USER_DATA_TEMPLATE
$(CLOUD_INIT_USER_DATA_TEMPLATE)
- snap wait system seed.loaded
- snap install --beta snapd
- snap install core26
packages:
- snapd
endef

define FEDORA_CLOUD_INIT_USER_DATA_TEMPLATE
$(CLOUD_INIT_USER_DATA_TEMPLATE)
- snap wait system seed.loaded
- snap install core26
- ln -s /var/lib/snapd/snap /snap
packages:
- snapd
endef

# TODO: add arm64 / fedora-cloud-* / opensuse systems to spread.yaml
# backends once ready.