#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../gitea-restore-drill
source "$ROOT/deploy/gitea/platform/gitea-restore-drill"

tmp="$(mktemp -d)"
target_pid=
proxy_pid=
cleanup_test() {
  [[ -z "$proxy_pid" ]] || kill -TERM "$proxy_pid" 2>/dev/null || true
  [[ -z "$target_pid" ]] || kill -TERM "$target_pid" 2>/dev/null || true
  [[ -z "$proxy_pid" ]] || wait "$proxy_pid" 2>/dev/null || true
  [[ -z "$target_pid" ]] || wait "$target_pid" 2>/dev/null || true
  rm -rf -- "$tmp"
}
trap cleanup_test EXIT HUP INT TERM

printf '%s\n' '{"schemaVersion":2,"mediaType":"application/vnd.oci.image.index.v1+json","manifests":[]}' |
  validate_container_manifest
printf '%s\n' '{"schemaVersion":2,"mediaType":"application/vnd.docker.distribution.manifest.v2+json","config":{},"layers":[]}' |
  validate_container_manifest
if printf '%s\n' '{"schemaVersion":1}' | validate_container_manifest 2>/dev/null; then
  printf 'invalid container manifest was accepted\n' >&2
  exit 1
fi

[[ "$(urlencode_registry_path 'nested/image name')" == 'nested/image%20name' ]]
[[ "$(urlencode_segment 'sha256:value')" == 'sha256%3Avalue' ]]

make_action_page() {
  local start=$1 end=$2 total=$3 base_url=$4
  jq -nc \
    --argjson start "$start" --argjson end "$end" --argjson total "$total" \
    --arg base_url "$base_url" '
      {
        total_count:$total,
        workflow_runs:[range($start;$end) | {
          id:., repository_id:0, run_number:., run_attempt:0,
          path:"ci.yml@refs/heads/feature", event:"push", display_title:"CI",
          status:"completed", conclusion:"success", head_branch:"feature",
          head_sha:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          started_at:null, completed_at:null,
          actor:null, trigger_actor:{id:2,login:"automation"},
          url:($base_url + "/api/run"), html_url:($base_url + "/run")
        }]
      }
    '
}

api_local_get() {
  case "$1" in
    *'page=1&limit=50'*) make_action_page 1 51 51 http://127.0.0.1:3000 ;;
    *'page=2&limit=50'*) make_action_page 51 52 51 http://127.0.0.1:3000 ;;
    *) return 1 ;;
  esac
}
paginated_local_action_runs >"$tmp/restored-actions.json"
[[ "$(jq -r 'length' "$tmp/restored-actions.json")" -eq 51 ]]
normalize_action_runs <"$tmp/restored-actions.json" >"$tmp/restored-actions.normalized.json"
make_action_page 1 52 51 https://git.211api.com | jq '.workflow_runs' |
  normalize_action_runs >"$tmp/live-actions.normalized.json"
cmp -s "$tmp/restored-actions.normalized.json" "$tmp/live-actions.normalized.json"
jq -e '
  .[0].conclusion == "success"
  and .[0].head_branch == "feature"
  and (.[0] | has("repository_id") | not)
  and (.[0] | has("run_attempt") | not)
  and (.[0] | has("url") | not)
  and (.[0] | has("html_url") | not)
' "$tmp/restored-actions.normalized.json" >/dev/null
jq '.[0].head_branch = null' "$tmp/restored-actions.json" |
  normalize_action_runs >"$tmp/null-head-branch.normalized.json"
jq -e '.[0].head_branch == null' "$tmp/null-head-branch.normalized.json" >/dev/null
jq '.[0].actor = {id:-1,login:"Ghost"} | .[0].trigger_actor = {id:-2,login:"gitea-actions"}' \
  "$tmp/restored-actions.json" |
  normalize_action_runs >"$tmp/system-actors.normalized.json"
jq -e '
  .[0].actor == {id:-1,login:"Ghost"}
  and .[0].trigger_actor == {id:-2,login:"gitea-actions"}
' "$tmp/system-actors.normalized.json" >/dev/null
jq '.[0].trigger_actor = {id:-3,login:"unknown-system"}' \
  "$tmp/restored-actions.json" >"$tmp/invalid-system-actor.json"
if normalize_action_runs <"$tmp/invalid-system-actor.json" >/dev/null 2>&1; then
  printf 'Actions normalization accepted an unknown negative actor ID\n' >&2
  exit 1
fi
jq '.[0].conclusion = "cancelled"' "$tmp/restored-actions.json" |
  normalize_action_runs >"$tmp/changed-actions.normalized.json"
if cmp -s "$tmp/restored-actions.normalized.json" "$tmp/changed-actions.normalized.json"; then
  printf 'Actions normalization ignored a stable field change\n' >&2
  exit 1
fi
jq '.[0].trigger_actor = {id:"invalid",login:"automation"}' \
  "$tmp/restored-actions.json" >"$tmp/invalid-actions.json"
if normalize_action_runs <"$tmp/invalid-actions.json" >/dev/null 2>&1; then
  printf 'Actions normalization accepted an invalid actor\n' >&2
  exit 1
fi
jq '.[0].conclusion = null' "$tmp/restored-actions.json" >"$tmp/invalid-conclusion.json"
if normalize_action_runs <"$tmp/invalid-conclusion.json" >/dev/null 2>&1; then
  printf 'Actions normalization accepted an invalid conclusion\n' >&2
  exit 1
fi
jq '.[0].head_branch = 42' "$tmp/restored-actions.json" >"$tmp/invalid-head-branch.json"
if normalize_action_runs <"$tmp/invalid-head-branch.json" >/dev/null 2>&1; then
  printf 'Actions normalization accepted an invalid head branch\n' >&2
  exit 1
fi

full_page_calls="$tmp/restored-actions-full-page.calls"
api_local_get() {
  printf '%s\n' "$1" >>"$full_page_calls"
  case "$1" in
    *'page=1&limit=50'*) make_action_page 1 51 50 http://127.0.0.1:3000 ;;
    *) return 1 ;;
  esac
}
paginated_local_action_runs >"$tmp/restored-actions-full-page.json"
[[ "$(jq -r 'length' "$tmp/restored-actions-full-page.json")" -eq 50 ]]
[[ "$(wc -l <"$full_page_calls")" -eq 1 ]]

api_local_get() {
  case "$1" in
    *'page=1&limit=50'*) make_action_page 1 51 52 http://127.0.0.1:3000 ;;
    *'page=2&limit=50'*) make_action_page 51 52 52 http://127.0.0.1:3000 ;;
    *) return 1 ;;
  esac
}
if paginated_local_action_runs >"$tmp/restored-actions-count-mismatch.json"; then
  printf 'Restored Actions pagination accepted a total_count mismatch\n' >&2
  exit 1
fi
api_local_get() {
  case "$1" in
    *'page=1&limit=50'*) make_action_page 1 51 51 http://127.0.0.1:3000 ;;
    *'page=2&limit=50'*) make_action_page 51 52 50 http://127.0.0.1:3000 ;;
    *) return 1 ;;
  esac
}
if paginated_local_action_runs >"$tmp/restored-actions-total-drift.json"; then
  printf 'Restored Actions pagination accepted total_count drift\n' >&2
  exit 1
fi

SCRATCH="$tmp/scratch"
[[ "$(scratch_path_for_original /etc/gitea/db-password)" == "$SCRATCH/etc/gitea/db-password" ]]
if scratch_path_for_original /etc/gitea/../shadow >/dev/null; then
  printf 'restore scratch path accepted parent traversal\n' >&2
  exit 1
fi
if scratch_path_for_original /etc//gitea/secret >/dev/null; then
  printf 'restore scratch path accepted a non-canonical path\n' >&2
  exit 1
fi

permission_fixture="$tmp/root-owned-executable"
printf '#!/bin/sh\n' >"$permission_fixture"
chmod 0755 "$permission_fixture"
stat() {
  if [[ "$1" == -c && "$2" == %u ]]; then
    printf '0\n'
  else
    command stat "$@"
  fi
}
require_root_nonsecret_file "$permission_fixture"
chmod 0700 "$permission_fixture"
if require_root_nonsecret_file "$permission_fixture" 2>/dev/null; then
  printf 'restore accepted an unsupported root-owned executable mode\n' >&2
  exit 1
fi
unset -f stat

mkdir "$tmp/http-root"
printf 'loopback-proxy-ok\n' >"$tmp/http-root/index.html"
read -r target_port proxy_port < <(python3 -c '
import socket
sockets = [socket.socket(), socket.socket()]
for item in sockets:
    item.bind(("127.0.0.1", 0))
print(*(item.getsockname()[1] for item in sockets))
for item in sockets:
    item.close()
')
python3 -m http.server "$target_port" --bind 127.0.0.1 --directory "$tmp/http-root" \
  >"$tmp/http-server.log" 2>&1 &
target_pid=$!
python3 "$ROOT/deploy/gitea/platform/gitea_loopback_proxy.py" \
  --listen-port "$proxy_port" --target-host 127.0.0.1 --target-port "$target_port" \
  >"$tmp/loopback-proxy.log" 2>&1 &
proxy_pid=$!
proxy_body=
for _ in $(seq 1 30); do
  if proxy_body="$(curl --silent --show-error --fail --connect-timeout 1 --max-time 2 \
    "http://127.0.0.1:$proxy_port/" 2>/dev/null)"; then
    break
  fi
  sleep 0.1
done
[[ "$proxy_body" == loopback-proxy-ok ]]
kill -TERM "$proxy_pid" "$target_pid"
wait "$proxy_pid"
if wait "$target_pid"; then
  printf 'HTTP fixture ignored SIGTERM\n' >&2
  exit 1
else
  [[ "$?" -eq 143 ]]
fi
proxy_pid=
target_pid=
if python3 "$ROOT/deploy/gitea/platform/gitea_loopback_proxy.py" \
  --listen-port "$proxy_port" --target-host 8.8.8.8 --target-port 443 \
  >"$tmp/public-target.log" 2>&1; then
  printf 'loopback proxy accepted a public target\n' >&2
  exit 1
fi

RESTORE_PROJECT=gitea-restore-config-test \
RESTORE_HTTP_PORT=45678 \
RESTORE_DB_PASSWORD_FILE="$tmp/db-password" \
RESTORE_SECRET_KEY_FILE="$tmp/secret-key" \
RESTORE_INTERNAL_TOKEN_FILE="$tmp/internal-token" \
RESTORE_POSTGRES_VOLUME=restore-test-postgres \
RESTORE_GITEA_DATA_VOLUME=restore-test-gitea-data \
RESTORE_GITEA_CONFIG_VOLUME=restore-test-gitea-config \
RESTORE_RUNTIME_SECRETS_VOLUME=restore-test-runtime-secrets \
docker compose \
  --env-file "$ROOT/deploy/gitea/images.lock.env" \
  -f "$ROOT/deploy/gitea/platform/restore-compose.yaml" \
  config --format json >"$tmp/restore-compose.json"
jq -e '
  ((.services.gitea.ports // []) | length) == 0
  and .networks.restore.internal == true
  and .networks.restore.enable_ipv6 == false
  and .services.gitea.environment.GITEA__server__ROOT_URL == "http://127.0.0.1:45678/"
' "$tmp/restore-compose.json" >/dev/null

printf 'restore path and Registry manifest primitives passed\n'
