#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
BACKEND_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(CDPATH= cd -- "$BACKEND_DIR/.." && pwd)"
VERSION_FILE=${VERSION_FILE:-"$BACKEND_DIR/cmd/server/VERSION"}
EXPECTED_VERSION=
BRANCH_NAME=${GITHUB_HEAD_REF:-}

usage() {
  cat <<'EOF'
Usage: verify-version.sh [--expected X.Y.Z] [--branch NAME] [--version-file PATH]

Verify that VERSION is a canonical release version. On sync/upstream-X.Y.Z
branches, VERSION must also match X.Y.Z. A leading v is accepted for an
explicit expected version and normalized before comparison.
EOF
}

fail() {
  printf 'VERSION integrity check failed: %s\n' "$*" >&2
  exit 1
}

is_release_version() {
  printf '%s\n' "$1" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'
}

normalize_expected() {
  value=$1
  case "$value" in
    v*) value=${value#v} ;;
  esac
  is_release_version "$value" || fail "expected version '$1' is not a release semver (X.Y.Z)"
  printf '%s\n' "$value"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --expected)
      [ "$#" -ge 2 ] || fail "--expected requires a value"
      EXPECTED_VERSION=$2
      shift 2
      ;;
    --branch)
      [ "$#" -ge 2 ] || fail "--branch requires a value"
      BRANCH_NAME=$2
      shift 2
      ;;
    --version-file)
      [ "$#" -ge 2 ] || fail "--version-file requires a path"
      VERSION_FILE=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument '$1'"
      ;;
  esac
done

[ -f "$VERSION_FILE" ] || fail "VERSION file not found: $VERSION_FILE"

line_count=$(awk 'END { print NR + 0 }' "$VERSION_FILE")
[ "$line_count" -eq 1 ] || fail "VERSION file must contain exactly one line: $VERSION_FILE"

ACTUAL_VERSION=$(awk 'NR == 1 { sub(/\r$/, ""); print }' "$VERSION_FILE")
is_release_version "$ACTUAL_VERSION" || fail "actual version '$ACTUAL_VERSION' is not canonical release semver X.Y.Z"

if [ -n "$EXPECTED_VERSION" ]; then
  EXPECTED_VERSION=$(normalize_expected "$EXPECTED_VERSION")
else
  if [ -z "$BRANCH_NAME" ] && command -v git >/dev/null 2>&1; then
    BRANCH_NAME=$(git -C "$REPO_DIR" branch --show-current 2>/dev/null || true)
  fi
  if [ -z "$BRANCH_NAME" ]; then
    BRANCH_NAME=${GITHUB_REF_NAME:-}
  fi

  case "$BRANCH_NAME" in
    sync/upstream-v*)
      fail "sync branch '$BRANCH_NAME' must be named sync/upstream-X.Y.Z without a v prefix"
      ;;
    sync/upstream-*)
      EXPECTED_VERSION=$(normalize_expected "${BRANCH_NAME#sync/upstream-}")
      ;;
    sync/upstream*)
      fail "sync branch '$BRANCH_NAME' must be named sync/upstream-X.Y.Z"
      ;;
    *)
      EXPECTED_VERSION=$ACTUAL_VERSION
      ;;
  esac
fi

if [ "$ACTUAL_VERSION" != "$EXPECTED_VERSION" ]; then
  fail "expected=$EXPECTED_VERSION actual=$ACTUAL_VERSION; update backend/cmd/server/VERSION before merging"
fi

printf 'VERSION integrity check passed: expected=%s actual=%s' "$EXPECTED_VERSION" "$ACTUAL_VERSION"
if [ -n "$BRANCH_NAME" ]; then
  printf ' branch=%s' "$BRANCH_NAME"
fi
printf '\n'
