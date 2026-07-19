#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LOCK="$ROOT/deploy/gitea/images.lock.env"
STRICT_ENV="$ROOT/deploy/gitea/platform/strict-env.sh"
DOCKERFILE="$ROOT/deploy/gitea/runner/go-actions.Dockerfile"
tmp="$(mktemp -d)"
suffix="$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
test_image="211api-go-actions-test:$suffix"

cleanup() {
  docker image rm -f "$test_image" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# shellcheck source=deploy/gitea/platform/strict-env.sh
source "$STRICT_ENV"
gitea_load_image_lock "$LOCK"
[[ "$GO_ACTIONS_CI_IMAGE" =~ ^git\.211api\.com/211api/runner-go-actions:go1\.26\.5-node24\.18\.0-v[0-9]+@sha256:[0-9a-f]{64}$ ]]
docker image inspect "$test_image" >/dev/null 2>&1 && {
  printf 'random Go Actions test image already exists\n' >&2
  exit 1
}

dockerfile_hash="$(sha256sum "$DOCKERFILE")"
dockerfile_hash="${dockerfile_hash%% *}"
mkdir -m 0700 "$tmp/context"
if ! docker build --provenance=false \
  --build-arg "NODE_ACTIONS_BASE_IMAGE=$NODE_ACTIONS_BASE_IMAGE" \
  --build-arg "GO_CI_IMAGE=$GO_CI_IMAGE" \
  --build-arg "GO_ACTIONS_DOCKERFILE_SHA256=$dockerfile_hash" \
  --tag "$test_image" --file "$DOCKERFILE" "$tmp/context" \
  >"$tmp/build.log" 2>&1; then
  cat "$tmp/build.log" >&2
  exit 1
fi

docker image inspect "$test_image" | jq -e \
  --arg go "$GO_CI_IMAGE" \
  --arg node "$NODE_ACTIONS_BASE_IMAGE" \
  --arg hash "$dockerfile_hash" '
    length == 1
    and .[0].Config.Labels["io.211api.base.go"] == $go
    and .[0].Config.Labels["io.211api.base.node-actions"] == $node
    and .[0].Config.Labels["io.211api.source.dockerfile-sha256"] == $hash
  ' >/dev/null

docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  "$test_image" /bin/bash --noprofile --norc -ec '
    test "$(node --version)" = v24.18.0
    test "$(go version)" = "go version go1.26.5 linux/amd64"
    test -f /usr/local/share/licenses/node/LICENSE
    test -f /usr/local/share/doc/node/README.md
    test -f /usr/local/share/doc/node/CHANGELOG.md
  '

printf 'Go Actions job image contract passed\n'
