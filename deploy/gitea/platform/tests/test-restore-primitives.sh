#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../gitea-restore-drill
source "$ROOT/deploy/gitea/platform/gitea-restore-drill"

tmp="$(mktemp -d)"
cleanup_test() {
  rm -rf -- "$tmp"
}
trap cleanup_test EXIT HUP INT TERM

printf '%s\n' '{"schemaVersion":2,"mediaType":"application/vnd.oci.image.index.v1+json","manifests":[]}' |
  validate_container_manifest
printf '%s\n' '{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json","config":{},"layers":[]}' |
  validate_container_manifest
if printf '%s\n' '{"schemaVersion":1}' | validate_container_manifest 2>/dev/null; then
  printf 'invalid container manifest was accepted\n' >&2
  exit 1
fi

[[ "$(urlencode_registry_path 'nested/image name')" == 'nested/image%20name' ]]
[[ "$(urlencode_segment 'sha256:value')" == 'sha256%3Avalue' ]]

SCRATCH="$tmp/scratch"
[[ "$(scratch_path_for_original /etc/gitea/db-password)" == "$SCRATCH/etc/gitea/db-password" ]]
if scratch_path_for_original /etc/gitea/../shadow >/dev/null; then
  printf 'restore scratch path accepted parent traversal\n' >&2
  exit 1
fi
if scratch_path_for_original /etc//gitea/secret >/dev/null; then
  printf 'restore scratch path accepted a non-canonical path\n' >&2
  exit 1
fi

permission_fixture="$tmp/root-owned-executable"
printf '#!/bin/sh\n' >"$permission_fixture"
chmod 0755 "$permission_fixture"
stat() {
  if [[ "$1" == -c && "$2" == %u ]]; then
    printf '0\n'
  else
    command stat "$@"
  fi
}
require_root_nonsecret_file "$permission_fixture"
chmod 0700 "$permission_fixture"
if require_root_nonsecret_file "$permission_fixture" 2>/dev/null; then
  printf 'restore accepted an unsupported root-owned executable mode\n' >&2
  exit 1
fi
unset -f stat

printf 'restore path and Registry manifest primitives passed\n'
