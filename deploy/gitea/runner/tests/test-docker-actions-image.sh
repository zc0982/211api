#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LOCK="$ROOT/deploy/gitea/images.lock.env"
STRICT_ENV="$ROOT/deploy/gitea/platform/strict-env.sh"
DOCKERFILE="$ROOT/deploy/gitea/runner/docker-actions.Dockerfile"
tmp="$(mktemp -d)"
suffix="$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
test_image="211api-docker-actions-test:$suffix"

cleanup() {
  docker image rm -f "$test_image" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# shellcheck source=/dev/null
source "$STRICT_ENV"
gitea_load_image_lock "$LOCK"
[[ "$DOCKER_ACTIONS_CI_IMAGE" =~ ^git\.211api\.com/211api/runner-docker-actions:docker29\.6\.1-node24\.18\.0-v[0-9]+@sha256:[0-9a-f]{64}$ ]]

dockerfile_hash="$(sha256sum "$DOCKERFILE")"
dockerfile_hash="${dockerfile_hash%% *}"
mkdir -m 0700 "$tmp/context"
if ! docker build --provenance=false \
  --build-arg "DOCKER_CLI_IMAGE=$DOCKER_CLI_IMAGE" \
  --build-arg "NODE_DOCKER_ACTIONS_BASE_IMAGE=$NODE_DOCKER_ACTIONS_BASE_IMAGE" \
  --build-arg "DOCKER_ACTIONS_DOCKERFILE_SHA256=$dockerfile_hash" \
  --tag "$test_image" --file "$DOCKERFILE" "$tmp/context" \
  >"$tmp/build.log" 2>&1; then
  cat "$tmp/build.log" >&2
  exit 1
fi

docker image inspect "$test_image" | jq -e \
  --arg docker "$DOCKER_CLI_IMAGE" \
  --arg node "$NODE_DOCKER_ACTIONS_BASE_IMAGE" \
  --arg hash "$dockerfile_hash" '
    length == 1
    and .[0].Config.Labels["io.211api.base.docker-cli"] == $docker
    and .[0].Config.Labels["io.211api.base.node-docker-actions"] == $node
    and .[0].Config.Labels["io.211api.source.dockerfile-sha256"] == $hash
  ' >/dev/null

docker run --rm --network none --read-only \
  --cap-drop ALL --security-opt no-new-privileges:true \
  "$test_image" /bin/sh -ec '
    test "$(node --version)" = v24.18.0
    test "$(docker --version | awk "{print \$3}" | tr -d ,)" = 29.6.1
    docker buildx version >/dev/null
    docker compose version >/dev/null
    command -v apk >/dev/null
    test ! -e /bin/bash
  '

printf 'Docker Actions job image contract passed\n'
