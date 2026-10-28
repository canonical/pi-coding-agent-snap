# SPDX-FileCopyrightText: Canonical Ltd.
# SPDX-License-Identifier: MIT
#
# Shared launcher logic for the snap's Node.js apps, sourced by pi.wrapper
# and pi-acp.wrapper. node_exec runs a script with the bundled Node.js
# runtime outside the snap environment, so pi's built-in tools (bash, read,
# write, edit) operate in the user's environment, not the snap's.
#
# Usage: node_exec SCRIPT [ARGS...] (requires $SNAP)

node_exec() {
    _NODE="$SNAP/node/bin/node"

    # snapd gives classic snaps a complain-mode (log-only) AppArmor profile
    # whose label is inherited by everything pi spawns. If a child is itself
    # a snap (e.g. `juju debug-log > file`), snap-confine rejects file
    # descriptors that were opened under pi's label, so redirection fails
    # with "bad file descriptor" (issue #26, LP: #1849753). Arm AppArmor's
    # onexec transition so node, and everything it spawns, runs unconfined
    # as it would outside the snap. Only act under our own complain-mode
    # label; ignore any failure.
    if [ -e /proc/self/attr/apparmor/current ]; then
        _ATTR_DIR=/proc/self/attr/apparmor
    else
        _ATTR_DIR=/proc/self/attr
    fi
    _LABEL=
    { read -r _LABEL < "$_ATTR_DIR/current"; } 2>/dev/null || :
    case "$_LABEL" in
        "snap.${SNAP_INSTANCE_NAME:-pi-coding-agent}."*" (complain)")
            { printf 'exec unconfined' > "$_ATTR_DIR/exec"; } 2>/dev/null || :
            ;;
    esac
    unset _ATTR_DIR _LABEL

    # Unset all environment variables starting with SNAP
    for _var in $(env | cut -d= -f1 | grep '^SNAP'); do
        unset "$_var"
    done
    unset _var

    # llhttp's WASM SIMD build (used by pi's bundled undici for HTTP/1.1
    # response parsing) misparses responses on riscv64 with spurious
    # "Invalid header value char" errors, surfacing as intermittent
    # "Connection error" failures. undici disables the SIMD build on ppc64
    # for the same reason; force the non-SIMD wasm build on riscv64.
    if [ "$(uname -m)" = "riscv64" ]; then
        export UNDICI_NO_WASM_SIMD=1
    fi

    exec "$_NODE" "$@"
}
