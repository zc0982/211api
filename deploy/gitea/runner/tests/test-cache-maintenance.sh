#!/usr/bin/env bash

set -euo pipefail

readonly ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../../.." && pwd)"
readonly SCRIPT="$ROOT/deploy/gitea/runner/cache-maintenance.sh"
readonly LOCK="$ROOT/deploy/gitea/images.lock.env"
readonly suffix="$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
readonly volume="gitea-runner-cache-maintenance-$suffix"

set -a
# shellcheck source=/dev/null
source "$LOCK"
set +a

cleanup() { docker volume rm -f "$volume" >/dev/null 2>&1 || true; }
trap cleanup EXIT HUP INT TERM

docker volume create "$volume" >/dev/null
run_root() {
  docker run --rm --user 0:0 --mount "type=volume,src=$volume,dst=/data" \
    "$APP_ALPINE_IMAGE" sh -ec "$1"
}
run_maintenance() {
  docker run --rm --network none --read-only --user 1000:1000 \
    --cap-drop ALL --security-opt no-new-privileges:true \
    --mount "type=volume,src=$volume,dst=/data" \
    --mount "type=bind,src=$SCRIPT,dst=/usr/local/bin/gitea-runner-cache-maintenance,readonly" \
    -e GITEA_CACHE_MAINTENANCE_TEST=true \
    -e GITEA_CACHE_MAINTENANCE_MAX_KIB="$1" \
    -e GITEA_CACHE_MAINTENANCE_MAX_PERCENT="$2" \
    --entrypoint /usr/local/bin/gitea-runner-cache-maintenance \
    "$RUNNER_IMAGE"
}
run_production_defaults() {
  docker run --rm --network none --read-only --user 1000:1000 \
    --cap-drop ALL --security-opt no-new-privileges:true \
    --mount "type=volume,src=$volume,dst=/data" \
    --mount "type=bind,src=$SCRIPT,dst=/usr/local/bin/gitea-runner-cache-maintenance,readonly" \
    -e GITEA_CACHE_MAINTENANCE_MAX_KIB=0 \
    -e GITEA_CACHE_MAINTENANCE_MAX_PERCENT=0 \
    --entrypoint /usr/local/bin/gitea-runner-cache-maintenance \
    "$RUNNER_IMAGE"
}

run_root 'mkdir -p /data/cache/actions/nested /data/cache/other; chown -R 1000:1000 /data/cache; touch /data/cache/actions/keep /data/cache/actions/.hidden /data/cache/actions/nested/item /data/cache/other/untouched'
run_production_defaults >/dev/null
run_maintenance 100 101 >/dev/null
run_root 'test -f /data/cache/actions/keep; test -f /data/cache/actions/.hidden; test -f /data/cache/actions/nested/item; test -f /data/cache/other/untouched; test -d /data/cache/actions'

run_maintenance 0 101 >/dev/null
run_root 'test ! -e /data/cache/actions/keep; test ! -e /data/cache/actions/.hidden; test ! -e /data/cache/actions/nested; test -f /data/cache/other/untouched; test -d /data/cache/actions'

run_root 'touch /data/cache/actions/filesystem-threshold'
run_maintenance 100 0 >/dev/null
run_root 'test ! -e /data/cache/actions/filesystem-threshold; test -f /data/cache/other/untouched; test -d /data/cache/actions'

run_root 'rmdir /data/cache/actions; ln -s /data/cache/other /data/cache/actions'
if run_maintenance 0 101 >/dev/null 2>&1; then
  printf 'cache maintenance accepted a symlink target\n' >&2
  exit 1
fi
run_root 'rm /data/cache/actions'
if run_maintenance 0 101 >/dev/null 2>&1; then
  printf 'cache maintenance accepted a missing target\n' >&2
  exit 1
fi
run_root 'mkdir /data/cache/actions; chown 0:0 /data/cache/actions'
if run_maintenance 0 101 >/dev/null 2>&1; then
  printf 'cache maintenance accepted an unexpected owner\n' >&2
  exit 1
fi
run_root 'chown 1000:1000 /data/cache/actions; touch /data/cache/actions/invalid-threshold'
if run_maintenance invalid 101 >/dev/null 2>&1; then
  printf 'cache maintenance accepted a non-numeric threshold\n' >&2
  exit 1
fi
run_root 'test -f /data/cache/actions/invalid-threshold'
run_root 'test -f /data/cache/other/untouched'

printf 'cache maintenance fixture tests passed.\n'
