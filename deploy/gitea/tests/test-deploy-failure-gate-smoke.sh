#!/usr/bin/env bash

set -euo pipefail

ROOT="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly ROOT
readonly DEPLOY="$ROOT/.gitea/workflows/deploy.yml"
readonly RENDERER="$ROOT/deploy/gitea/tests/render-deploy-failure-gate-smoke.sh"
readonly SMOKE_BRANCH=ci-smoke-fail-gate-0123456789abcdef
readonly DANGEROUS_PATTERN='(^|[^[:alnum:]_])(curl|wget|ssh|scp|sftp|rsync|nc|netcat|socat|telnet)([^[:alnum:]_]|$)|(^|[[:space:];|&])(docker|podman|buildah|nerdctl)[[:space:]]|(^|[[:space:]])git[[:space:]]+(clone|fetch|pull|push)([[:space:]]|$)|(^|[[:space:]])uses:[[:space:]]|[[:alpha:]][[:alnum:]+.-]*://|\$\{\{[[:space:]]*secrets\.|fetch[[:space:]]*\(|--push([^[:alnum:]_-]|$)|buildx|imagetools|pipedream|gateway|webhook|157\.254\.234\.244|git\.211api\.com'
readonly BACKEND_SUCCESS_ASSERT="          [[ \"\$BACKEND_RESULT\" == success ]]"
readonly VERIFY_FAILURE_ASSERT="          [[ \"\$VERIFY_RESULT\" == failure ]]"
readonly BUILD_SKIPPED_ASSERT="          [[ \"\$BUILD_DEPLOY_RESULT\" == skipped ]]"
readonly BUILD_RESULT_ENV="          BUILD_DEPLOY_RESULT: \${{ needs.build_deploy.result }}"

tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT

fail() {
  printf 'deploy failure-gate smoke contract failed: %s\n' "$1" >&2
  exit 1
}

job_section() {
  local file=$1
  local job=$2
  awk -v header="  $job:" '
    $0 == header { inside = 1 }
    inside && $0 != header && /^  [a-z_]+:$/ { exit }
    inside { print }
  ' "$file"
}

job_names() {
  awk '
    /^jobs:/ { in_jobs = 1; next }
    in_jobs && /^[^[:space:]]/ { exit }
    in_jobs && /^  [a-z_]+:$/ {
      name = $0
      sub(/^  /, "", name)
      sub(/:$/, "", name)
      print name
    }
  ' "$1"
}

job_needs() {
  awk '
    /^    needs:/ { inside = 1 }
    inside && $0 !~ /^    needs:/ && /^    [^[:space:]]/ { exit }
    inside { print }
  ' <<<"$1"
}

job_if() {
  grep -E '^    if:' <<<"$1" || true
}

assert_exact() {
  local description=$1
  local actual=$2
  local expected=$3
  if [[ "$actual" != "$expected" ]]; then
    diff -u <(printf '%s\n' "$expected") <(printf '%s\n' "$actual") >&2 || true
    fail "$description"
  fi
}

assert_deploy_graph() {
  local file=$1
  local label=$2
  local backend verify build notify

  assert_exact "$label job ids drifted" "$(job_names "$file")" \
    $'backend\nverify\nbuild_deploy\nnotify'

  backend="$(job_section "$file" backend)"
  verify="$(job_section "$file" verify)"
  build="$(job_section "$file" build_deploy)"
  notify="$(job_section "$file" notify)"

  assert_exact "$label backend must use default success semantics" "$(job_if "$backend")" ''
  assert_exact "$label backend may not depend on another job" "$(job_needs "$backend")" ''
  assert_exact "$label verify must always run" "$(job_if "$verify")" '    if: always()'
  assert_exact "$label verify needs drifted" "$(job_needs "$verify")" '    needs: backend'
  assert_exact "$label build_deploy must use default successful-needs gating" \
    "$(job_if "$build")" ''
  assert_exact "$label build_deploy needs drifted" "$(job_needs "$build")" \
    $'    needs:\n      - verify'
  assert_exact "$label notify must always run" "$(job_if "$notify")" '    if: always()'
  assert_exact "$label notify needs drifted" "$(job_needs "$notify")" \
    $'    needs:\n      - verify\n      - build_deploy'
}

assert_renderer_rejected() {
  local description=$1
  shift
  local status

  if "$RENDERER" "$@" >"$tmp/rejected.out" 2>"$tmp/rejected.err"; then
    status=0
  else
    status=$?
  fi
  [[ "$status" -eq 64 ]] || fail "$description did not exit 64"
  [[ ! -s "$tmp/rejected.out" ]] || fail "$description emitted a partial workflow"
  [[ "$(<"$tmp/rejected.err")" == \
    'usage: render-deploy-failure-gate-smoke.sh <exact-smoke-branch>' ]] ||
    fail "$description usage output drifted"
}

[[ -x "$RENDERER" ]] || fail 'renderer must be executable'
if sed '/^[[:space:]]*#/d' "$RENDERER" | rg -ni "$DANGEROUS_PATTERN"; then
  fail 'renderer source contains an external-action token'
fi
assert_renderer_rejected 'missing branch'
assert_renderer_rejected 'wildcard branch' 'ci-smoke-fail-gate-*'
assert_renderer_rejected 'main branch' main
assert_renderer_rejected 'multiple branches' "$SMOKE_BRANCH" ci-smoke-fail-gate-fedcba9876543210
"$RENDERER" "$SMOKE_BRANCH" >"$tmp/smoke.yml"

assert_exact 'smoke trigger is not one exact disposable branch' \
  "$(awk '
    $0 == "\"on\":" { inside = 1; print; next }
    inside && /^[^[:space:]]/ { exit }
    inside { print }
  ' "$tmp/smoke.yml")" \
  "$(printf '%s\n' '"on":' '  push:' '    branches:' "      - \"$SMOKE_BRANCH\"")"
if rg -ni "$DANGEROUS_PATTERN" "$tmp/smoke.yml"; then
  fail 'smoke workflow contains credentials, a URL, or an external-action token'
fi
assert_deploy_graph "$tmp/smoke.yml" smoke
assert_deploy_graph "$DEPLOY" production

smoke_backend="$(job_section "$tmp/smoke.yml" backend)"
smoke_verify="$(job_section "$tmp/smoke.yml" verify)"
smoke_build="$(job_section "$tmp/smoke.yml" build_deploy)"
smoke_notify="$(job_section "$tmp/smoke.yml" notify)"
grep -Fx '          exit 86' <<<"$smoke_backend" >/dev/null ||
  fail 'backend must fail with the dedicated sentinel'
grep -Fx '    if: always()' <<<"$smoke_verify" >/dev/null || fail 'verify must run after backend failure'
grep -Fx '    needs: backend' <<<"$smoke_verify" >/dev/null || fail 'verify must require backend'
grep -Fx "$BACKEND_SUCCESS_ASSERT" <<<"$smoke_verify" >/dev/null ||
  fail 'verify must preserve the hard backend gate'
grep -F 'failure-gate-smoke: backend-result=%s\n' <<<"$smoke_verify" >/dev/null ||
  fail 'verify must log the observed backend result'
grep -Fx '    runs-on: docker-29.6.1' <<<"$smoke_build" >/dev/null ||
  fail 'build sentinel must use the production Docker job image'
grep -Fx '        shell: sh' <<<"$smoke_build" >/dev/null ||
  fail 'unreachable Docker-image sentinel must use POSIX sh'
grep -Fx '          set -eu' <<<"$smoke_build" >/dev/null ||
  fail 'unreachable Docker-image sentinel must use POSIX shell options'
grep -Fx '          exit 99' <<<"$smoke_build" >/dev/null ||
  fail 'build sentinel must remain observable if the graph regresses'
[[ "$(grep -Fc '      - name:' <<<"$smoke_notify")" -eq 1 ]] ||
  fail 'smoke notify must contain only its local assertion step'
grep -Fx '          set -euo pipefail' <<<"$smoke_notify" >/dev/null ||
  fail 'notify assertions must remain fail-closed'
grep -Fx "$VERIFY_FAILURE_ASSERT" <<<"$smoke_notify" >/dev/null ||
  fail 'notify must assert the failed verification'
grep -Fx "$BUILD_SKIPPED_ASSERT" <<<"$smoke_notify" >/dev/null ||
  fail 'notify must assert build/deploy was skipped'
grep -F 'failure-gate-smoke: verify-result=%s build-deploy-result=%s\n' \
  <<<"$smoke_notify" >/dev/null || fail 'notify must log both asserted dependency results'

# Tie the disposable execution proof to production rather than merely testing
# an unrelated fixture.  Any production change that makes build_deploy run on
# a failed verify, or makes notification non-final, invalidates this test.
production_backend="$(job_section "$DEPLOY" backend)"
production_verify="$(job_section "$DEPLOY" verify)"
production_build="$(job_section "$DEPLOY" build_deploy)"
production_notify="$(job_section "$DEPLOY" notify)"
grep -Fx "$BACKEND_SUCCESS_ASSERT" <<<"$production_verify" >/dev/null ||
  fail 'production verify must hard-fail on backend failure'
assert_exact 'smoke backend runner does not match production' \
  "$(grep -E '^    runs-on:' <<<"$smoke_backend")" \
  "$(grep -E '^    runs-on:' <<<"$production_backend")"
assert_exact 'smoke verify runner does not match production' \
  "$(grep -E '^    runs-on:' <<<"$smoke_verify")" \
  "$(grep -E '^    runs-on:' <<<"$production_verify")"
assert_exact 'smoke build_deploy runner does not match production' \
  "$(grep -E '^    runs-on:' <<<"$smoke_build")" \
  "$(grep -E '^    runs-on:' <<<"$production_build")"
assert_exact 'smoke notify runner does not match production' \
  "$(grep -E '^    runs-on:' <<<"$smoke_notify")" \
  "$(grep -E '^    runs-on:' <<<"$production_notify")"
grep -Fx "$BUILD_RESULT_ENV" <<<"$production_notify" >/dev/null ||
  fail 'production notify must receive the build/deploy result'

printf 'deploy failure-gate smoke contract tests passed.\n'
