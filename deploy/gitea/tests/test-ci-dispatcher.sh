#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly DISPATCHER="$REPO_ROOT/tools/gitea-ci.sh"
readonly TEST_ROOT="$(mktemp -d)"
readonly FAKE_BIN="$TEST_ROOT/bin"
readonly COMMAND_LOG="$TEST_ROOT/commands.log"
readonly STUB="$FAKE_BIN/stub"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN" "$TEST_ROOT/tmp"

printf '%s\n' \
  '#!/bin/bash' \
  'set -euo pipefail' \
  'command_name="${0##*/}"' \
  'display_pwd="${PWD/#$CI_TEST_REPO/<repo>}"' \
  'printf "%s|%s" "$command_name" "$display_pwd" >>"$CI_TEST_LOG"' \
  'for argument in "$@"; do' \
  '  if [[ "$argument" == "$CI_TEST_TMP/"* ]]; then' \
  '    argument="<tmp>"' \
  '  fi' \
  '  printf "|%s" "$argument" >>"$CI_TEST_LOG"' \
  'done' \
  'if [[ "$command_name:$*" == "make:-C backend test-integration" && "${GITEA_CI:-}" == true ]]; then' \
  '  printf "|tc-host=%s|tc-socket=%s" "$TESTCONTAINERS_HOST_OVERRIDE" "$TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE" >>"$CI_TEST_LOG"' \
  'fi' \
  'if [[ "$command_name:$*" == go:install\ github.com/golangci/golangci-lint/* ]]; then' \
  '  printf "|gomaxprocs=%s" "${GOMAXPROCS:-}" >>"$CI_TEST_LOG"' \
  'fi' \
  'if [[ "$command_name:$*" == "golangci-lint:run --timeout=30m" ]]; then' \
  '  printf "|gomaxprocs=%s" "${GOMAXPROCS:-}" >>"$CI_TEST_LOG"' \
  'fi' \
  'printf "\\n" >>"$CI_TEST_LOG"' \
  'case "$command_name:$*" in' \
  '  "go:version") printf "%s\\n" "go version go1.26.5 linux/amd64" ;;' \
  '  "go:install "*)' \
  '    case "$2" in' \
  '      github.com/golangci/golangci-lint/v2/cmd/golangci-lint@*) tool=golangci-lint ;;' \
  '      golang.org/x/vuln/cmd/govulncheck@*) tool=govulncheck ;;' \
  '      *) printf "%s\\n" "unexpected go install target: $2" >&2; exit 1 ;;' \
  '    esac' \
  '    install -m 0755 "$CI_TEST_STUB" "$GOBIN/$tool"' \
  '    ;;' \
  '  "node:--version") printf "%s\\n" "v20.20.2" ;;' \
  '  "pnpm:audit "*) printf "%s\\n" "{}" ;;' \
  '  "bash:-n "*) exec /bin/bash "$@" ;;' \
  'esac' \
  >"$STUB"
chmod 0755 "$STUB"

for command_name in go node corepack pnpm make python3 bash; do
  ln -s stub "$FAKE_BIN/$command_name"
done

export CI_TEST_LOG="$COMMAND_LOG"
export CI_TEST_REPO="$REPO_ROOT"
export CI_TEST_TMP="$TEST_ROOT/tmp"
export CI_TEST_STUB="$STUB"
export TMPDIR="$CI_TEST_TMP"

assert_log() {
  local expected="$1"
  local expected_file="$TEST_ROOT/expected.log"
  printf '%s\n' "$expected" >"$expected_file"
  if ! diff -u "$expected_file" "$COMMAND_LOG"; then
    printf 'dispatcher command log did not match\n' >&2
    return 1
  fi
}

run_case() {
  local case_name="$1"
  local expected="$2"
  : >"$COMMAND_LOG"
  PATH="$FAKE_BIN:$PATH" /bin/bash "$DISPATCHER" "$case_name"
  assert_log "$expected"
}

run_case backend-unit "$(printf '%s\n' \
  'go|<repo>|version' \
  'make|<repo>|-C|backend|test-unit')"

run_case backend-integration "$(printf '%s\n' \
  'go|<repo>|version' \
  'make|<repo>|-C|backend|test-integration')"

: >"$COMMAND_LOG"
GITEA_CI=true PATH="$FAKE_BIN:$PATH" /bin/bash "$DISPATCHER" backend-integration
assert_log "$(printf '%s\n' \
  'go|<repo>|version' \
  'make|<repo>|-C|backend|test-integration|tc-host=docker|tc-socket=/run/user/1000/docker.sock')"

: >"$COMMAND_LOG"
set +e
GITEA_CI=true TESTCONTAINERS_HOST_OVERRIDE=203.0.113.1 \
  PATH="$FAKE_BIN:$PATH" /bin/bash "$DISPATCHER" backend-integration \
  >"$TEST_ROOT/testcontainers-drift.out" 2>"$TEST_ROOT/testcontainers-drift.err"
testcontainers_drift_status=$?
set -e
if [[ "$testcontainers_drift_status" -eq 0 ]]; then
  printf 'Dispatcher accepted a drifting Testcontainers host override\n' >&2
  exit 1
fi
assert_log 'go|<repo>|version'
if ! grep -q 'does not match the isolated DinD service' "$TEST_ROOT/testcontainers-drift.err"; then
  printf 'Dispatcher did not explain the Testcontainers host drift\n' >&2
  exit 1
fi

: >"$COMMAND_LOG"
set +e
GITEA_CI=true TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock \
  PATH="$FAKE_BIN:$PATH" /bin/bash "$DISPATCHER" backend-integration \
  >"$TEST_ROOT/testcontainers-socket-drift.out" \
  2>"$TEST_ROOT/testcontainers-socket-drift.err"
testcontainers_socket_drift_status=$?
set -e
if [[ "$testcontainers_socket_drift_status" -eq 0 ]]; then
  printf 'Dispatcher accepted a drifting Testcontainers socket override\n' >&2
  exit 1
fi
assert_log 'go|<repo>|version'
if ! grep -q 'does not match the isolated DinD socket' \
  "$TEST_ROOT/testcontainers-socket-drift.err"; then
  printf 'Dispatcher did not explain the Testcontainers socket drift\n' >&2
  exit 1
fi

run_case frontend "$(printf '%s\n' \
  'node|<repo>|--version' \
  'corepack|<repo>|enable' \
  'corepack|<repo>|prepare|pnpm@9.15.9|--activate' \
  'pnpm|<repo>/frontend|install|--frozen-lockfile' \
  'make|<repo>|test-frontend')"

run_case lint "$(printf '%s\n' \
  'go|<repo>|version' \
  'go|<repo>|install|github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.9.0|gomaxprocs=1' \
  'golangci-lint|<repo>/backend|run|--timeout=30m|gomaxprocs=1')"

run_case security-backend "$(printf '%s\n' \
  'go|<repo>|version' \
  'go|<repo>|install|golang.org/x/vuln/cmd/govulncheck@v1.6.0' \
  'govulncheck|<repo>/backend|./...')"

run_case security-frontend "$(printf '%s\n' \
  'node|<repo>|--version' \
  'corepack|<repo>|enable' \
  'corepack|<repo>|prepare|pnpm@9.15.9|--activate' \
  'pnpm|<repo>/frontend|install|--frozen-lockfile' \
  'pnpm|<repo>/frontend|audit|--prod|--audit-level=high|--json' \
  'python3|<repo>|tools/check_pnpm_audit_exceptions.py|--audit|<tmp>|--exceptions|.gitea/audit-exceptions.yml')"

shell_expected='bash|<repo>|-n|--'
while IFS= read -r path; do
  shell_expected+="|$path"
done < <(cd "$REPO_ROOT" && git ls-files -- '*.sh')
while IFS= read -r path; do
  basename="${path##*/}"
  [[ "$basename" == *.* || ! -f "$REPO_ROOT/$path" ]] && continue
  IFS= read -r first_line <"$REPO_ROOT/$path" || true
  [[ "$first_line" == '#!'* ]] || continue
  shell_expected+="|$path"
done < <(cd "$REPO_ROOT" && git ls-files -- deploy/gitea)

for required_shell_path in \
  backend/scripts/resolve-version.sh \
  deploy/apple-container.sh \
  deploy/tests/apple-container-test.sh \
  deploy/gitea/tests/test-ci-dispatcher.sh \
  tools/gitea-ci.sh; do
  if [[ "${shell_expected}|" != *"|${required_shell_path}|"* ]]; then
    printf 'required shell path was not selected: %s\n' "$required_shell_path" >&2
    exit 1
  fi
done
run_case shell-syntax "$shell_expected"

: >"$COMMAND_LOG"
set +e
PATH="$FAKE_BIN:$PATH" /bin/bash "$DISPATCHER" unknown >"$TEST_ROOT/unknown.out" 2>"$TEST_ROOT/unknown.err"
unknown_status=$?
set -e
if [[ "$unknown_status" -ne 64 ]]; then
  printf 'unknown dispatcher command returned %s, expected 64\n' "$unknown_status" >&2
  exit 1
fi
if [[ -s "$COMMAND_LOG" ]]; then
  printf 'unknown dispatcher command executed a tool\n' >&2
  exit 1
fi
if ! grep -q '^Usage:' "$TEST_ROOT/unknown.err"; then
  printf 'unknown dispatcher command did not print usage\n' >&2
  exit 1
fi

printf 'CI dispatcher fixture tests passed.\n'
