#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../gitea-backup
source "$ROOT/deploy/gitea/platform/gitea-backup"

tmp="$(mktemp -d)"
cleanup_test() {
  rm -rf -- "$tmp"
}
trap cleanup_test EXIT HUP INT TERM

PLAINTEXT='complete-plaintext-sentinel'

producer_ok() {
  printf '%s\n' "$PLAINTEXT"
}

validator_ok() {
  cat >/dev/null
  printf 'validated\n'
}

validator_fail() {
  cat >/dev/null
  return 23
}

age_ok() {
  sha256sum
}

age_fail() {
  cat >/dev/null
  return 24
}

fsync_ok() {
  return 0
}

fsync_fail() {
  return 25
}

reset_component_set() {
  local label=$1
  SET_PARTIAL="$tmp/gitea-20260718T000000Z-${label}.partial"
  mkdir -m 0700 "$SET_PARTIAL"
  COMPONENT_RECORDS="$SET_PARTIAL/.components.jsonl"
  : >"$COMPONENT_RECORDS"
}

assert_no_plaintext() {
  if grep -R -F "$PLAINTEXT" "$tmp" >/dev/null 2>&1; then
    printf 'plaintext sentinel remained on disk\n' >&2
    exit 1
  fi
}

age_encrypt() { age_ok; }
fsync_path() { fsync_ok "$@"; }
reset_component_set aaaaaaaa
stream_component sample.tar producer_ok validator_ok
[[ -s "$SET_PARTIAL/sample.tar.age.partial" ]]
jq -e '.name == "sample.tar.age" and (.sha256 | length) == 64' \
  "$COMPONENT_RECORDS" >/dev/null
assert_no_plaintext
rm -rf -- "$SET_PARTIAL"

reset_component_set bbbbbbbb
if stream_component sample.tar producer_ok validator_fail; then
  printf 'validator failure was accepted\n' >&2
  exit 1
fi
[[ ! -e "$SET_PARTIAL/sample.tar.age" ]]
assert_no_plaintext
rm -rf -- "$SET_PARTIAL"

age_encrypt() { age_fail; }
reset_component_set cccccccc
if stream_component sample.tar producer_ok validator_ok; then
  printf 'age failure was accepted\n' >&2
  exit 1
fi
[[ ! -e "$SET_PARTIAL/sample.tar.age" ]]
assert_no_plaintext
rm -rf -- "$SET_PARTIAL"

age_encrypt() { age_ok; }
fsync_path() { fsync_fail "$@"; }
reset_component_set dddddddd
if stream_component sample.tar producer_ok validator_ok; then
  printf 'fsync failure was accepted\n' >&2
  exit 1
fi
[[ "$FAILURE_CODE" == fsync && ! -e "$SET_PARTIAL/sample.tar.age" ]]
assert_no_plaintext
rm -rf -- "$SET_PARTIAL"

fsync_path() { fsync_ok "$@"; }
if assert_disk_capacity 1000 199 10 2>/dev/null; then
  printf 'less than 20 percent free was accepted\n' >&2
  exit 1
fi
if assert_disk_capacity 1000 200 101 2>/dev/null; then
  printf 'less than two estimated sets was accepted\n' >&2
  exit 1
fi
assert_disk_capacity 1000 250 100

stale_root="$tmp/stale"
mkdir -m 0700 "$stale_root"
old="$stale_root/gitea-20260716T000000Z-eeeeeeee.partial"
recent="$stale_root/gitea-20260718T000000Z-ffffffff.partial"
mkdir "$old" "$recent"
touch -d '2 days ago' "$old"
cleanup_stale_partials_at "$stale_root"
[[ ! -e "$old" && -d "$recent" ]]

signal_root="$tmp/signal"
signal_partial="$signal_root/gitea-20260718T000000Z-1234abcd.partial"
mkdir -p "$signal_partial"
set +e
(
  trap 'remove_owned_partial_at "$signal_partial" "$signal_root"; exit 143' TERM
  kill -TERM "$BASHPID"
)
signal_status=$?
set -e
[[ "$signal_status" -eq 143 && ! -e "$signal_partial" ]]

api_config="$tmp/backup-api.curl"
printf '%s\n' 'header = "Authorization: token abcdefghijklmnopqrstuvwx"' >"$api_config"
validate_api_config "$api_config"
printf '%s\n' 'extra = forbidden' >>"$api_config"
if validate_api_config "$api_config" 2>/dev/null; then
  printf 'multi-line API curl config was accepted\n' >&2
  exit 1
fi

BACKUP_MODE=bootstrap
GITEA_BACKUP_API_CONFIG=
if wait_for_actions_idle 2>/dev/null; then
  printf 'bootstrap backup accepted a missing API curl config\n' >&2
  exit 1
fi
validate_webhook_url 'https://notify.example.invalid/fixed-path'
if validate_webhook_url 'https://notify.example.invalid/has a space' 2>/dev/null; then
  printf 'unsafe webhook URL was accepted\n' >&2
  exit 1
fi

api_log="$tmp/actions-api.log"
api_get() {
  printf '%s\n' "$1" >>"$api_log"
  case "$1" in
    *status=pending*) printf '%s\n' '{"total_count":1}' ;;
    *status=queued*) printf '%s\n' '{"total_count":2}' ;;
    *status=in_progress*) printf '%s\n' '{"total_count":3}' ;;
    *) return 1 ;;
  esac
}
[[ "$(active_action_count)" == 6 ]]
[[ "$(wc -l <"$api_log")" -eq 3 ]]
rg -q 'status=pending' "$api_log"
rg -q 'status=queued' "$api_log"
rg -q 'status=in_progress' "$api_log"

make_action_page() {
  local start=$1 end=$2 total=$3
  jq -nc --argjson start "$start" --argjson end "$end" --argjson total "$total" '
    {
      total_count:$total,
      workflow_runs:[range($start;$end) | {
        id:., repository_id:1, run_number:., run_attempt:1,
        path:"ci.yml@refs/heads/feature", event:"push", display_title:"CI",
        status:"completed", head_sha:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        started_at:null, completed_at:null, actor:null, trigger_actor:null,
        url:"https://live.example.invalid/unstable"
      }]
    }
  '
}

api_get() {
  case "$1" in
    *'page=1&limit=50'*) make_action_page 1 51 51 ;;
    *'page=2&limit=50'*) make_action_page 51 52 51 ;;
    *) return 1 ;;
  esac
}
produce_action_runs >"$tmp/actions.json"
[[ "$(jq -r 'length' "$tmp/actions.json")" -eq 51 ]]
normalize_action_run_array <"$tmp/actions.json" >"$tmp/actions.normalized.json"
jq -e '
  length == 51
  and .[0].actor == null
  and .[0].completed_at == null
  and (.[0] | has("url") | not)
' "$tmp/actions.normalized.json" >/dev/null

full_page_calls="$tmp/actions-full-page.calls"
api_get() {
  printf '%s\n' "$1" >>"$full_page_calls"
  case "$1" in
    *'page=1&limit=50'*) make_action_page 1 51 50 ;;
    *) return 1 ;;
  esac
}
produce_action_runs >"$tmp/actions-full-page.json"
[[ "$(jq -r 'length' "$tmp/actions-full-page.json")" -eq 50 ]]
[[ "$(wc -l <"$full_page_calls")" -eq 1 ]]

api_get() {
  case "$1" in
    *'page=1&limit=50'*) make_action_page 1 51 52 ;;
    *'page=2&limit=50'*) make_action_page 51 52 52 ;;
    *) return 1 ;;
  esac
}
if produce_action_runs >"$tmp/actions-count-mismatch.json"; then
  printf 'Actions pagination accepted a total_count mismatch\n' >&2
  exit 1
fi
api_get() {
  case "$1" in
    *'page=1&limit=50'*) make_action_page 1 51 51 ;;
    *'page=2&limit=50'*) make_action_page 51 52 50 ;;
    *) return 1 ;;
  esac
}
if produce_action_runs >"$tmp/actions-total-drift.json"; then
  printf 'Actions pagination accepted total_count drift\n' >&2
  exit 1
fi
jq '.[0].id = "invalid"' "$tmp/actions.json" >"$tmp/actions-invalid.json"
if normalize_action_run_array <"$tmp/actions-invalid.json" >/dev/null 2>&1; then
  printf 'Actions validator accepted an invalid stable field\n' >&2
  exit 1
fi
jq '.[1].id = .[0].id' "$tmp/actions.json" >"$tmp/actions-duplicate.json"
if normalize_action_run_array <"$tmp/actions-duplicate.json" >/dev/null 2>&1; then
  printf 'Actions validator accepted duplicate run IDs\n' >&2
  exit 1
fi

produce_releases() { printf '[]\n'; }
produce_packages() { printf '[]\n'; }
produce_action_runs() { make_action_page 1 2 1 | jq '.workflow_runs'; }
COMPONENT_RECORDS="$tmp/snapshot-components.jsonl"
: >"$COMPONENT_RECORDS"
while read -r name producer validator; do
  listing_hash="$("$producer" | "$validator" | sha256sum | awk '{print $1}')"
  jq -nc --arg name "$name" --arg listing_sha256 "$listing_hash" \
    '{name:$name,listing_sha256:$listing_sha256}' >>"$COMPONENT_RECORDS"
done <<'EOF'
releases.json.age produce_releases validate_release_array
packages.json.age produce_packages validate_package_array
actions.json.age produce_action_runs normalize_action_run_array
EOF
verify_api_snapshots_unchanged
produce_action_runs() {
  make_action_page 1 2 1 | jq '.workflow_runs | .[0].status = "cancelled"'
}
if verify_api_snapshots_unchanged 2>/dev/null; then
  printf 'Actions snapshot race was accepted\n' >&2
  exit 1
fi

service_order="$tmp/service-order"
restore_platform_services() { printf 'platform\n' >>"$service_order"; }
verify_api_snapshots_unchanged() { printf 'verify\n' >>"$service_order"; }
restore_runner_service() { printf 'runner\n' >>"$service_order"; }
restore_and_verify_services
printf 'platform\nverify\nrunner\n' >"$tmp/expected-service-order"
cmp -s "$tmp/expected-service-order" "$service_order"
: >"$service_order"
verify_api_snapshots_unchanged() { printf 'verify-failed\n' >>"$service_order"; return 1; }
if restore_and_verify_services; then
  printf 'service verification failure was accepted\n' >&2
  exit 1
fi
printf 'platform\nverify-failed\n' >"$tmp/expected-service-order"
cmp -s "$tmp/expected-service-order" "$service_order"

platform_compose() {
  printf '%s\n' "$*" >"$tmp/pg-restore.args"
  head -c 1 >"$tmp/pg-restore.stdin-prefix"
  printf 'validated database listing\n'
}
reset_component_set eeeeeeee
set +e
dd if=/dev/zero bs=1M count=8 status=none | validate_database >"$tmp/pg-restore.listing"
database_status=("${PIPESTATUS[@]}")
set -e
[[ "${database_status[0]}" -eq 0 && "${database_status[1]}" -eq 0 ]]
[[ "$(<"$tmp/pg-restore.args")" == 'exec -T postgres pg_restore --list' ]]
[[ "$(stat -c '%s' "$tmp/pg-restore.stdin-prefix")" == 1 ]]
[[ "$(<"$tmp/pg-restore.listing")" == 'validated database listing' ]]
[[ -z "$(find "$SET_PARTIAL" -mindepth 1 -maxdepth 1 -name '.postgres-validator.*' -print -quit)" ]]
rm -rf -- "$SET_PARTIAL"

printf 'backup primitive fault injections passed\n'
