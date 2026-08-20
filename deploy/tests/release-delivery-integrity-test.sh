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

assert_contains .github/workflows/backend-ci.yml "run: make test-version-integrity"
assert_contains .github/workflows/backend-ci.yml "if: needs.changes.outputs.backend == 'true'"
assert_contains .github/workflows/backend-ci.yml "needs: [changes, shell, test, race-service, frontend, golangci-lint]"
assert_contains .github/workflows/deploy.yml 'ref: ${{ github.sha }}'
assert_contains .github/workflows/deploy.yml 'VERSION=${{ steps.version.outputs.value }}'
assert_contains .github/workflows/deploy.yml 'COMMIT=${{ github.sha }}'
assert_contains .github/workflows/deploy.yml 'docker compose exec -T sub2api /app/sub2api --version'

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
