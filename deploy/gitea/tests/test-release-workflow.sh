#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
readonly WORKFLOW="$REPO_ROOT/.gitea/workflows/release.yml"

require_literal() {
  local literal=$1
  grep -F -- "$literal" "$WORKFLOW" >/dev/null || {
    printf 'release workflow lost required gate: %s\n' "$literal" >&2
    return 1
  }
}

forbid_literal() {
  local literal=$1
  if grep -F -- "$literal" "$WORKFLOW" >/dev/null; then
    printf 'release workflow retained invalid actor gate: %s\n' "$literal" >&2
    return 1
  fi
}

require_literal 'EVENT_ACTOR: ${{ gitea.actor }}'
require_literal '[[ "$EVENT_BEFORE" == "$zero_sha" ]]'
require_literal '[[ "$EVENT_ACTOR" =~ ^[0-9A-Za-z_.-]+$ ]]'
require_literal 'request_branch="${EVENT_REF#refs/heads/}"'
require_literal '$value | @uri'
require_literal 'api_get "$api_url/repos/211api/211api/branches/$encoded_request_branch"'
require_literal 'select(.name == $branch and .protected == true)'
require_literal '[[ "$request_sha" == "$EVENT_SHA" ]]'
require_literal '[[ "$main_sha" == "$EVENT_SHA" ]]'
require_literal '[[ "$(git rev-parse HEAD)" == "$EVENT_SHA" ]]'
require_literal '[[ "$tag" == "v$version" || "$tag" == "v$version-"* ]]'
require_literal 'and (has("manifests") | not)'
require_literal '.architecture == "amd64"'
require_literal '.config.Labels["org.opencontainers.image.revision"] == $sha'
require_literal '[[ "$tag_status" == 404 ]]'

forbid_literal 'api_get "$api_url/user"'
forbid_literal '.login == $actor'
forbid_literal 'api_get "$api_url/user/teams"'

request_branch='release/v0.1.160-gitea-smoke.2'
encoded_request_branch="$(jq -nr --arg value "$request_branch" '$value | @uri')"
[[ "$encoded_request_branch" == 'release%2Fv0.1.160-gitea-smoke.2' ]]

request_sha='28d190bab7edc10d1829dd5519f760871c056983'
request_json="$(jq -cn \
  --arg branch "$request_branch" \
  --arg sha "$request_sha" \
  '{name: $branch, protected: true, commit: {id: $sha}}')"
parsed_request_sha="$(jq -er --arg branch "$request_branch" '
  select(.name == $branch and .protected == true)
  | .commit.id
  | select(type == "string" and test("^[0-9a-f]{40}$"))
' <<<"$request_json")"
[[ "$parsed_request_sha" == "$request_sha" ]]

if jq -e --arg branch "$request_branch" '
  select(.name == $branch and .protected == true)
' >/dev/null <<<"${request_json/true/false}"; then
  printf 'release workflow fixture accepted an unprotected request branch\n' >&2
  exit 1
fi

printf 'release workflow actor and publication gates passed\n'
