#!/usr/bin/env bash

set -euo pipefail

readonly ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly CI="$ROOT/.gitea/workflows/ci.yml"
readonly SECURITY="$ROOT/.gitea/workflows/security.yml"
readonly DEPLOY="$ROOT/.gitea/workflows/deploy.yml"
readonly RELEASE="$ROOT/.gitea/workflows/release.yml"
readonly LOCK="$ROOT/.gitea/actions.lock"
readonly CHECKOUT_ACTION=https://github.com/actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10
readonly CACHE_ACTION=https://github.com/actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830

on_section() {
  awk '
    $0 == "\"on\":" { inside = 1; print; next }
    inside && /^[^[:space:]]/ { exit }
    inside { print }
  ' "$1"
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

job_section() {
  local file=$1
  local job=$2
  awk -v header="  $job:" '
    $0 == header { inside = 1 }
    inside && $0 != header && /^  [a-z_]+:$/ { exit }
    inside { print }
  ' "$file"
}

dispatcher_commands() {
  sed -n -E \
    's#^[[:space:]]*- run: (GITEA_CI=true )?\./tools/gitea-ci\.sh ([a-z-]+)$#\2#p' \
    "$1"
}

assert_exact() {
  local description=$1
  local actual=$2
  local expected=$3
  if ! diff -u <(printf '%s\n' "$expected") <(printf '%s\n' "$actual"); then
    printf 'workflow contract drifted: %s\n' "$description" >&2
    return 1
  fi
}

assert_exact 'ci trigger' "$(on_section "$CI")" "$(printf '%s\n' \
  '"on":' \
  '  push:' \
  '    branches-ignore:' \
  '      - main')"
assert_exact 'security trigger' "$(on_section "$SECURITY")" "$(printf '%s\n' \
  '"on":' \
  '  push:' \
  '    branches-ignore:' \
  '      - main' \
  '  schedule:' \
  '    - cron: "0 3 * * 1"')"
assert_exact 'deploy trigger' "$(on_section "$DEPLOY")" "$(printf '%s\n' \
  '"on":' \
  '  push:' \
  '    branches:' \
  '      - main')"
assert_exact 'release trigger' "$(on_section "$RELEASE")" "$(printf '%s\n' \
  '"on":' \
  '  push:' \
  '    branches:' \
  '      - "release/v*"' \
  '    tags:' \
  '      - "v*"')"

assert_exact 'ci jobs' "$(job_names "$CI")" "$(printf '%s\n' backend required)"
assert_exact 'security jobs' "$(job_names "$SECURITY")" "$(printf '%s\n' backend required)"
assert_exact 'deploy jobs' "$(job_names "$DEPLOY")" \
  "$(printf '%s\n' backend verify build_deploy notify)"

assert_exact 'ci dispatcher sequence' "$(dispatcher_commands "$CI")" \
  "$(printf '%s\n' shell-syntax backend-unit backend-integration lint frontend)"
assert_exact 'security dispatcher sequence' "$(dispatcher_commands "$SECURITY")" \
  "$(printf '%s\n' security-backend security-frontend)"
assert_exact 'deploy dispatcher sequence' "$(dispatcher_commands "$DEPLOY")" \
  "$(printf '%s\n' shell-syntax backend-unit backend-integration lint security-backend frontend-all)"

for workflow in "$CI" "$SECURITY"; do
  required_section="$(job_section "$workflow" required)"
  grep -Fx '    if: always()' <<<"$required_section" >/dev/null
  grep -Fx '    needs: backend' <<<"$required_section" >/dev/null
  grep -Fx '    runs-on: node-20.20.2' <<<"$required_section" >/dev/null
  gate_line="$(grep -n -F 'name: Require backend to succeed' <<<"$required_section" | cut -d: -f1)"
  checkout_line="$(grep -n -F "uses: $CHECKOUT_ACTION" <<<"$required_section" | cut -d: -f1)"
  [[ "$gate_line" -lt "$checkout_line" ]]
done

verify_section="$(job_section "$DEPLOY" verify)"
grep -Fx '    if: always()' <<<"$verify_section" >/dev/null
grep -Fx '    needs: backend' <<<"$verify_section" >/dev/null
grep -Fx '    runs-on: node-20.20.2' <<<"$verify_section" >/dev/null
verify_gate_line="$(grep -n -F 'name: Require backend to succeed' <<<"$verify_section" | cut -d: -f1)"
verify_checkout_line="$(grep -n -F "uses: $CHECKOUT_ACTION" <<<"$verify_section" | cut -d: -f1)"
[[ "$verify_gate_line" -lt "$verify_checkout_line" ]]

build_section="$(job_section "$DEPLOY" build_deploy)"
assert_exact 'build-and-deploy needs' \
  "$(sed -n '/^    needs:$/,/^    runs-on:/p' <<<"$build_section" | sed '$d')" \
  "$(printf '%s\n' '    needs:' '      - verify')"
notify_section="$(job_section "$DEPLOY" notify)"
grep -Fx '    if: always()' <<<"$notify_section" >/dev/null
assert_exact 'notification needs' \
  "$(sed -n '/^    needs:$/,/^    runs-on:/p' <<<"$notify_section" | sed '$d')" \
  "$(printf '%s\n' '    needs:' '      - verify' '      - build_deploy')"

for workflow in "$CI" "$SECURITY" "$DEPLOY"; do
  [[ "$(grep -Fc "uses: $CACHE_ACTION" "$workflow")" -eq 2 ]]
  [[ "$(grep -Fc 'continue-on-error: true' "$workflow")" -eq 2 ]]
  [[ "$(grep -Fc '>>"$GITEA_OUTPUT"' "$workflow")" -eq 2 ]]
  awk -v action="        uses: $CACHE_ACTION" '
    $0 == action && previous != "        continue-on-error: true" { exit 1 }
    { previous = $0 }
  ' "$workflow"
done
[[ "$(grep -Fc 'go-cache-hit=' "$CI")" -eq 1 ]]
[[ "$(grep -Fc 'pnpm-cache-hit=' "$CI")" -eq 1 ]]
[[ "$(grep -Fc 'go-cache-hit=' "$SECURITY")" -eq 1 ]]
[[ "$(grep -Fc 'pnpm-cache-hit=' "$SECURITY")" -eq 1 ]]
[[ "$(grep -Fc 'go-cache-hit=' "$DEPLOY")" -eq 1 ]]
[[ "$(grep -Fc 'pnpm-cache-hit=' "$DEPLOY")" -eq 1 ]]

if rg -n 'pull_request' "$ROOT/.gitea/workflows"; then
  printf 'active workflow still handles pull_request\n' >&2
  exit 1
fi

[[ "$(wc -l <"$LOCK")" -eq 2 ]]
grep -Fx 'https://github.com/actions/checkout df4cb1c069e1874edd31b4311f1884172cec0e10 v6.0.3' "$LOCK" >/dev/null
grep -Fx 'https://github.com/actions/cache 0057852bfaa89a56745cba8c7296529d2fc39830 v4.3.0' "$LOCK" >/dev/null
[[ -z "$(awk '{ print $1 " " $2 }' "$LOCK" | sort | uniq -d)" ]]
while read -r url sha version; do
  [[ "$url" =~ ^https:// && "$sha" =~ ^[0-9a-f]{40}$ && -n "$version" ]]
  [[ "$(rg -F "uses: $url@$sha" "$ROOT/.gitea/workflows" | wc -l)" -gt 0 ]]
done <"$LOCK"
while read -r use; do
  url="${use%@*}"
  sha="${use##*@}"
  [[ "$url" =~ ^https:// && "$sha" =~ ^[0-9a-f]{40}$ ]]
  [[ "$(awk -v u="$url" -v s="$sha" '$1 == u && $2 == s { count++ } END { print count + 0 }' "$LOCK")" -eq 1 ]]
done < <(sed -n \
  's/^[[:space:]]*-[[:space:]]*uses:[[:space:]]*//p; s/^[[:space:]]*uses:[[:space:]]*//p' \
  "$ROOT"/.gitea/workflows/*.yml)

for context in 'ci / required (push)' 'security / required (push)'; do
  grep -Fx "$context" "$ROOT/deploy/gitea/admin/configure-repository" >/dev/null
  rg -F "$context" "$ROOT/deploy/gitea/admin/admin-lib.sh" \
    "$ROOT/deploy/gitea/admin/verify-repository" >/dev/null
done

if rg -n 'restore-keys|/var/run/docker\.sock|tcp://|2375|2376' \
  "$ROOT/.gitea/workflows" \
  "$ROOT/deploy/gitea/runner/compose.yaml" \
  "$ROOT/deploy/gitea/runner/config.yaml"; then
  printf 'workflow or Runner runtime config contains a prohibited cache/Docker fallback\n' >&2
  exit 1
fi

printf 'workflow contract tests passed.\n'
