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

printf 'backup primitive fault injections passed\n'
