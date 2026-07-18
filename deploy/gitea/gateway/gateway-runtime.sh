#!/usr/bin/env bash

# Shared root-owned runtime primitives for the Gateway deployment boundary.
# This file is sourced by reviewed programs; it is not an operator entry point.

gateway_die() {
  printf '211api gateway: %s\n' "$1" >&2
  return "${2:-1}"
}

gateway_runtime_init() {
  local root=${GATEWAY_DEPLOY_TEST_ROOT:-}
  if [[ -n "$root" ]]; then
    [[ "${GATEWAY_DEPLOY_TESTING:-0}" == 1 ]] ||
      gateway_die "test root requires GATEWAY_DEPLOY_TESTING=1"
    [[ "$root" == /tmp/* && -d "$root" && ! -L "$root" ]] ||
      gateway_die "test root must be a real directory below /tmp"
    [[ "$(stat -c '%u' "$root")" == "$EUID" ]] ||
      gateway_die "test root must be owned by the caller"
    GATEWAY_TEST_MODE=1
    GATEWAY_ROOT=$root
  else
    ((EUID == 0)) || gateway_die "root privileges are required"
    GATEWAY_TEST_MODE=0
    GATEWAY_ROOT=
  fi

  CONFIG_ROOT="${GATEWAY_ROOT}/etc/211api-deploy"
  DEPLOY_DIR="${GATEWAY_ROOT}/opt/211api/deploy"
  COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
  ENV_FILE="$DEPLOY_DIR/.env"
  BACKUP_ROOT="$DEPLOY_DIR/backups"
  STATE_FILE="$DEPLOY_DIR/.deployment-state.json"
  AUDIT_DIR="${GATEWAY_ROOT}/var/log/211api-deploy"
  AUDIT_FILE="$AUDIT_DIR/audit.jsonl"
  LOCK_ROOT="${GATEWAY_ROOT}/run/lock"
  DEPLOY_LOCK="$LOCK_ROOT/211api-deploy.lock"
  AUDIT_LOCK="$LOCK_ROOT/211api-deploy-audit.lock"
  RUNTIME_ROOT="${GATEWAY_ROOT}/run/211api-deploy"
  DOCKER_CONFIG_DIR="${GATEWAY_ROOT}/root/.docker"
  HEAD_API_CONFIG="$CONFIG_ROOT/gitea-head-api.curl"
  AGE_RECIPIENT_FILE="$CONFIG_ROOT/age-recipient"
  KEY_METADATA_FILE="$CONFIG_ROOT/key-metadata.json"
  ACTIVE_APPROVAL_DIR="$CONFIG_ROOT/migration-approvals"
  CONSUMED_APPROVAL_DIR="$CONFIG_ROOT/consumed-approvals"
  ARCHIVE_VALIDATOR="$CONFIG_ROOT/gateway-validate-archive.py"
  RETENTION_PROGRAM="$CONFIG_ROOT/gateway-retention.py"

  GITEA_API=https://git.211api.com/api/v1
  GITEA_REPOSITORY=211api/211api
  REGISTRY_IMAGE=git.211api.com/211api/211api
  HEALTH_URL=http://127.0.0.1:8080/health
  APPLICATION_CONTAINER=sub2api
  POSTGRES_CONTAINER=sub2api-postgres
  POSTGRES_RESTORE_IMAGE='docker.io/library/postgres:18.4-alpine@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15'
  EXPECTED_OWNER=$([[ "$GATEWAY_TEST_MODE" == 1 ]] && printf '%s' "$EUID" || printf '0')
  EXPECTED_GROUP=$([[ "$GATEWAY_TEST_MODE" == 1 ]] && id -g || printf '0')

  GATEWAY_PARTIAL_SET=
  GATEWAY_LAST_BACKUP=
  GATEWAY_CURRENT_COMMIT=
  GATEWAY_CURRENT_DIGEST=
  if [[ "${GATEWAY_DEPLOY_DISPATCH:-0}" == 1 ]]; then
    [[ "${GATEWAY_DEPLOY_SOURCE_IP:-}" == 37.221.194.27 ]] ||
      gateway_die "dispatcher source marker is invalid"
    GATEWAY_SOURCE_IP=37.221.194.27
  else
    GATEWAY_SOURCE_IP=operator
  fi
}

gateway_require_command() {
  command -v "$1" >/dev/null 2>&1 || gateway_die "required command is missing: $1"
}

gateway_require_directory() {
  local path=$1 mode=$2
  [[ -d "$path" && ! -L "$path" ]] || gateway_die "unsafe or missing directory: $path"
  [[ "$(stat -c '%u:%g' "$path")" == "$EXPECTED_OWNER:$EXPECTED_GROUP" ]] ||
    gateway_die "directory owner or group is unsafe: $path"
  [[ "$(stat -c '%a' "$path")" == "$mode" ]] ||
    gateway_die "directory mode must be $mode: $path"
}

gateway_require_host_directory() {
  local path=$1 mode
  [[ -d "$path" && ! -L "$path" ]] || gateway_die "unsafe or missing host directory: $path"
  [[ "$(stat -c '%u:%g' "$path")" == "$EXPECTED_OWNER:$EXPECTED_GROUP" ]] ||
    gateway_die "host directory owner or group is unsafe: $path"
  mode="$(stat -c '%a' "$path")"
  [[ "$mode" == 700 || "$mode" == 750 || "$mode" == 755 ||
    ( "$path" == "${GATEWAY_ROOT}/run/lock" && "$mode" == 775 ) ]] ||
    gateway_die "host directory mode is unsafe: $path"
}

gateway_require_regular() {
  local path=$1 mode=$2
  [[ -f "$path" && ! -L "$path" ]] || gateway_die "unsafe or missing file: $path"
  [[ "$(stat -c '%u:%g' "$path")" == "$EXPECTED_OWNER:$EXPECTED_GROUP" ]] ||
    gateway_die "file owner or group is unsafe: $path"
  [[ "$(stat -c '%a' "$path")" == "$mode" ]] ||
    gateway_die "file mode must be $mode: $path"
}

gateway_require_host_file() {
  local path=$1 mode
  [[ -f "$path" && ! -L "$path" ]] || gateway_die "unsafe or missing host file: $path"
  [[ "$(stat -c '%u:%g' "$path")" == "$EXPECTED_OWNER:$EXPECTED_GROUP" ]] ||
    gateway_die "host file owner or group is unsafe: $path"
  mode="$(stat -c '%a' "$path")"
  [[ "$mode" == 600 || "$mode" == 640 || "$mode" == 644 ]] ||
    gateway_die "host file mode is unsafe: $path"
}

gateway_fsync_path() {
  local path=$1
  [[ "${GATEWAY_DEPLOY_TEST_FAIL_FSYNC:-0}" != 1 ]] || return 1
  python3 -c '
import os, sys
path = sys.argv[1]
flags = os.O_RDONLY | (os.O_DIRECTORY if os.path.isdir(path) else 0)
fd = os.open(path, flags)
try:
    os.fsync(fd)
finally:
    os.close(fd)
' "$path"
}

gateway_hash_file() {
  sha256sum "$1" | awk '{print $1}'
}

gateway_other_env_hash() {
  python3 -c '
import hashlib, pathlib, sys
data = pathlib.Path(sys.argv[1]).read_bytes()
lines = data.splitlines(keepends=True)
matches = [line for line in lines if line.startswith(b"SUB2API_IMAGE=")]
if len(matches) != 1:
    raise SystemExit("expected exactly one SUB2API_IMAGE line")
print(hashlib.sha256(b"".join(line for line in lines if not line.startswith(b"SUB2API_IMAGE="))).hexdigest())
' "$ENV_FILE"
}

gateway_current_env_image() {
  local count value
  count="$(grep -c '^SUB2API_IMAGE=' "$ENV_FILE" || true)"
  [[ "$count" == 1 ]] || gateway_die "expected exactly one SUB2API_IMAGE line"
  value="$(sed -n 's/^SUB2API_IMAGE=//p' "$ENV_FILE")"
  [[ -n "$value" && "$value" != *[$'\r\n\t ']* ]] || gateway_die "unsafe SUB2API_IMAGE value"
  printf '%s\n' "$value"
}

gateway_validate_api_config() {
  local -a lines=()
  gateway_require_regular "$HEAD_API_CONFIG" 600
  mapfile -t lines <"$HEAD_API_CONFIG"
  ((${#lines[@]} == 1)) || gateway_die "Gitea API curl config must contain exactly one line"
  [[ "${lines[0]}" =~ ^header\ =\ \"Authorization:\ token\ [A-Za-z0-9_-]{20,255}\"$ ]] ||
    gateway_die "Gitea API curl config has an invalid authorization line"
}

gateway_load_recipient() {
  gateway_require_regular "$AGE_RECIPIENT_FILE" 600
  AGE_RECIPIENT="$(tr -d '\r\n' <"$AGE_RECIPIENT_FILE")"
  [[ "$AGE_RECIPIENT" =~ ^age1[023456789acdefghjklmnpqrstuvwxyz]{58}$ ]] ||
    gateway_die "invalid age recipient"
  local recipient_sha
  recipient_sha="$(printf '%s' "$AGE_RECIPIENT" | sha256sum | awk '{print $1}')"
  gateway_validate_key_metadata_sha "$recipient_sha"
  jq -e --arg sha "$recipient_sha" '.recipient_sha256 == $sha' \
    "$KEY_METADATA_FILE" >/dev/null ||
    gateway_die "current age recipient is not the active metadata recipient"
  local rotation_epoch now
  rotation_epoch="$(date -u -d "$(jq -r '.rotation_due' "$KEY_METADATA_FILE")" +%s 2>/dev/null || true)"
  now="$(date -u +%s)"
  [[ "$rotation_epoch" =~ ^[0-9]+$ && "$rotation_epoch" -gt "$now" ]] ||
    gateway_die "current age recipient rotation deadline has expired"
}

gateway_validate_key_metadata_sha() {
  local recipient_sha=$1
  gateway_require_regular "$KEY_METADATA_FILE" 600
  jq -e --arg sha "$recipient_sha" '
    .schema == "211api-age-key-metadata.v1"
    and (.custody_verified_at | type == "string")
    and (.rotation_due | type == "string")
    and (has("private_key") | not)
    and (
      .recipients == null
      or ((.recipients | type) == "array"
        and all(.recipients[];
          (.recipient_sha256 | type) == "string"
          and (.recipient_sha256 | test("^[0-9a-f]{64}$"))
          and (has("private_key") | not)))
    )
    and (
      .recipient_sha256 == $sha
      or ([.recipients[]?.recipient_sha256] | index($sha) != null)
    )
  ' "$KEY_METADATA_FILE" >/dev/null || gateway_die "age key metadata is invalid"
}

gateway_validate_state() {
  gateway_require_regular "$STATE_FILE" 600
  jq -e '
    .schema == "211api-deployment-state.v1"
    and (.commit == null or (.commit | type == "string" and test("^[0-9a-f]{40}$")))
    and (.digest == null or (.digest | type == "string" and test("^sha256:[0-9a-f]{64}$")))
    and (.image == null or (.image | type == "string" and length > 0))
    and (.backup_id == null or (.backup_id | type == "string" and test("^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{40}$")))
    and (.predecessor_backup_id == null or (.predecessor_backup_id | type == "string"))
    and (.known_good_backup_id == null or (.known_good_backup_id | type == "string"))
  ' "$STATE_FILE" >/dev/null || gateway_die "deployment state is invalid"
}

gateway_prepare_lock_file() {
  local path=$1
  if [[ ! -e "$path" ]]; then
    (umask 077; set -o noclobber; : >"$path") 2>/dev/null || true
  fi
  gateway_require_regular "$path" 600
}

gateway_prepare_ephemeral_runtime() {
  local run_parent="${GATEWAY_ROOT}/run"
  gateway_require_command install
  gateway_require_host_directory "$run_parent"
  if [[ ! -e "$RUNTIME_ROOT" ]]; then
    install -d -o "$EXPECTED_OWNER" -g "$EXPECTED_GROUP" -m 0700 "$RUNTIME_ROOT"
    gateway_fsync_path "$run_parent"
  fi
  gateway_require_directory "$RUNTIME_ROOT" 700
  gateway_prepare_lock_file "$DEPLOY_LOCK"
  gateway_prepare_lock_file "$AUDIT_LOCK"
}

gateway_rotate_audit_locked() {
  local force=${1:-0} limit=10485760 size partial index source destination
  gateway_require_regular "$AUDIT_FILE" 600
  size="$(stat -c '%s' "$AUDIT_FILE")"
  [[ "$size" =~ ^[0-9]+$ ]] || return 1
  [[ "$force" == 1 ]] || ((size >= limit)) || return 0
  gateway_require_command gzip
  partial="$AUDIT_DIR/.audit.jsonl.1.gz.partial.$$"
  [[ ! -e "$partial" ]] || return 1
  gzip -c -- "$AUDIT_FILE" >"$partial"
  chmod 0600 "$partial"
  gateway_fsync_path "$partial"
  for ((index = 10; index >= 1; index--)); do
    source="$AUDIT_DIR/audit.jsonl.$index.gz"
    [[ ! -e "$source" ]] || gateway_require_regular "$source" 600
  done
  rm -f -- "$AUDIT_DIR/audit.jsonl.10.gz"
  for ((index = 9; index >= 1; index--)); do
    source="$AUDIT_DIR/audit.jsonl.$index.gz"
    destination="$AUDIT_DIR/audit.jsonl.$((index + 1)).gz"
    [[ ! -e "$source" ]] || mv -- "$source" "$destination"
  done
  mv -- "$partial" "$AUDIT_DIR/audit.jsonl.1.gz"
  python3 -c '
import os, stat, sys
path, expected_uid, expected_gid = sys.argv[1:]
fd = os.open(path, os.O_WRONLY | os.O_NOFOLLOW)
try:
    info = os.fstat(fd)
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != int(expected_uid)
            or info.st_gid != int(expected_gid) or stat.S_IMODE(info.st_mode) != 0o600):
        raise SystemExit("unsafe audit file")
    os.ftruncate(fd, 0)
    os.fdatasync(fd)
finally:
    os.close(fd)
' "$AUDIT_FILE" "$EXPECTED_OWNER" "$EXPECTED_GROUP"
  gateway_fsync_path "$AUDIT_DIR"
}

gateway_audit_event() {
  local event=$1 outcome=$2 code=$3 detail=${4:-none}
  local timestamp line audit_fd
  [[ "${GATEWAY_DEPLOY_TEST_FAIL_AUDIT:-0}" != 1 ]] || return 1
  [[ "$event" =~ ^[a-z0-9-]{1,64}$ && "$outcome" =~ ^[a-z0-9-]{1,32}$ ]] || return 1
  [[ "$code" =~ ^[a-z0-9-]{1,64}$ && "$detail" =~ ^[A-Za-z0-9._:@/+,-]{1,256}$ ]] || return 1
  gateway_require_directory "$AUDIT_DIR" 700
  gateway_require_regular "$AUDIT_FILE" 600
  gateway_require_host_directory "$LOCK_ROOT"
  gateway_prepare_lock_file "$AUDIT_LOCK"
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  line="$(jq -cn \
    --arg schema 211api-deploy-audit.v1 \
    --arg timestamp "$timestamp" \
    --arg event "$event" \
    --arg outcome "$outcome" \
    --arg code "$code" \
    --arg source "$GATEWAY_SOURCE_IP" \
    --arg commit "${GATEWAY_CURRENT_COMMIT:-}" \
    --arg digest "${GATEWAY_CURRENT_DIGEST:-}" \
    --arg detail "$detail" \
    '{schema:$schema,timestamp:$timestamp,event:$event,outcome:$outcome,code:$code,
      source:$source,commit:(if $commit=="" then null else $commit end),
      digest:(if $digest=="" then null else $digest end),detail:$detail}')"
  ((${#line} <= 4095)) || return 1
  exec {audit_fd}>"$AUDIT_LOCK"
  flock -x "$audit_fd"
  if (( $(stat -c '%s' "$AUDIT_FILE") + ${#line} + 1 > 10485760 )); then
    gateway_rotate_audit_locked 1
  fi
  python3 -c '
import os, stat, sys
path, payload, expected_uid, expected_gid, fail_sync = sys.argv[1:]
fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_NOFOLLOW)
try:
    info = os.fstat(fd)
    if (not stat.S_ISREG(info.st_mode) or info.st_uid != int(expected_uid)
            or info.st_gid != int(expected_gid) or stat.S_IMODE(info.st_mode) != 0o600):
        raise SystemExit("unsafe audit file")
    data = (payload + "\n").encode("utf-8")
    written = 0
    while written < len(data):
        written += os.write(fd, data[written:])
    if fail_sync == "1":
        raise OSError("injected fdatasync failure")
    os.fdatasync(fd)
finally:
    os.close(fd)
' "$AUDIT_FILE" "$line" "$EXPECTED_OWNER" "$EXPECTED_GROUP" \
    "${GATEWAY_DEPLOY_TEST_FAIL_FDATASYNC:-0}"
  local status=$?
  flock -u "$audit_fd" || status=1
  exec {audit_fd}>&-
  return "$status"
}

gateway_api_get() {
  local path=$1
  gateway_validate_api_config
  curl --config "$HEAD_API_CONFIG" \
    --silent --show-error --fail \
    --connect-timeout 5 --max-time 20 \
    --proto '=https' --tlsv1.2 \
    "$GITEA_API$path"
}

gateway_get_main_head() {
  gateway_api_get "/repos/$GITEA_REPOSITORY/branches/main" |
    jq -er '
      select(.protected == true)
      | .commit.id
      | select(type == "string" and test("^[0-9a-f]{40}$"))
    '
}

gateway_get_changed_paths() {
  local previous=$1 target=$2
  [[ "$previous" =~ ^[0-9a-f]{40}$ && "$target" =~ ^[0-9a-f]{40}$ ]] ||
    gateway_die "compare commits are invalid"
  if [[ "$previous" == "$target" ]]; then
    return 0
  fi
  gateway_api_get "/repos/$GITEA_REPOSITORY/compare/${previous}...${target}" |
    jq -er '
      if (.files | type) != "array" then error("missing files") else .files end
      | if all(.[]; (.filename | type) == "string"
          and (.filename | test("^[^/[:cntrl:]][^[:cntrl:]]*$"))
          and (.filename | test("(^|/)\\.\\.(/|$)") | not))
        then .[]?.filename else error("invalid filename") end
    '
}

gateway_path_is_migration_sensitive() {
  case "$1" in
    backend/migrations/*|backend/ent/schema/*|backend/ent/migrate/*|\
      backend/internal/repository/ent.go|\
      backend/internal/repository/migrations_runner.go|\
      backend/migrations/migrations.go)
      return 0
      ;;
  esac
  return 1
}

gateway_sensitive_paths() {
  local path
  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    gateway_path_is_migration_sensitive "$path" && printf '%s\n' "$path"
  done
  return 0
}

gateway_atomic_json_replace() {
  local source=$1 destination=$2 parent
  parent="$(dirname "$destination")"
  chmod 0600 "$source"
  gateway_fsync_path "$source"
  mv -f -- "$source" "$destination"
  gateway_fsync_path "$parent"
}

gateway_preflight_disk() {
  if [[ "$GATEWAY_TEST_MODE" == 1 && "${GATEWAY_DEPLOY_TEST_FAIL_DISK:-0}" == 1 ]]; then
    gateway_die "injected disk preflight failure"
  fi
  [[ "${GATEWAY_DEPLOY_TEST_SKIP_DISK:-0}" != 1 ]] || return 0
  local available_kb used_percent deployment_bytes database_bytes newest_bytes=0 required_bytes
  read -r _ _ _ available_kb used_percent _ < <(df -Pk "$BACKUP_ROOT" | tail -n 1)
  used_percent=${used_percent%%%}
  [[ "$available_kb" =~ ^[0-9]+$ && "$used_percent" =~ ^[0-9]+$ ]] ||
    gateway_die "unable to determine backup disk capacity"
  ((used_percent <= 80)) || gateway_die "backup filesystem has less than 20 percent free"
  deployment_bytes="$(du -sb "$COMPOSE_FILE" "$ENV_FILE" | awk '{sum += $1} END {print sum}')"
  database_bytes="$(docker exec "$POSTGRES_CONTAINER" sh -eu -c '
    exec psql --no-psqlrc --tuples-only --no-align \
      --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
      --command "SELECT pg_database_size(current_database())"
  ' | tr -d '[:space:]')"
  [[ "$deployment_bytes" =~ ^[0-9]+$ && "$database_bytes" =~ ^[0-9]+$ ]] ||
    gateway_die "unable to estimate backup size"
  local newest
  newest="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d \
    -name '????????T??????Z-????????????????????????????????????????' -printf '%T@ %p\n' |
    sort -nr | awk 'NR == 1 {sub(/^[^ ]+ /, ""); print; exit}')"
  if [[ -n "$newest" ]]; then
    newest_bytes="$(du -sb "$newest" | awk '{print $1}')"
  fi
  required_bytes=$((2 * (deployment_bytes + database_bytes + newest_bytes) + 536870912))
  ((available_kb * 1024 >= required_bytes)) ||
    gateway_die "insufficient space for two estimated backup sets and image headroom"
}

gateway_produce_database() {
  [[ "${GATEWAY_DEPLOY_TEST_FAIL_PGDUMP:-0}" != 1 ]] || return 41
  docker exec "$POSTGRES_CONTAINER" sh -eu -c '
    exec pg_dump --format=custom --serializable-deferrable \
      --no-owner --no-privileges \
      --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
  '
}

gateway_validate_database() {
  [[ "${GATEWAY_DEPLOY_TEST_FAIL_VALIDATOR:-0}" != 1 ]] || return 42
  docker exec -i "$POSTGRES_CONTAINER" sh -eu -c 'exec pg_restore --list'
}

gateway_produce_deployment_archive() {
  [[ "${GATEWAY_DEPLOY_TEST_FAIL_ARCHIVE:-0}" != 1 ]] || return 43
  tar --format=posix --numeric-owner --owner=0 --group=0 \
    -C "$DEPLOY_DIR" -cf - docker-compose.yml .env
}

gateway_validate_deployment_archive() {
  [[ "${GATEWAY_DEPLOY_TEST_FAIL_ARCHIVE_VALIDATOR:-0}" != 1 ]] || return 44
  python3 "$ARCHIVE_VALIDATOR"
}

gateway_stream_component() {
  local label=$1 cipher=$2 listing=$3 producer=$4 validator=$5
  local raw_fifo="$GATEWAY_PARTIAL_SET/.${label}.raw.$$"
  local validate_fifo="$GATEWAY_PARTIAL_SET/.${label}.validate.$$"
  local producer_status_file="$GATEWAY_PARTIAL_SET/.${label}.producer-status.$$"
  local cipher_partial="${cipher}.partial"
  local listing_partial="${listing}.partial"
  local producer_pid validator_pid producer_status validator_status
  local -a pipeline_status

  mkfifo -m 0600 "$raw_fifo" "$validate_fifo"
  (
    set +e
    "$validator" <"$validate_fifo" >"$listing_partial"
    printf '%s\n' "$?" >"$GATEWAY_PARTIAL_SET/.${label}.validator-status.$$"
  ) &
  validator_pid=$!
  (
    set +e
    "$producer" >"$raw_fifo"
    printf '%s\n' "$?" >"$producer_status_file"
  ) &
  producer_pid=$!

  set +e
  tee "$validate_fifo" <"$raw_fifo" |
    age --encrypt --recipient "$AGE_RECIPIENT" >"$cipher_partial"
  pipeline_status=("${PIPESTATUS[@]}")
  wait "$producer_pid"
  wait "$validator_pid"
  set -e

  producer_status="$(cat "$producer_status_file" 2>/dev/null || printf '255')"
  validator_status="$(cat "$GATEWAY_PARTIAL_SET/.${label}.validator-status.$$" 2>/dev/null || printf '255')"
  rm -f -- "$raw_fifo" "$validate_fifo" "$producer_status_file" \
    "$GATEWAY_PARTIAL_SET/.${label}.validator-status.$$"

  [[ "$producer_status" == 0 && "$validator_status" == 0 &&
    "${pipeline_status[0]:-255}" == 0 && "${pipeline_status[1]:-255}" == 0 ]] || {
    rm -f -- "$cipher_partial" "$listing_partial"
    gateway_die "$label stream validation or encryption failed"
  }
  [[ -s "$cipher_partial" && -s "$listing_partial" ]] || {
    rm -f -- "$cipher_partial" "$listing_partial"
    gateway_die "$label stream produced an empty component"
  }
  chmod 0600 "$cipher_partial" "$listing_partial"
  gateway_fsync_path "$cipher_partial"
  gateway_fsync_path "$listing_partial"
  mv -- "$cipher_partial" "$cipher"
  mv -- "$listing_partial" "$listing"
}

gateway_component_record() {
  local path=$1 listing=${2:-}
  local listing_sha=null
  if [[ -n "$listing" ]]; then
    listing_sha="\"$(gateway_hash_file "$listing")\""
  fi
  jq -n \
    --arg name "$(basename "$path")" \
    --arg sha "$(gateway_hash_file "$path")" \
    --argjson size "$(stat -c '%s' "$path")" \
    --argjson listing_sha256 "$listing_sha" \
    '{name:$name,sha256:$sha,size:$size,listing_sha256:$listing_sha256}'
}

gateway_backup_create() {
  local commit=$1 digest=$2 migration_sensitive=$3
  local previous_commit=$4 previous_digest=$5 previous_image=$6 previous_backup_id=$7
  local started ended backup_id final recipient_sha compose_sha env_sha other_env_sha
  local previous_file manifest_partial components

  gateway_require_directory "$BACKUP_ROOT" 700
  gateway_require_host_file "$COMPOSE_FILE"
  gateway_require_regular "$ENV_FILE" 600
  gateway_require_regular "$ARCHIVE_VALIDATOR" 600
  gateway_preflight_disk
  started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  backup_id="$(date -u +%Y%m%dT%H%M%SZ)-$commit"
  GATEWAY_PARTIAL_SET="$BACKUP_ROOT/${backup_id}.partial"
  final="$BACKUP_ROOT/$backup_id"
  [[ ! -e "$GATEWAY_PARTIAL_SET" && ! -e "$final" ]] ||
    gateway_die "backup set already exists: $backup_id"
  mkdir -m 0700 "$GATEWAY_PARTIAL_SET"
  if [[ "$GATEWAY_TEST_MODE" == 1 && "${GATEWAY_DEPLOY_TEST_SIGNAL_AFTER_PARTIAL:-0}" == 1 ]]; then
    kill -TERM "$$"
  fi

  gateway_stream_component database \
    "$GATEWAY_PARTIAL_SET/database.dump.age" \
    "$GATEWAY_PARTIAL_SET/database.list" \
    gateway_produce_database gateway_validate_database
  gateway_stream_component deployment \
    "$GATEWAY_PARTIAL_SET/deployment.tar.age" \
    "$GATEWAY_PARTIAL_SET/deployment.list" \
    gateway_produce_deployment_archive gateway_validate_deployment_archive

  compose_sha="$(gateway_hash_file "$COMPOSE_FILE")"
  env_sha="$(gateway_hash_file "$ENV_FILE")"
  other_env_sha="$(gateway_other_env_hash)"
  previous_file="$GATEWAY_PARTIAL_SET/previous.json"
  jq -n \
    --arg commit "$previous_commit" \
    --arg digest "$previous_digest" \
    --arg image "$previous_image" \
    --arg backup_id "$previous_backup_id" \
    --arg compose_sha256 "$compose_sha" \
    --arg env_sha256 "$env_sha" \
    --arg other_env_sha256 "$other_env_sha" '
      {
        commit:(if $commit=="" then null else $commit end),
        digest:(if $digest=="" then null else $digest end),
        image:(if $image=="" then null else $image end),
        backup_id:(if $backup_id=="" then null else $backup_id end),
        compose_sha256:$compose_sha256,
        env_sha256:$env_sha256,
        env_except_image_sha256:$other_env_sha256
      }
    ' >"$previous_file"
  chmod 0600 "$previous_file"
  gateway_fsync_path "$previous_file"

  components="$({
    gateway_component_record "$GATEWAY_PARTIAL_SET/database.dump.age" "$GATEWAY_PARTIAL_SET/database.list"
    gateway_component_record "$GATEWAY_PARTIAL_SET/database.list"
    gateway_component_record "$GATEWAY_PARTIAL_SET/deployment.tar.age" "$GATEWAY_PARTIAL_SET/deployment.list"
    gateway_component_record "$GATEWAY_PARTIAL_SET/deployment.list"
    gateway_component_record "$previous_file"
  } | jq -s .)"
  ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  recipient_sha="$(printf '%s' "$AGE_RECIPIENT" | sha256sum | awk '{print $1}')"
  manifest_partial="$GATEWAY_PARTIAL_SET/manifest.json.partial"
  jq -n \
    --arg schema 211api-predeploy-backup.v1 \
    --arg backup_id "$backup_id" \
    --arg role pre-deploy \
    --arg started_at "$started" \
    --arg validated_at "$ended" \
    --arg recipient_sha256 "$recipient_sha" \
    --arg target_commit "$commit" \
    --arg target_digest "$digest" \
    --arg previous_commit "$previous_commit" \
    --arg previous_digest "$previous_digest" \
    --arg previous_image "$previous_image" \
    --arg previous_backup_id "$previous_backup_id" \
    --argjson migration_sensitive "$migration_sensitive" \
    --argjson components "$components" '
      {
        schema:$schema,backup_id:$backup_id,role:$role,
        started_at:$started_at,validated_at:$validated_at,
        recipient_sha256:$recipient_sha256,lease_until:null,referenced_by:[],
        target:{commit:$target_commit,digest:$target_digest,
          migration_sensitive:$migration_sensitive},
        previous:{
          commit:(if $previous_commit=="" then null else $previous_commit end),
          digest:(if $previous_digest=="" then null else $previous_digest end),
          image:(if $previous_image=="" then null else $previous_image end),
          backup_id:(if $previous_backup_id=="" then null else $previous_backup_id end)
        },
        components:$components
      }
    ' >"$manifest_partial"
  chmod 0600 "$manifest_partial"
  gateway_fsync_path "$manifest_partial"
  mv -- "$manifest_partial" "$GATEWAY_PARTIAL_SET/manifest.json"
  gateway_fsync_path "$GATEWAY_PARTIAL_SET"
  mv -- "$GATEWAY_PARTIAL_SET" "$final"
  gateway_fsync_path "$BACKUP_ROOT"
  GATEWAY_PARTIAL_SET=
  GATEWAY_LAST_BACKUP=$final
  printf '%s\n' "$final"
}

gateway_remove_owned_partial() {
  local partial=${GATEWAY_PARTIAL_SET:-}
  [[ -n "$partial" && -d "$partial" && ! -L "$partial" ]] || return 0
  case "$partial" in
    "$BACKUP_ROOT"/????????T??????Z-????????????????????????????????????????.partial)
      rm -rf -- "$partial"
      GATEWAY_PARTIAL_SET=
      ;;
  esac
}

gateway_run_retention() {
  gateway_require_regular "$RETENTION_PROGRAM" 600
  local dry_run dry_run_sha applied
  dry_run="$(python3 "$RETENTION_PROGRAM" --root "$BACKUP_ROOT" --state "$STATE_FILE" --dry-run)"
  jq -e '.delete | type == "array"' <<<"$dry_run" >/dev/null ||
    gateway_die "retention dry-run returned invalid output"
  gateway_audit_event retention-plan success planned "count-$(jq '.delete | length' <<<"$dry_run")" ||
    gateway_die "unable to persist retention audit"
  dry_run_sha="$(printf '%s' "$dry_run" | sha256sum | awk '{print $1}')"
  applied="$(python3 "$RETENTION_PROGRAM" --root "$BACKUP_ROOT" --state "$STATE_FILE" \
    --apply --expected-plan-sha256 "$dry_run_sha")"
  [[ "$applied" == "$dry_run" ]] || gateway_die "retention apply output changed after dry-run"
}
