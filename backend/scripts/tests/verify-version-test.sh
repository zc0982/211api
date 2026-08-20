#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
VERIFY_SCRIPT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)/verify-version.sh"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM
VERSION_FILE="$TMP_DIR/VERSION"
PASSED=0

pass_case() {
  name=$1
  shift
  if output=$("$VERIFY_SCRIPT" --version-file "$VERSION_FILE" "$@" 2>&1); then
    PASSED=$((PASSED + 1))
    printf 'ok %s - %s\n' "$PASSED" "$name"
  else
    printf 'not ok - %s\n%s\n' "$name" "$output" >&2
    exit 1
  fi
}

fail_case() {
  name=$1
  expected_text=$2
  shift 2
  if output=$("$VERIFY_SCRIPT" --version-file "$VERSION_FILE" "$@" 2>&1); then
    printf 'not ok - %s unexpectedly passed\n%s\n' "$name" "$output" >&2
    exit 1
  fi
  printf '%s\n' "$output" | grep -Fq "$expected_text" || {
    printf 'not ok - %s returned the wrong failure\n%s\n' "$name" "$output" >&2
    exit 1
  }
  PASSED=$((PASSED + 1))
  printf 'ok %s - %s\n' "$PASSED" "$name"
}

printf '0.1.178\n' > "$VERSION_FILE"
fail_case 'sync target rejects stale VERSION' 'expected=0.1.179 actual=0.1.178' \
  --branch sync/upstream-0.1.179

printf '0.1.179\n' > "$VERSION_FILE"
pass_case 'sync target accepts matching VERSION' --branch sync/upstream-0.1.179
pass_case 'explicit v-prefixed target is normalized' --expected v0.1.179
pass_case 'ordinary branch validates its declared VERSION' --branch fix/example

fail_case 'pre-release expected version is rejected' 'is not a release semver' \
  --expected 0.1.179-rc.1
fail_case 'malformed sync branch is rejected' 'is not a release semver' \
  --branch sync/upstream-release-0.1.179
fail_case 'v-prefixed sync branch is rejected' 'without a v prefix' \
  --branch sync/upstream-v0.1.179

printf 'v0.1.179\n' > "$VERSION_FILE"
fail_case 'VERSION file must use canonical form' 'is not canonical release semver' \
  --expected 0.1.179

printf '0.1.179\nextra\n' > "$VERSION_FILE"
fail_case 'VERSION file rejects extra lines' 'must contain exactly one line' \
  --expected 0.1.179

: > "$VERSION_FILE"
fail_case 'VERSION file rejects empty content' 'must contain exactly one line' \
  --expected 0.1.179

printf '0.1.179' > "$VERSION_FILE"
pass_case 'single canonical line may omit trailing newline' --expected 0.1.179

printf '1..%s\n' "$PASSED"
