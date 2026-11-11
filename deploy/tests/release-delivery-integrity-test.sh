#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$repo_root"

fail() {
  printf 'release delivery integrity test failed: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  file=$1
  text=$2
  grep -Fq "$text" "$file" || fail "$file is missing: $text"
}

# A passing CI toolchain alone cannot protect release images built with an old
# standard library. Keep every build entry aligned with the go.mod baseline.
go_version=$(awk '$1 == "go" { print $2; exit }' backend/go.mod)
[ -n "$go_version" ] || fail 'backend/go.mod must declare a Go version'
for file in Dockerfile deploy/Dockerfile; do
  assert_contains "$file" "ARG GOLANG_IMAGE=golang:${go_version}-alpine"
done
assert_contains backend/Dockerfile "FROM golang:${go_version}-alpine"
for file in .github/workflows/backend-ci.yml .github/workflows/release.yml .github/workflows/security-scan.yml; do
  assert_contains "$file" "go version | grep -q 'go${go_version}'"
  if grep -F 'go version | grep -q' "$file" | grep -Fv "'go${go_version}'" >/dev/null; then
    fail "$file has a Go version assertion inconsistent with go.mod"
  fi
done
assert_contains .github/workflows/security-scan.yml 'run: make test-security'

assert_contains .github/workflows/backend-ci.yml "run: make test-version-integrity"
assert_contains .github/workflows/backend-ci.yml "if: needs.changes.outputs.backend == 'true'"
assert_contains .github/workflows/backend-ci.yml "needs: [changes, shell, test, race-service, frontend, golangci-lint, release-helpers]"
assert_contains .github/workflows/deploy.yml 'ref: ${{ github.sha }}'
assert_contains .github/workflows/deploy.yml 'VERSION=${{ steps.version.outputs.value }}'
assert_contains .github/workflows/deploy.yml 'COMMIT=${{ github.sha }}'
assert_contains .github/workflows/deploy.yml 'docker compose exec -T sub2api /app/sub2api --version'
assert_contains deploy/docker-compose.local.yml 'image: ${SUB2API_IMAGE:-weishaw/sub2api:latest}'

race_block=$(awk '
  /^  race-service:$/ { in_job = 1 }
  in_job && /^  [[:alnum:]_-]+:$/ && $0 != "  race-service:" { exit }
  in_job { print }
' .github/workflows/backend-ci.yml)

printf '%s\n' "$race_block" | grep -Fq "if: needs.changes.outputs.backend == 'true'" || \
  fail 'race-service must run for every backend PR and main push'
printf '%s\n' "$race_block" | grep -Fq 'run: make test-race-service' || \
  fail 'race-service must call the shared Make target'
if printf '%s\n' "$race_block" | grep -Fq "github.event_name == 'push'"; then
  fail 'race-service must not be restricted to main push'
fi

printf 'release delivery integrity test passed\n'
