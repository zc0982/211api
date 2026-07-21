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

jq -s '.' "$ROOT/deploy/gitea/admin/templates/tag-v.json" \
  >"$tmp/tag-protections.json"
gitea_extract_only_tag_protection \
  "$tmp/tag-protections.json" "$tmp/tag-v-selected.json"
jq -e 'type == "object" and .name_pattern == "v*"' \
  "$tmp/tag-v-selected.json" >/dev/null ||
  fail 'tag-protection extraction returned a boolean instead of the selected object'
if (
  printf '%s\n' '[true]' >"$tmp/tag-protections-boolean.json"
  gitea_extract_only_tag_protection \
    "$tmp/tag-protections-boolean.json" "$tmp/tag-v-boolean.json"
) >/dev/null 2>&1; then
  fail 'tag-protection extraction accepted a boolean row'
fi
jq -s '.[0] as $rule | [$rule, $rule]' \
  "$ROOT/deploy/gitea/admin/templates/tag-v.json" \
  >"$tmp/tag-protections-duplicate.json"
if (
  gitea_extract_only_tag_protection \
    "$tmp/tag-protections-duplicate.json" "$tmp/tag-v-duplicate.json"
) >/dev/null 2>&1; then
  fail 'tag-protection extraction accepted duplicate rules'
fi

jq -n '[
  {context:"ci / required (push)",status:"failure",created_at:"2026-07-18T00:00:00Z"},
  {context:"ci / required (push)",status:"success",created_at:"2026-07-18T00:01:00Z"},
  {context:"security / required (push)",status:"success",created_at:"2026-07-18T00:01:00Z"}
]' >"$tmp/statuses.json"
gitea_assert_required_statuses "$tmp/statuses.json"
jq '.[2].status = "pending"' "$tmp/statuses.json" >"$tmp/statuses-pending.json"
if (
  gitea_assert_required_statuses "$tmp/statuses-pending.json"
) >/dev/null 2>&1; then
  fail 'pending required status was accepted'
fi
jq 'map(select(.context != "security / required (push)"))' \
  "$tmp/statuses.json" >"$tmp/statuses-missing.json"
if (
  gitea_assert_required_statuses "$tmp/statuses-missing.json"
) >/dev/null 2>&1; then
  fail 'missing required status was accepted'
fi

printf '%s\n' 'dummy-bootstrap-password' >"$tmp/bootstrap-password"
printf '%s\n' \
  '{"message":"You must change your password. Change it at: https://git.211api.com//user/change_password"}' \
  >"$tmp/admin-password-gate.json"
if manual_gate_error=$(
  (gitea_validate_bootstrap_admin_gate_response 403 \
    "$tmp/admin-password-gate.json" luoee "$tmp/bootstrap-password") 2>&1
); then
  fail 'bootstrap administrator password-change gate was accepted as ready'
fi
grep -F 'manual gate: change the bootstrap password and enable 2FA for luoee, then rerun' \
  <<<"$manual_gate_error" >/dev/null ||
  fail 'bootstrap administrator password-change gate returned the wrong failure'

printf '%s\n' '[]' >"$tmp/admin-ready.json"
gitea_validate_bootstrap_admin_gate_response 200 "$tmp/admin-ready.json" \
  luoee "$tmp/bootstrap-password"

printf '%s\n' '{"message":"token scope is insufficient"}' \
  >"$tmp/admin-unexpected-forbidden.json"
if unexpected_forbidden_error=$(
  (gitea_validate_bootstrap_admin_gate_response 403 \
    "$tmp/admin-unexpected-forbidden.json" luoee "$tmp/bootstrap-password") 2>&1
); then
  fail 'unexpected administrator-token 403 was accepted as a manual gate'
fi
grep -F 'GET /admin/users with bootstrap administrator token returned HTTP 403 (expected 200)' \
  <<<"$unexpected_forbidden_error" >/dev/null ||
  fail 'unexpected administrator-token 403 did not remain fail-closed'

CLI_USER_LIST=$'ID   Username Email IsActive IsAdmin 2FA\n1    luoee user@example.com true true true'
gitea_cli() {
  [[ "$*" == 'admin user list' ]] || return 1
  printf '%s\n' "$CLI_USER_LIST"
}
gitea_cli_user_has_2fa luoee || fail 'CLI 2FA=true administrator was rejected'

CLI_USER_LIST=$'ID   Username Email IsActive IsAdmin 2FA\n1    luoee user@example.com true true false'
if gitea_cli_user_has_2fa luoee; then
  fail 'CLI 2FA=false administrator was accepted'
fi

CLI_USER_LIST=$'ID   Username Email IsActive IsAdmin 2FA\n1    luoee one@example.com true true true\n2    luoee two@example.com true true true'
if gitea_cli_user_has_2fa luoee; then
  fail 'duplicate CLI administrator rows were accepted for 2FA'
fi
unset -f gitea_cli

mkdir -p "$tmp/cli-contract"
CLI_VERSION_OUTPUT='gitea version 1.26.4 built with go1.26.4-X:jsonv2 : bindata'
gitea_cli() {
  case "$*" in
    --version)
      printf '%s\n' "$CLI_VERSION_OUTPUT"
      ;;
    'admin user create --help')
      printf '%s\n' \
        '--username --email --user-type --random-password --random-password-length --must-change-password --restricted' \
        'can be disabled by --must-change-password=false'
      ;;
    'admin user generate-access-token --help')
      printf '%s\n' '--username --token-name --raw --scopes'
      ;;
    'admin regenerate hooks --help')
      printf '%s\n' 'Regenerate git-hooks'
      ;;
    *)
      return 1
      ;;
  esac
}
gitea_validate_cli_contract "$tmp/cli-contract"

CLI_VERSION_OUTPUT='gitea version 1.26.5 built with go1.26.5 : bindata'
if (gitea_validate_cli_contract "$tmp/cli-contract") >/dev/null 2>&1; then
  fail 'unexpected Gitea CLI version was accepted'
fi

gitea_swagger_status() {
  return 1
}
if openapi_error=$(
  (unset runtime; gitea_validate_openapi "$tmp/openapi-contract") 2>&1
); then
  fail 'OpenAPI validator unexpectedly accepted an unavailable document'
fi
grep -F 'failed to retrieve deployed OpenAPI document' <<<"$openapi_error" >/dev/null ||
  fail 'OpenAPI validator still depends on a caller-global runtime path'

command -v rg >/dev/null 2>&1 || fail 'rg is required for admin local-assignment scan'
set +e
rg -n -P \
  '^\s*local\s+.*?\b(?<decl>[A-Za-z_][A-Za-z0-9_]*)=[^\s]+\s+.*\$(?:\{)?\k<decl>(?:\}|[^A-Za-z0-9_])' \
  "$ROOT/deploy/gitea/admin" >"$tmp/unsafe-local-assignments"
unsafe_local_status=$?
set -e
case "$unsafe_local_status" in
  0)
    sed -n '1,20p' "$tmp/unsafe-local-assignments" >&2
    fail 'admin script expands a local variable in its declaration statement'
    ;;
  1) ;;
  *) fail 'admin local-assignment scan failed' ;;
esac

printf '%s\n' 'admin pagination, metadata, and protection primitives passed'
