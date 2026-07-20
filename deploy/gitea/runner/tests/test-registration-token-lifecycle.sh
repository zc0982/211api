#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LOCK="$ROOT/deploy/gitea/images.lock.env"
suffix="$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
data_volume="gitea-runner-token-test-$suffix-data"
runtime_volume="gitea-runner-token-test-$suffix-runtime"
holder="gitea-runner-token-test-$suffix-holder"
tmp="$(mktemp -d)"

set -a
# shellcheck source=/dev/null
source "$LOCK"
set +a

cleanup() {
  docker rm -f "$holder" >/dev/null 2>&1 || true
  docker volume rm "$runtime_volume" "$data_volume" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT HUP INT TERM

for volume in "$data_volume" "$runtime_volume"; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    printf 'refusing pre-existing token-test volume: %s\n' "$volume" >&2
    exit 1
  fi
done
if docker container inspect "$holder" >/dev/null 2>&1; then
  printf 'refusing pre-existing token-test holder: %s\n' "$holder" >&2
  exit 1
fi

docker volume create "$data_volume" >/dev/null
docker volume create --driver local --opt type=tmpfs --opt device=tmpfs \
  --opt o=uid=1000,gid=1000,mode=0700,nosuid,nodev \
  "$runtime_volume" >/dev/null

# A named local-driver tmpfs is re-created after its last mount disappears.
# DinD is the production lifetime holder; this inert container models it here.
docker run -d --name "$holder" --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$runtime_volume,dst=/runtime" \
  "$APP_ALPINE_IMAGE" sleep 300 >/dev/null

# Docker writes this synthetic fixture as host root, matching the production
# bind source, but the value is neither a credential nor printed as evidence.
docker run --rm --network none --read-only --cap-drop ALL \
  --cap-add DAC_OVERRIDE --security-opt no-new-privileges:true \
  --mount "type=bind,src=$tmp,dst=/source" "$APP_ALPINE_IMAGE" sh -ec '
    umask 077
    printf "synthetic-registration-fixture\n" > /source/runner-token
    chmod 0600 /source/runner-token
    test "$(stat -c "%u:%g %a" /source/runner-token)" = "0:0 600"
  '

docker run --rm --network none --read-only --cap-drop ALL --cap-add CHOWN \
  --security-opt no-new-privileges:true \
  --mount "type=volume,src=$data_volume,dst=/data" \
  "$APP_ALPINE_IMAGE" sh -ec '
    chmod 0700 /data
    chown 1000:1000 /data
  '

# This is the same capability and copy boundary documented for production.
docker run --rm --network none --read-only \
  --cap-drop ALL --cap-add DAC_OVERRIDE --cap-add CHOWN \
  --security-opt no-new-privileges:true \
  --mount "type=bind,src=$tmp/runner-token,dst=/source-token,readonly" \
  --mount "type=volume,src=$runtime_volume,dst=/runtime" \
  "$APP_ALPINE_IMAGE" sh -ec '
    partial=/runtime/.runner-registration-token.partial
    target=/runtime/runner-registration-token
    trap "rm -f \"$partial\"" EXIT HUP INT TERM
    test -f /source-token
    test ! -L /source-token
    test "$(stat -c "%u:%g %a" /source-token)" = "0:0 600"
    test -s /source-token
    rm -f "$partial"
    cp /source-token "$partial"
    chmod 0400 "$partial"
    chown 1000:1000 "$partial"
    mv -f "$partial" "$target"
    test "$(stat -c "%u:%g %a" "$target")" = "1000:1000 400"
  '

docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$runtime_volume,dst=/runtime" \
  "$APP_ALPINE_IMAGE" sh -ec '
    test "$(cat /runtime/runner-registration-token)" = synthetic-registration-fixture
  '

docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$data_volume,dst=/data" \
  "$APP_ALPINE_IMAGE" sh -ec '
    umask 077
    printf "synthetic-runner-state\n" > /data/.runner
  '

# Cleanup removes the tmpfs token even if the final state assertion would fail.
docker run --rm --network none --read-only \
  --cap-drop ALL --cap-add DAC_OVERRIDE \
  --security-opt no-new-privileges:true \
  --mount "type=volume,src=$data_volume,dst=/data,readonly" \
  --mount "type=volume,src=$runtime_volume,dst=/runtime" \
  "$APP_ALPINE_IMAGE" sh -ec '
    state_ready=0
    test -s /data/.runner && state_ready=1
    rm -f /runtime/runner-registration-token
    test ! -e /runtime/runner-registration-token
    test "$state_ready" = 1
  '

docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$runtime_volume,dst=/runtime" \
  "$APP_ALPINE_IMAGE" test ! -e /runtime/runner-registration-token

docker rm -f "$holder" >/dev/null
docker volume rm "$runtime_volume" "$data_volume" >/dev/null
rm -rf -- "$tmp"
trap - EXIT HUP INT TERM

printf 'runner registration-token lifecycle passed\n'
