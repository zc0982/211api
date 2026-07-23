#!/usr/bin/env bash

set -euo pipefail

readonly ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly FIXTURE="$(mktemp -d)"
readonly INPUTS=(
  tools/gitea-cache-key.sh
  tools/gitea-ci.sh
  deploy/gitea/images.lock.env
  backend/go.mod
  backend/go.sum
  backend/.golangci.yml
  frontend/package.json
  frontend/pnpm-lock.yaml
)

cleanup() { rm -rf -- "$FIXTURE"; }
trap cleanup EXIT HUP INT TERM

for path in "${INPUTS[@]}"; do
  mkdir -p "$FIXTURE/$(dirname "$path")"
  cp "$ROOT/$path" "$FIXTURE/$path"
done
chmod +x "$FIXTURE/tools/gitea-cache-key.sh"

key() { (cd "$FIXTURE" && ./tools/gitea-cache-key.sh "$1"); }
readonly GO_BASELINE="$(key go)"
readonly PNPM_BASELINE="$(key pnpm)"
[[ "$GO_BASELINE" == "$(key go)" ]]
[[ "$PNPM_BASELINE" == "$(key pnpm)" ]]
[[ "$GO_BASELINE" != "$PNPM_BASELINE" ]]
[[ "$GO_BASELINE" =~ ^gitea-go-linux-amd64-v1-[0-9a-f]{64}$ ]]
[[ "$PNPM_BASELINE" =~ ^gitea-pnpm-linux-amd64-v1-[0-9a-f]{64}$ ]]

assert_input_scope() {
  local path=$1
  local changes_go=$2
  local changes_pnpm=$3
  local actual_go actual_pnpm

  printf '\n# cache-key fixture mutation\n' >>"$FIXTURE/$path"
  actual_go="$(key go)"
  actual_pnpm="$(key pnpm)"
  if [[ "$changes_go" == true ]]; then
    [[ "$actual_go" != "$GO_BASELINE" ]]
  else
    [[ "$actual_go" == "$GO_BASELINE" ]]
  fi
  if [[ "$changes_pnpm" == true ]]; then
    [[ "$actual_pnpm" != "$PNPM_BASELINE" ]]
  else
    [[ "$actual_pnpm" == "$PNPM_BASELINE" ]]
  fi
  cp "$ROOT/$path" "$FIXTURE/$path"
}

for path in tools/gitea-cache-key.sh tools/gitea-ci.sh deploy/gitea/images.lock.env; do
  assert_input_scope "$path" true true
done
for path in backend/go.mod backend/go.sum backend/.golangci.yml; do
  assert_input_scope "$path" true false
done
for path in frontend/package.json frontend/pnpm-lock.yaml; do
  assert_input_scope "$path" false true
done

assert_usage_failure() {
  local expected_status=$1
  shift
  local output status
  set +e
  output="$(cd "$FIXTURE" && ./tools/gitea-cache-key.sh "$@" 2>/dev/null)"
  status=$?
  set -e
  [[ "$status" -eq "$expected_status" && -z "$output" ]]
}

assert_usage_failure 64
assert_usage_failure 64 unknown
assert_usage_failure 64 go extra

mv "$FIXTURE/backend/go.mod" "$FIXTURE/backend/go.mod.missing"
assert_usage_failure 1 go
mv "$FIXTURE/backend/go.mod.missing" "$FIXTURE/backend/go.mod"
rm "$FIXTURE/backend/go.mod"
ln -s go.sum "$FIXTURE/backend/go.mod"
assert_usage_failure 1 go

printf 'CI cache-key fixture tests passed.\n'
