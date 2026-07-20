#!/usr/bin/env bash

set -euo pipefail
umask 077

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
GATEWAY_ROOT="$REPO_ROOT/deploy/gitea/gateway"
TEST_ROOT="$(mktemp -d)"
FIXTURE="$TEST_ROOT/gateway"
FAKE_BIN="$FIXTURE/fake-bin"
COMMAND_LOG="$FIXTURE/commands.log"
DOCKER_STATE="$FIXTURE/docker-state"
PROGRAM="$GATEWAY_ROOT/211api-deploy"
DISPATCHER="$GATEWAY_ROOT/211api-deploy-dispatch"
RESTORE="$GATEWAY_ROOT/211api-backup-restore-drill"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT HUP INT TERM

fail() {
  printf 'test-gateway-deployer: %s\n' "$1" >&2
  exit 1
}

expect_status() {
  local expected=$1
  shift
  local status=0
  "$@" >/dev/null 2>&1 || status=$?
  [[ "$status" == "$expected" ]] || fail "expected exit $expected, got $status: $*"
}

expect_failure() {
  local status=0
  "$@" >/dev/null 2>&1 || status=$?
  ((status != 0)) || fail "expected failure: $*"
}

mkdir -p "$FIXTURE/opt/211api/deploy" "$FIXTURE/run/lock"
chmod 0755 "$FIXTURE/opt" "$FIXTURE/opt/211api" "$FIXTURE/opt/211api/deploy" \
  "$FIXTURE/run"
chmod 1777 "$FIXTURE/run/lock"
"$GATEWAY_ROOT/install-gateway-deployer" --test-root "$FIXTURE" >/dev/null

for installed in \
  usr/local/sbin/211api-deploy \
  usr/local/sbin/211api-deploy-dispatch \
  usr/local/sbin/211api-backup-restore-drill; do
  [[ "$(stat -c '%a' "$FIXTURE/$installed")" == 755 ]] || fail "bad program mode: $installed"
done
[[ "$(stat -c '%a' "$FIXTURE/etc/211api-deploy")" == 700 ]]
[[ "$(stat -c '%a' "$FIXTURE/opt/211api/deploy/backups")" == 700 ]]
[[ "$(stat -c '%a' "$FIXTURE/var/log/211api-deploy/audit.jsonl")" == 600 ]]
jq -e '.schema == "211api-deployment-state.v1" and .commit == null' \
  "$FIXTURE/opt/211api/deploy/.deployment-state.json" >/dev/null
grep -q 'gateway-audit-rotate --max-size 10485760 --rotate 10' \
  "$FIXTURE/etc/logrotate.d/211api-deploy"
grep -q 'AUDIT_LOCK' "$FIXTURE/etc/211api-deploy/gateway-audit-rotate"
grep -q 'rotate 10' "$FIXTURE/etc/logrotate.d/211api-deploy"
! grep -q '/usr/bin/true' "$FIXTURE/etc/logrotate.d/211api-deploy"

chmod 1777 "$FIXTURE/opt"
expect_failure "$GATEWAY_ROOT/install-gateway-deployer" --test-root "$FIXTURE"
chmod 0755 "$FIXTURE/opt"

conflict="$TEST_ROOT/conflict"
mkdir -p "$conflict/opt/211api/deploy" "$conflict/usr/local/sbin"
ln -s /tmp/forbidden "$conflict/usr/local/sbin/211api-deploy"
expect_failure "$GATEWAY_ROOT/install-gateway-deployer" --test-root "$conflict"

mkdir -p "$FAKE_BIN" "$DOCKER_STATE" "$FIXTURE/root/.docker"
chmod 0700 "$FAKE_BIN" "$DOCKER_STATE" "$FIXTURE/root" "$FIXTURE/root/.docker"
: >"$COMMAND_LOG"
chmod 0600 "$COMMAND_LOG"

cat >"$FAKE_BIN/stub" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
name=${0##*/}
command_line=$name
for argument in "$@"; do
  printf -v command_line '%s <%s>' "$command_line" "$argument"
done
printf '%s\n' "$command_line" >>"$COMMAND_LOG"

case "$name" in
  curl)
    url=${!#}
    if [[ "$url" == http://127.0.0.1:8080/health ]]; then
      [[ "${HEALTH_FAIL:-0}" != 1 ]] || exit 22
      printf '{"status":"ok"}\n'
    elif [[ "$url" == */compare/* ]]; then
      case "${COMPARE_MODE:-normal}" in
        normal) printf '{"files":[{"filename":"README.md"}]}\n' ;;
        sensitive) printf '{"files":[{"filename":"backend/migrations/999_test.sql"}]}\n' ;;
        malformed) printf '{"files":"bad"}\n' ;;
        traversal) printf '{"files":[{"filename":"../backend/migrations/999_test.sql"}]}\n' ;;
      esac
    elif [[ "$url" == */branches/main ]]; then
      case "${API_MODE:-normal}" in
        timeout) exit 28 ;;
        non2xx) exit 22 ;;
        malformed) printf '{broken\n'; exit 0 ;;
      esac
      count_file="$DOCKER_STATE/head-count"
      count=0
      [[ ! -f "$count_file" ]] || count=$(<"$count_file")
      count=$((count + 1))
      printf '%s' "$count" >"$count_file"
      head=$TARGET_COMMIT
      if [[ "${HEAD_MODE:-normal}" == stale ||
        ( "${HEAD_MODE:-normal}" == advance && "$count" -ge 2 ) ]]; then
        head=ffffffffffffffffffffffffffffffffffffffff
      fi
      printf '{"protected":true,"commit":{"id":"%s"}}\n' "$head"
    else
      exit 22
    fi
    ;;
  age)
    if [[ "$1" == --encrypt ]]; then
      [[ "${FAKE_AGE_FAIL:-0}" != 1 ]] || exit 45
      base64
    elif [[ "$1" == --decrypt ]]; then
      base64 -d "${!#}"
    else
      exit 64
    fi
    ;;
  age-keygen)
    printf '%s\n' "$AGE_RECIPIENT"
    ;;
  findmnt)
    printf 'tmpfs\n'
    ;;
  sleep)
    exit 0
    ;;
  docker)
    args=" $* "
    if [[ "$1" == buildx && "$2" == imagetools && "$3" == inspect ]]; then
      if [[ "$args" == *" --raw "* ]]; then
        printf '{"mediaType":"application/vnd.oci.image.manifest.v1+json"}\n'
      elif [[ "$args" == *" --format "* ]]; then
        printf '{"os":"linux","architecture":"amd64","config":{"Labels":{"org.opencontainers.image.revision":"%s"}}}\n' "$TARGET_COMMIT"
      else
        printf 'Digest: %s\n' "$TARGET_DIGEST"
      fi
    elif [[ "$1" == compose ]]; then
      if [[ "$args" == *" pull "* && "${COMPOSE_PULL_FAIL:-0}" == 1 ]]; then
        exit 47
      fi
      if [[ "$args" == *" up "* && "${COMPOSE_UP_FAIL:-0}" == 1 ]]; then
        exit 48
      fi
      if [[ "$args" == *" logs "* ]]; then
        printf 'authorization=should-not-survive password=should-not-survive\n'
      elif [[ "$args" == *" ps "* ]]; then
        printf 'sub2api failed\n'
      fi
      exit 0
    elif [[ "$1" == exec || ( "$1" == exec && "$2" == -i ) ]]; then
      if [[ "$args" == *" restorecheck "* ]]; then
        [[ "$args" == *" --username postgres "* ]] || exit 64
      fi
      if [[ "$args" == *" pg_dump "* ]]; then
        [[ "${GATEWAY_DEPLOY_TEST_FAIL_PGDUMP:-0}" != 1 ]] || exit 41
        if [[ "${PGRESTORE_LIST_EARLY_EXIT:-0}" == 1 ]]; then
          head -c 1048576 /dev/zero | tr '\0' x
        else
          printf 'FAKE-CUSTOM-DUMP-%s' "$TARGET_COMMIT"
        fi
      elif [[ "$args" == *" pg_restore --list "* ]]; then
        if [[ "${PGRESTORE_LIST_EARLY_EXIT:-0}" == 1 ]]; then
          PATH="${0%/*}:/usr/sbin:/usr/bin:/sbin:/bin" sh -eu -c "${!#}"
        else
          cat >/dev/null
          printf '; fake pg_restore listing\n1; 0 0 TABLE public users postgres\n'
        fi
      elif [[ "$args" == *" pg_restore "* ]]; then
        cat >/dev/null
        [[ "${RESTORE_FAIL:-0}" != 1 ]] || exit 46
      elif [[ "$args" == *"pg_database_size"* ]]; then
        printf '1024\n'
      elif [[ "$args" == *" pg_isready "* ]]; then
        exit 0
      elif [[ "$args" == *"pg_catalog.pg_class"* ]]; then
        printf '12\n'
      elif [[ "$args" == *"pg_catalog.pg_constraint"* ]]; then
        printf '9\n'
      elif [[ "$args" == *"SELECT count(*) FROM users"* ]]; then
        printf '3\n4\n5\n'
      else
        exit 64
      fi
    elif [[ "$1" == inspect ]]; then
      if [[ "${2:-}" == --format ]]; then
        format=$3
        case "$format" in
          '{{.Image}}') printf 'sha256:local-image\n' ;;
          '{{.Config.Image}}')
            if [[ "${BASELINE_CONFIG_MAIN:-0}" == 1 ]]; then
              printf '%s:main\n' "$REGISTRY_IMAGE"
            else
              printf '%s:%s@%s\n' "$REGISTRY_IMAGE" "$TARGET_COMMIT" "$TARGET_DIGEST"
            fi
            ;;
          *org.opencontainers.image.revision*)
            [[ "${BASELINE_NO_REVISION:-0}" == 1 ]] || printf '%s\n' "$TARGET_COMMIT"
            ;;
          *com.211api.restore-run*)
            resource=${4:-}
            [[ -f "$DOCKER_STATE/container-$resource" ]] || exit 1
            sed -n '1p' "$DOCKER_STATE/container-$resource"
            ;;
          *) exit 64 ;;
        esac
      else
        resource=${2:-}
        if [[ "$resource" == 211api-drill-* ]]; then
          [[ -f "$DOCKER_STATE/container-$resource" ]] || exit 1
          cat "$DOCKER_STATE/container-$resource.inspect"
        else
          exit 1
        fi
      fi
    elif [[ "$1" == image && "$2" == inspect ]]; then
      if [[ "${3:-}" == --format ]]; then
        case "$4" in
          '{{.Id}}') printf 'sha256:local-image\n' ;;
          '{{json .RepoDigests}}') printf '["%s@%s"]\n' "$REGISTRY_IMAGE" "$TARGET_DIGEST" ;;
          '{{json .RepoTags}}')
            if [[ "${BASELINE_REPO_TAG_MODE:-exact}" == suffix ]]; then
              printf '["%s:%s-extra"]\n' "$REGISTRY_IMAGE" "$TARGET_COMMIT"
            else
              printf '["%s:main","%s:%s"]\n' "$REGISTRY_IMAGE" "$REGISTRY_IMAGE" "$TARGET_COMMIT"
            fi
            ;;
          *) exit 64 ;;
        esac
      else
        exit 0
      fi
    elif [[ "$1" == volume && "$2" == inspect ]]; then
      if [[ "${3:-}" == --format ]]; then
        volume=${5:-}
        [[ -f "$DOCKER_STATE/volume-$volume" ]] || exit 1
        cat "$DOCKER_STATE/volume-$volume"
      else
        volume=${3:-}
        [[ -f "$DOCKER_STATE/volume-$volume" ]]
      fi
    elif [[ "$1" == volume && "$2" == create ]]; then
      volume=${!#}
      label=${4#com.211api.restore-run=}
      printf '%s' "$label" >"$DOCKER_STATE/volume-$volume"
      printf '%s\n' "$volume"
    elif [[ "$1" == volume && "$2" == rm ]]; then
      rm -f -- "$DOCKER_STATE/volume-$3"
    elif [[ "$1" == run && "$2" == -d ]]; then
      container=
      label=
      network_mode=default
      port_bindings=null
      mounts='[]'
      for ((i = 1; i <= $#; i++)); do
        arg=${!i}
        case "$arg" in
          --name)
            j=$((i + 1))
            container=${!j}
            ;;
          --label)
            j=$((i + 1))
            label=${!j}
            ;;
          --network)
            j=$((i + 1))
            network_mode=${!j}
            ;;
          -p | --publish | -p=* | --publish=*)
            port_bindings='{"fixture":{}}'
            ;;
          --mount)
            j=$((i + 1))
            mount_spec=${!j}
            IFS=',' read -r mount_type mount_src mount_dst mount_extra <<<"$mount_spec"
            [[ "$mount_type" == type=volume && "$mount_src" == src=* &&
              "$mount_dst" == dst=* && -z "$mount_extra" ]]
            mounts="$(jq -c --arg name "${mount_src#src=}" \
              --arg destination "${mount_dst#dst=}" \
              '. + [{Type:"volume",Name:$name,Destination:$destination}]' <<<"$mounts")"
            ;;
        esac
      done
      [[ -n "$container" && "$label" == com.211api.restore-run=* ]]
      if [[ "${FAKE_DOCKER_EXTRA_ANONYMOUS_VOLUME:-0}" == 1 ]]; then
        mounts="$(jq -c \
          '. + [{Type:"volume",Name:"anonymous-parent-volume",Destination:"/var/lib/postgresql"}]' \
          <<<"$mounts")"
      fi
      printf '%s' "${label#*=}" >"$DOCKER_STATE/container-$container"
      jq -n --arg network_mode "$network_mode" --arg run_id "${label#*=}" \
        --argjson port_bindings "$port_bindings" --argjson mounts "$mounts" '
        [{HostConfig:{NetworkMode:$network_mode,PortBindings:$port_bindings},
          Config:{Labels:{"com.211api.restore-run":$run_id}},Mounts:$mounts}]
      ' >"$DOCKER_STATE/container-$container.inspect"
      printf 'fake-container-id\n'
    elif [[ "$1" == rm && "$2" == -f ]]; then
      rm -f -- "$DOCKER_STATE/container-$3" "$DOCKER_STATE/container-$3.inspect"
    else
      exit 64
    fi
    ;;
  pg_restore)
    [[ "$1" == --list ]]
    head -c 1 >/dev/null
    printf '; early pg_restore listing\n1; 0 0 TABLE public users postgres\n'
    ;;
  *)
    exit 64
    ;;
esac
STUB
chmod 0755 "$FAKE_BIN/stub"
for command in curl docker age age-keygen findmnt sleep pg_restore; do
  ln -s stub "$FAKE_BIN/$command"
done

TARGET_COMMIT=2222222222222222222222222222222222222222
TARGET_DIGEST=sha256:2222222222222222222222222222222222222222222222222222222222222222
PREVIOUS_COMMIT=1111111111111111111111111111111111111111
PREVIOUS_DIGEST=sha256:1111111111111111111111111111111111111111111111111111111111111111
REGISTRY_IMAGE=git.211api.com/211api/211api
AGE_RECIPIENT="age1$(printf 'q%.0s' {1..58})"
export TARGET_COMMIT TARGET_DIGEST PREVIOUS_COMMIT PREVIOUS_DIGEST REGISTRY_IMAGE
export AGE_RECIPIENT COMMAND_LOG DOCKER_STATE

DEPLOY_DIR="$FIXTURE/opt/211api/deploy"
CONFIG_ROOT="$FIXTURE/etc/211api-deploy"
BACKUP_ROOT="$DEPLOY_DIR/backups"
STATE_FILE="$DEPLOY_DIR/.deployment-state.json"
AUDIT_FILE="$FIXTURE/var/log/211api-deploy/audit.jsonl"

printf 'services:\n  sub2api:\n    image: ${SUB2API_IMAGE}\n' >"$DEPLOY_DIR/docker-compose.yml"
chmod 0644 "$DEPLOY_DIR/docker-compose.yml"
printf 'header = "Authorization: token AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"\n' \
  >"$CONFIG_ROOT/gitea-head-api.curl"
chmod 0600 "$CONFIG_ROOT/gitea-head-api.curl"
printf '%s\n' "$AGE_RECIPIENT" >"$CONFIG_ROOT/age-recipient"
chmod 0600 "$CONFIG_ROOT/age-recipient"
recipient_sha="$(printf '%s' "$AGE_RECIPIENT" | sha256sum | awk '{print $1}')"
jq -n --arg sha "$recipient_sha" \
  '{schema:"211api-age-key-metadata.v1",recipient_sha256:$sha,
    custody_verified_at:"2026-07-18T00:00:00Z",rotation_due:"2026-10-16T00:00:00Z"}' \
  >"$CONFIG_ROOT/key-metadata.json"
chmod 0600 "$CONFIG_ROOT/key-metadata.json"
printf '{}\n' >"$FIXTURE/root/.docker/config.json"
chmod 0600 "$FIXTURE/root/.docker/config.json"

write_previous_state() {
  jq -n \
    --arg commit "$PREVIOUS_COMMIT" --arg digest "$PREVIOUS_DIGEST" \
    --arg image "$REGISTRY_IMAGE:$PREVIOUS_COMMIT@$PREVIOUS_DIGEST" '
      {schema:"211api-deployment-state.v1",commit:$commit,digest:$digest,image:$image,
       backup_id:null,deployed_at:"2026-07-17T00:00:00Z",previous_commit:null,
       previous_digest:null,predecessor_backup_id:null,known_good_backup_id:null}
    ' >"$STATE_FILE"
  chmod 0600 "$STATE_FILE"
}

reset_fixture() {
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  find "$CONFIG_ROOT/migration-approvals" -mindepth 1 -maxdepth 1 -type f -delete
  : >"$AUDIT_FILE"
  : >"$COMMAND_LOG"
  rm -f -- "$DOCKER_STATE/head-count" "$FIXTURE/var/log/211api-deploy/failure.log"
  printf 'SUB2API_IMAGE=%s:%s@%s\nPOSTGRES_PASSWORD=supersecret\nUNCHANGED=value\n' \
    "$REGISTRY_IMAGE" "$PREVIOUS_COMMIT" "$PREVIOUS_DIGEST" >"$DEPLOY_DIR/.env"
  chmod 0600 "$DEPLOY_DIR/.env"
  write_previous_state
}

base_env=(
  GATEWAY_DEPLOY_TESTING=1
  GATEWAY_DEPLOY_TEST_ROOT="$FIXTURE"
  GATEWAY_DEPLOY_TEST_BIN="$FAKE_BIN"
  GATEWAY_DEPLOY_TEST_SKIP_DISK=1
  GATEWAY_DEPLOY_TEST_HEALTH_ATTEMPTS=2
  GATEWAY_DEPLOY_TEST_HEALTH_INTERVAL=0
)

run_deploy() {
  if [[ "${TRACE_GATEWAY_DEPLOY:-0}" == 1 ]]; then
    env "${base_env[@]}" "$@" bash -x "$PROGRAM" deploy --commit "$TARGET_COMMIT" --digest "$TARGET_DIGEST"
  else
    env "${base_env[@]}" "$@" "$PROGRAM" deploy --commit "$TARGET_COMMIT" --digest "$TARGET_DIGEST"
  fi
}

# /run is tmpfs in production; every entry point recreates its owned runtime.
reset_fixture
rm -rf -- "$FIXTURE/run/211api-deploy"
rm -f -- "$FIXTURE/run/lock/211api-deploy.lock" "$FIXTURE/run/lock/211api-deploy-audit.lock"
env "${base_env[@]}" "$PROGRAM" status >"$TEST_ROOT/status.json"
jq -e '.schema == "211api-deploy-status.v1" and .ready == true
  and .repository == "211api/211api"' "$TEST_ROOT/status.json" >/dev/null
[[ -d "$FIXTURE/run/211api-deploy" && "$(stat -c '%a' "$FIXTURE/run/211api-deploy")" == 700 ]]
[[ -f "$FIXTURE/run/lock/211api-deploy.lock" && -f "$FIXTURE/run/lock/211api-deploy-audit.lock" ]]

# Forced-command dispatcher: exact grammar, source parsing, and environment wipe.
dispatch_probe="$TEST_ROOT/dispatch-probe"
cat >"$dispatch_probe" <<'PROBE'
#!/usr/bin/env bash
set -euo pipefail
[[ -z "${MALICIOUS:-}" ]]
[[ "$PATH" == /usr/sbin:/usr/bin:/sbin:/bin ]]
[[ "$GATEWAY_DEPLOY_DISPATCH" == 1 ]]
[[ "$GATEWAY_DEPLOY_SOURCE_IP" == 37.221.194.27 ]]
printf '%s\n' "$*" >>"${0}.log"
PROBE
chmod 0755 "$dispatch_probe"
DISPATCH_LOG="$dispatch_probe.log"
dispatch_env=(
  GATEWAY_DEPLOY_DISPATCH_TESTING=1
  GATEWAY_DEPLOY_DISPATCH_TEST_PROGRAM="$dispatch_probe"
  SSH_CONNECTION="37.221.194.27 54321 157.254.234.244 4422"
  DISPLAY=
  SSH_AUTH_SOCK=
  SSH_TTY=
  MALICIOUS=injected
)
env "${dispatch_env[@]}" SSH_ORIGINAL_COMMAND=status "$DISPATCHER"
env "${dispatch_env[@]}" SSH_ORIGINAL_COMMAND="deploy --commit $TARGET_COMMIT --digest $TARGET_DIGEST" "$DISPATCHER"
grep -qx status "$DISPATCH_LOG"
grep -qx "deploy --commit $TARGET_COMMIT --digest $TARGET_DIGEST" "$DISPATCH_LOG"
for bad in \
  "shell" \
  "approve-migration --commit $TARGET_COMMIT --digest $TARGET_DIGEST --expires-in 30m" \
  "deploy --record-baseline --commit $TARGET_COMMIT --digest $TARGET_DIGEST" \
  "deploy --commit $TARGET_COMMIT --digest $TARGET_DIGEST extra" \
  "deploy; id" \
  "deploy --commit deadbeef --digest $TARGET_DIGEST"; do
  expect_status 64 env "${dispatch_env[@]}" SSH_ORIGINAL_COMMAND="$bad" "$DISPATCHER"
done
expect_status 64 env "${dispatch_env[@]}" SSH_CONNECTION="1.2.3.4 5 6.7.8.9 4422" \
  SSH_ORIGINAL_COMMAND=status "$DISPATCHER"
expect_status 64 env "${dispatch_env[@]}" SSH_CONNECTION="37.221.194.27 x 6.7.8.9 4422" \
  SSH_ORIGINAL_COMMAND=status "$DISPATCHER"
expect_status 64 env "${dispatch_env[@]}" SSH_TTY=/dev/pts/1 SSH_ORIGINAL_COMMAND=status "$DISPATCHER"
expect_status 64 env "${dispatch_env[@]}" SSH_AUTH_SOCK=/tmp/agent SSH_ORIGINAL_COMMAND=status "$DISPATCHER"

# The Task-12 baseline branch is human-only and never changes env or containers.
reset_fixture
printf 'SUB2API_IMAGE=%s:main\nPOSTGRES_PASSWORD=supersecret\nUNCHANGED=value\n' \
  "$REGISTRY_IMAGE" >"$DEPLOY_DIR/.env"
chmod 0600 "$DEPLOY_DIR/.env"
baseline_env_hash="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
baseline_state_hash="$(sha256sum "$STATE_FILE" | awk '{print $1}')"
: >"$COMMAND_LOG"
expect_failure env "${base_env[@]}" \
  GATEWAY_DEPLOY_TEST_CONFIRM_BASELINE="BACKUP BASELINE $TARGET_COMMIT $TARGET_DIGEST" \
  BASELINE_CONFIG_MAIN=1 BASELINE_NO_REVISION=1 BASELINE_REPO_TAG_MODE=suffix \
  "$PROGRAM" deploy --record-baseline --commit "$TARGET_COMMIT" --digest "$TARGET_DIGEST"
[[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$baseline_env_hash" ]]
[[ "$(sha256sum "$STATE_FILE" | awk '{print $1}')" == "$baseline_state_hash" ]]
reset_fixture
printf 'SUB2API_IMAGE=%s:main\nPOSTGRES_PASSWORD=supersecret\nUNCHANGED=value\n' \
  "$REGISTRY_IMAGE" >"$DEPLOY_DIR/.env"
chmod 0600 "$DEPLOY_DIR/.env"
env "${base_env[@]}" \
  GATEWAY_DEPLOY_TEST_CONFIRM_BASELINE="BACKUP BASELINE $TARGET_COMMIT $TARGET_DIGEST" \
  BASELINE_CONFIG_MAIN=1 BASELINE_NO_REVISION=1 \
  "$PROGRAM" deploy --record-baseline --commit "$TARGET_COMMIT" --digest "$TARGET_DIGEST" \
  >/dev/null
[[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$baseline_env_hash" ]]
jq -e --arg commit "$TARGET_COMMIT" '.commit == $commit and .backup_id != null' "$STATE_FILE" >/dev/null
! rg -q 'docker <compose>.*<(pull|up)>' "$COMMAND_LOG"

# A real pg_restore --list may stop after the archive TOC. The validator must
# preserve its status and drain the remaining large stream without SIGPIPE.
reset_fixture
printf 'SUB2API_IMAGE=%s:main\nPOSTGRES_PASSWORD=supersecret\nUNCHANGED=value\n' \
  "$REGISTRY_IMAGE" >"$DEPLOY_DIR/.env"
chmod 0600 "$DEPLOY_DIR/.env"
env "${base_env[@]}" \
  GATEWAY_DEPLOY_TEST_CONFIRM_BASELINE="BACKUP BASELINE $TARGET_COMMIT $TARGET_DIGEST" \
  BASELINE_CONFIG_MAIN=1 BASELINE_NO_REVISION=1 PGRESTORE_LIST_EARLY_EXIT=1 \
  "$PROGRAM" deploy --record-baseline --commit "$TARGET_COMMIT" --digest "$TARGET_DIGEST" \
  >/dev/null
jq -e --arg commit "$TARGET_COMMIT" '.commit == $commit and .backup_id != null' "$STATE_FILE" >/dev/null
[[ -z "$(find "$BACKUP_ROOT" -name '*.partial' -print -quit)" ]]
backup_dir="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -print -quit)"
rg -q '^; early pg_restore listing$' "$backup_dir/database.list"

# Normal deploy: immutable manifest, encrypted backup, one env line, state, and audit.
reset_fixture
before_other="$(python3 -c 'import hashlib,pathlib; p=pathlib.Path("'"$DEPLOY_DIR/.env"'"); print(hashlib.sha256(b"".join(x for x in p.read_bytes().splitlines(keepends=True) if not x.startswith(b"SUB2API_IMAGE="))).hexdigest())')"
run_deploy env >/dev/null
grep -qx "SUB2API_IMAGE=$REGISTRY_IMAGE:$TARGET_COMMIT@$TARGET_DIGEST" "$DEPLOY_DIR/.env"
[[ "$(grep -c '^SUB2API_IMAGE=' "$DEPLOY_DIR/.env")" == 1 ]]
after_other="$(python3 -c 'import hashlib,pathlib; p=pathlib.Path("'"$DEPLOY_DIR/.env"'"); print(hashlib.sha256(b"".join(x for x in p.read_bytes().splitlines(keepends=True) if not x.startswith(b"SUB2API_IMAGE="))).hexdigest())')"
[[ "$before_other" == "$after_other" ]] || fail "non-image env content changed"
jq -e --arg commit "$TARGET_COMMIT" --arg digest "$TARGET_DIGEST" \
  '.commit == $commit and .digest == $digest and .backup_id != null' "$STATE_FILE" >/dev/null
backup_dir="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[[ -n "$backup_dir" && -f "$backup_dir/manifest.json" ]]
[[ -z "$(find "$BACKUP_ROOT" -name '*.partial' -print -quit)" ]]
! rg -a -q 'supersecret' "$backup_dir"
rg -q '"event":"deploy-complete"' "$AUDIT_FILE"

# Lock contention returns 75 before backup or environment mutation.
reset_fixture
env_before="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
exec 8>"$FIXTURE/run/lock/211api-deploy.lock"
flock -n 8
expect_status 75 run_deploy env
flock -u 8
exec 8>&-
[[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$env_before" ]]
[[ -z "$(find "$BACKUP_ROOT" -mindepth 1 -print -quit)" ]]

# Stale before backup and head advance during backup both fail closed.
reset_fixture
env_before="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
expect_status 76 run_deploy env HEAD_MODE=stale
[[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$env_before" ]]
[[ -z "$(find "$BACKUP_ROOT" -mindepth 1 -print -quit)" ]]

reset_fixture
env_before="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
expect_status 76 run_deploy env HEAD_MODE=advance
[[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$env_before" ]]
[[ "$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | wc -l)" == 1 ]]

# API and backup/audit fault injection leaves production bytes untouched.
for mode in timeout non2xx malformed; do
  reset_fixture
  env_before="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
  expect_failure run_deploy env API_MODE="$mode"
  [[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$env_before" ]]
done
for compare_mode in malformed traversal; do
  reset_fixture
  env_before="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
  expect_failure run_deploy env COMPARE_MODE="$compare_mode"
  [[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$env_before" ]]
done
for fault in GATEWAY_DEPLOY_TEST_FAIL_PGDUMP=1 GATEWAY_DEPLOY_TEST_FAIL_VALIDATOR=1 \
  GATEWAY_DEPLOY_TEST_FAIL_ARCHIVE=1 GATEWAY_DEPLOY_TEST_FAIL_ARCHIVE_VALIDATOR=1 \
  FAKE_AGE_FAIL=1 GATEWAY_DEPLOY_TEST_FAIL_FSYNC=1 GATEWAY_DEPLOY_TEST_FAIL_FDATASYNC=1 \
  GATEWAY_DEPLOY_TEST_FAIL_AUDIT=1 \
  GATEWAY_DEPLOY_TEST_FAIL_DISK=1; do
  reset_fixture
  env_before="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
  if [[ "$fault" == GATEWAY_DEPLOY_TEST_FAIL_DISK=1 ]]; then
    expect_failure run_deploy env GATEWAY_DEPLOY_TEST_SKIP_DISK=0 "$fault"
  else
    expect_failure run_deploy env "$fault"
  fi
  [[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$env_before" ]]
  [[ -z "$(find "$BACKUP_ROOT" -name '*.partial' -print -quit)" ]]
done

reset_fixture
env_before="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
expect_failure run_deploy env GATEWAY_DEPLOY_TEST_FAIL_ENV_WRITE=1
[[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$env_before" ]]
[[ -z "$(find "$DEPLOY_DIR" -maxdepth 1 -name '.*.211api-deploy-*.partial' -print -quit)" ]]

reset_fixture
env_before="$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')"
expect_status 143 run_deploy env GATEWAY_DEPLOY_TEST_SIGNAL_AFTER_PARTIAL=1
[[ "$(sha256sum "$DEPLOY_DIR/.env" | awk '{print $1}')" == "$env_before" ]]
[[ -z "$(find "$BACKUP_ROOT" -mindepth 1 -print -quit)" ]]

# Pull/start failures retain encrypted evidence and never attempt restoration.
for compose_fault in COMPOSE_PULL_FAIL=1 COMPOSE_UP_FAIL=1; do
  reset_fixture
  expect_failure run_deploy env "$compose_fault"
  [[ "$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | wc -l)" == 1 ]]
  jq -e --arg commit "$PREVIOUS_COMMIT" '.commit == $commit' "$STATE_FILE" >/dev/null
  [[ -f "$FIXTURE/var/log/211api-deploy/failure.log" ]]
  ! rg -q 'should-not-survive' "$FIXTURE/var/log/211api-deploy/failure.log"
  rg -q '<redacted>' "$FIXTURE/var/log/211api-deploy/failure.log"
  ! rg -q 'pg_restore .*--dbname' "$COMMAND_LOG"
done

# Health failure keeps the validated backup/evidence and never runs a restore.
reset_fixture
expect_failure run_deploy env HEALTH_FAIL=1
grep -qx "SUB2API_IMAGE=$REGISTRY_IMAGE:$TARGET_COMMIT@$TARGET_DIGEST" "$DEPLOY_DIR/.env"
[[ -f "$FIXTURE/var/log/211api-deploy/failure.log" ]]
! rg -q 'should-not-survive' "$FIXTURE/var/log/211api-deploy/failure.log"
rg -q '<redacted>' "$FIXTURE/var/log/211api-deploy/failure.log"
jq -e --arg commit "$PREVIOUS_COMMIT" '.commit == $commit' "$STATE_FILE" >/dev/null
! rg -q 'pg_restore .*--dbname' "$COMMAND_LOG"
env "${base_env[@]}" HEALTH_FAIL=1 "$PROGRAM" status >"$TEST_ROOT/failed-status.json"
jq -e '.state_env_consistent == false and .intervention_required == true' \
  "$TEST_ROOT/failed-status.json" >/dev/null

# Migration approval records are exact, expire, and are consumed once.
reset_fixture
approval="$CONFIG_ROOT/migration-approvals/$TARGET_COMMIT-${TARGET_DIGEST#sha256:}.json"
created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
expires="$(date -u -d '+30 minutes' +%Y-%m-%dT%H:%M:%SZ)"
paths_sha="$(printf 'backend/migrations/999_test.sql\n' | sha256sum | awk '{print $1}')"
jq -n --arg commit "$TARGET_COMMIT" --arg digest "$TARGET_DIGEST" \
  --arg created "$created" --arg expires "$expires" --arg paths_sha "$paths_sha" '
  {schema:"211api-migration-approval.v1",commit:$commit,digest:$digest,
   nonce:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",operator:"operator",
   created_at:$created,expires_at:$expires,sensitive_paths_sha256:$paths_sha}
' >"$approval"
chmod 0600 "$approval"
run_deploy env COMPARE_MODE=sensitive >/dev/null
[[ ! -e "$approval" ]]
consumed="$CONFIG_ROOT/consumed-approvals/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-$TARGET_COMMIT-${TARGET_DIGEST#sha256:}.json"
[[ -f "$consumed" ]]
reset_fixture
cp -- "$consumed" "$approval"
chmod 0600 "$approval"
expect_status 78 run_deploy env COMPARE_MODE=sensitive

for mismatch in commit digest; do
  reset_fixture
  bad_commit=$TARGET_COMMIT
  bad_digest=$TARGET_DIGEST
  [[ "$mismatch" != commit ]] || bad_commit=3333333333333333333333333333333333333333
  [[ "$mismatch" != digest ]] || bad_digest=sha256:3333333333333333333333333333333333333333333333333333333333333333
  jq -n --arg commit "$bad_commit" --arg digest "$bad_digest" \
    --arg created "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg expires "$(date -u -d '+30 minutes' +%Y-%m-%dT%H:%M:%SZ)" \
    --arg paths_sha "$paths_sha" '
    {schema:"211api-migration-approval.v1",commit:$commit,digest:$digest,
     nonce:"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",operator:"operator",
     created_at:$created,expires_at:$expires,sensitive_paths_sha256:$paths_sha}
  ' >"$approval"
  chmod 0600 "$approval"
  expect_status 78 run_deploy env COMPARE_MODE=sensitive
done

reset_fixture
jq -n --arg commit "$TARGET_COMMIT" --arg digest "$TARGET_DIGEST" \
  --arg created "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg expires "$(date -u -d '+30 minutes' +%Y-%m-%dT%H:%M:%SZ)" '
  {schema:"211api-migration-approval.v1",commit:$commit,digest:$digest,
   nonce:"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",operator:"operator",
   created_at:$created,expires_at:$expires,
   sensitive_paths_sha256:"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}
' >"$approval"
chmod 0600 "$approval"
expect_status 78 run_deploy env COMPARE_MODE=sensitive

reset_fixture
jq -n --arg commit "$TARGET_COMMIT" --arg digest "$TARGET_DIGEST" --arg paths_sha "$paths_sha" '
  {schema:"211api-migration-approval.v1",commit:$commit,digest:$digest,
   nonce:"cccccccccccccccccccccccccccccccc",operator:"operator",
   created_at:"2026-07-17T00:00:00Z",expires_at:"2026-07-17T00:30:00Z",
   sensitive_paths_sha256:$paths_sha}
' >"$approval"
chmod 0600 "$approval"
expect_status 78 run_deploy env COMPARE_MODE=sensitive
expect_status 78 env "${base_env[@]}" GATEWAY_DEPLOY_DISPATCH=1 \
  GATEWAY_DEPLOY_SOURCE_IP=37.221.194.27 \
  SSH_ORIGINAL_COMMAND="approve-migration" "$PROGRAM" approve-migration \
  --commit "$TARGET_COMMIT" --digest "$TARGET_DIGEST" --expires-in 30m
expect_status 78 env "${base_env[@]}" CI=true "$PROGRAM" approve-migration \
  --commit "$TARGET_COMMIT" --digest "$TARGET_DIGEST" --expires-in 30m

# Restore the successful encrypted dump into an owned network-none fixture.
reset_fixture
run_deploy env >/dev/null
backup_dir="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
backup_id=${backup_dir##*/}
identity="$FIXTURE/run/operator-age.key"
printf 'nonsecret-test-identity-fixture\n' >"$identity"
chmod 0600 "$identity"
env "${base_env[@]}" \
  GATEWAY_DEPLOY_TEST_CONFIRM_RESTORE="RESTORE $backup_id" \
  "$RESTORE" --backup-id "$backup_id" --identity "$identity" \
  >"$TEST_ROOT/restore-result.json"
jq -e '.schema == "211api-restore-drill-result.v1" and .tables == 12
  and .constraints == 9 and .representative_rows.users == 3' \
  "$TEST_ROOT/restore-result.json" >/dev/null
rg -q 'docker <run> <-d>.*<--network> <none>' "$COMMAND_LOG"
! rg -q 'docker <run>.*<-p>|docker <run>.*<--publish>' "$COMMAND_LOG"
rg -q 'docker <run>.*<--mount> <type=volume,src=211api-drill-[^,]*-data,dst=/var/lib/postgresql>' "$COMMAND_LOG"
! rg -q 'docker <run>.*<--mount> <type=volume,[^>]*dst=/var/lib/postgresql/data>' "$COMMAND_LOG"
[[ "$(rg -c 'docker <exec>.*<--username> <postgres>.*<--dbname> <restorecheck>' "$COMMAND_LOG")" == 5 ]]
[[ -z "$(find "$DOCKER_STATE" -name 'container-*' -o -name 'volume-*')" ]]
jq -e '.referenced_by == [] and .lease_until == null' "$backup_dir/manifest.json" >/dev/null
expect_status 64 env "${base_env[@]}" "$RESTORE" --backup-id '../live' --identity "$identity"

# Reproduce the PostgreSQL 18 parent-VOLUME failure class: any additional
# anonymous mount must fail the isolation check and clean only drill resources.
expect_failure env "${base_env[@]}" FAKE_DOCKER_EXTRA_ANONYMOUS_VOLUME=1 \
  GATEWAY_DEPLOY_TEST_CONFIRM_RESTORE="RESTORE $backup_id" \
  "$RESTORE" --backup-id "$backup_id" --identity "$identity"
[[ -z "$(find "$DOCKER_STATE" \( -name 'container-211api-drill-*' -o -name 'volume-211api-drill-*' \) -print -quit)" ]]
jq -e '.referenced_by == [] and .lease_until == null' "$backup_dir/manifest.json" >/dev/null

printf 'preserve\n' >"$DOCKER_STATE/volume-production-sentinel"
expect_failure env "${base_env[@]}" RESTORE_FAIL=1 \
  GATEWAY_DEPLOY_TEST_CONFIRM_RESTORE="RESTORE $backup_id" \
  "$RESTORE" --backup-id "$backup_id" --identity "$identity"
[[ -f "$DOCKER_STATE/volume-production-sentinel" ]]
[[ -z "$(find "$DOCKER_STATE" \( -name 'container-211api-drill-*' -o -name 'volume-211api-drill-*' \) -print -quit)" ]]
jq -e '.referenced_by == [] and .lease_until == null' "$backup_dir/manifest.json" >/dev/null

# The archive validator rejects malformed/extra plaintext before encryption.
expect_failure bash -c "printf not-a-tar | python3 '$GATEWAY_ROOT/gateway-validate-archive.py'"
archive_fixture="$TEST_ROOT/archive-extra"
mkdir -p "$archive_fixture"
printf x >"$archive_fixture/docker-compose.yml"
printf y >"$archive_fixture/.env"
printf z >"$archive_fixture/extra"
expect_failure bash -c "tar -C '$archive_fixture' -cf - docker-compose.yml .env extra | python3 '$GATEWAY_ROOT/gateway-validate-archive.py'"

# Retention keeps active leases/newest three and removes an expired stale ref.
retention_root="$TEST_ROOT/retention"
retention_state="$TEST_ROOT/retention-state.json"
mkdir -m 0700 "$retention_root"
for digit in 1 2 3 4 5; do
  commit="$(printf '%*s' 40 '' | tr ' ' "$digit")"
  set_id="2026070${digit}T000000Z-$commit"
  cp -a -- "$backup_dir" "$retention_root/$set_id"
  referenced='[]'
  lease=null
  if [[ "$digit" == 1 ]]; then
    referenced='["restore-stale"]'
    lease='"2020-01-01T00:00:00Z"'
  elif [[ "$digit" == 2 ]]; then
    referenced='["restore-active"]'
    lease='"2099-01-01T00:00:00Z"'
  fi
  jq --arg id "$set_id" --arg commit "$commit" \
    --arg validated_at "2026-07-0${digit}T00:00:00Z" \
    --argjson referenced "$referenced" --argjson lease "$lease" '
      .backup_id=$id | .target.commit=$commit | .validated_at=$validated_at
      | .referenced_by=$referenced | .lease_until=$lease
    ' "$retention_root/$set_id/manifest.json" >"$retention_root/$set_id/manifest.new"
  chmod 0600 "$retention_root/$set_id/manifest.new"
  mv -- "$retention_root/$set_id/manifest.new" "$retention_root/$set_id/manifest.json"
done
printf '{"schema":"211api-deployment-state.v1"}\n' >"$retention_state"
chmod 0600 "$retention_state"
retention_plan="$(python3 "$GATEWAY_ROOT/gateway-retention.py" \
  --root "$retention_root" --state "$retention_state" --dry-run)"
jq -e '.delete == ["20260701T000000Z-1111111111111111111111111111111111111111"]' \
  <<<"$retention_plan" >/dev/null
retention_plan_sha="$(printf '%s' "$retention_plan" | sha256sum | awk '{print $1}')"
python3 "$GATEWAY_ROOT/gateway-retention.py" \
  --root "$retention_root" --state "$retention_state" --apply \
  --expected-plan-sha256 "$retention_plan_sha" >/dev/null
[[ ! -e "$retention_root/20260701T000000Z-1111111111111111111111111111111111111111" ]]
[[ -e "$retention_root/20260702T000000Z-2222222222222222222222222222222222222222" ]]

# Audit rotation is bounded and takes the dedicated lock.
truncate -s 10485760 "$AUDIT_FILE"
reset_head="$DOCKER_STATE/head-count"
rm -f -- "$reset_head"
expect_status 76 run_deploy env HEAD_MODE=stale
[[ -f "$FIXTURE/var/log/211api-deploy/audit.jsonl.1.gz" ]]
[[ "$(stat -c '%s' "$AUDIT_FILE")" -lt 10485760 ]]

printf 'Gateway deployer, dispatcher, backup, approval, restore, and audit fixtures passed\n'
