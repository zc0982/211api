#!/usr/bin/env bash

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)
# shellcheck source=../admin/admin-lib.sh
source "$ROOT/deploy/gitea/admin/admin-lib.sh"
tmp=$(mktemp -d)

cleanup() {
  rm -rf -- "$tmp"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
  printf 'admin primitive test: %s\n' "$*" >&2
  exit 1
}

pagination_calls="$tmp/pagination.calls"
gitea_api_status() {
  local _config=$1 _method=$2 path=$3 output=$4
  local page
  page=${path##*page=}
  page=${page%%&*}
  printf '%s\n' "$page" >>"$pagination_calls"
  case "$page" in
    1) jq -n '[range(1; 51) | {id:.}]' >"$output" ;;
    2) jq -n '[{id:51}]' >"$output" ;;
    *) printf '[]\n' >"$output" ;;
  esac
  printf '200'
}

gitea_api_get_all unused /objects "$tmp/all.json" "$tmp" pagination
jq -e 'length == 51 and .[0].id == 1 and .[50].id == 51' \
  "$tmp/all.json" >/dev/null || fail 'pagination lost or reordered rows'
[[ $(wc -l <"$pagination_calls") -eq 2 ]] || fail 'pagination used an unexpected page count'

if (
  gitea_api_status() {
    printf '{}\n' >"$4"
    printf '200'
  }
  gitea_api_get_all unused /objects "$tmp/invalid.json" "$tmp" invalid
) >/dev/null 2>&1; then
  fail 'pagination accepted a non-array response'
fi

# Metadata validators are tested with dummy files; production ownership/mode is
# independently enforced by gitea_require_root_secret.
gitea_require_root_secret() {
  [[ -f "$1" && -s "$1" && ! -L "$1" ]]
}

created=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
rotation=$(date -u -d "$created + 30 days" '+%Y-%m-%dT%H:%M:%SZ')
GITEA_ADMIN_CURL_CONFIG="$tmp/admin.curl"
GITEA_ADMIN_METADATA="$tmp/admin.json"
printf '%s\n' 'header = "Authorization: token abcdefghijklmnopqrstuvwxyz123456"' \
  >"$GITEA_ADMIN_CURL_CONFIG"
jq -n --arg created "$created" --arg rotation "$rotation" '
  {
    token_name:"bootstrap-admin-automation",
    token_id:null,
    scopes:["write:admin", "write:organization", "write:repository"],
    created_at:$created,
    server_expiry:null,
    rotation_due:$rotation,
    revocation_procedure:"Log in as the 2FA bootstrap administrator, revoke bootstrap-admin-automation in Applications, then remove admin-api.curl and this metadata file."
  }
' >"$GITEA_ADMIN_METADATA"
gitea_validate_admin_control_record

jq '.rotation_due = "2000-01-01T00:00:00Z"' "$GITEA_ADMIN_METADATA" \
  >"$tmp/admin-expired.json"
if (
  GITEA_ADMIN_METADATA="$tmp/admin-expired.json"
  gitea_validate_admin_control_record
) >/dev/null 2>&1; then
  fail 'expired administrator token metadata was accepted'
fi

token_file="$tmp/service.token"
metadata="$tmp/service.json"
printf '%s\n' 'abcdefghijklmnopqrstuvwxyz1234567890ABCD' >"$token_file"
service_rotation=$(date -u -d "$created + 90 days" '+%Y-%m-%dT%H:%M:%SZ')
jq -n --arg created "$created" --arg rotation "$service_rotation" '
  {
    token_id:42,
    account:"svc-build",
    token_name:"svc-build-registry",
    scopes:["write:package"],
    created_at:$created,
    server_expiry:null,
    rotation_due:$rotation,
    revocation_procedure:"Reset svc-build once, DELETE token 42, then discard the password."
  }
' >"$metadata"
gitea_validate_token_record "$token_file" "$metadata" svc-build \
  svc-build-registry write:package
jq '.scopes = ["all"]' "$metadata" >"$tmp/service-broad.json"
if (
  gitea_validate_token_record "$token_file" "$tmp/service-broad.json" svc-build \
    svc-build-registry write:package
) >/dev/null 2>&1; then
  fail 'broadened service token metadata was accepted'
fi

gitea_assert_release_protection \
  "$ROOT/deploy/gitea/admin/templates/branch-release.json"
gitea_assert_main_protection "$ROOT/deploy/gitea/admin/templates/branch-main.json"
gitea_assert_tag_protection "$ROOT/deploy/gitea/admin/templates/tag-v.json"

sha=0123456789abcdef0123456789abcdef01234567
jq -n --arg sha "$sha" '[
  {context:"ci / required",status:"failure",sha:$sha,created_at:"2026-07-18T00:00:00Z"},
  {context:"ci / required",status:"success",sha:$sha,created_at:"2026-07-18T00:01:00Z"},
  {context:"security / required",status:"success",sha:$sha,created_at:"2026-07-18T00:01:00Z"}
]' >"$tmp/statuses.json"
gitea_assert_required_statuses "$tmp/statuses.json" "$sha"
jq '.[2].status = "pending"' "$tmp/statuses.json" >"$tmp/statuses-pending.json"
if (
  gitea_assert_required_statuses "$tmp/statuses-pending.json" "$sha"
) >/dev/null 2>&1; then
  fail 'pending required status was accepted'
fi

printf '%s\n' 'admin pagination, metadata, and protection primitives passed'
