#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LOCK="$ROOT/deploy/gitea/images.lock.env"
COMPOSE="$ROOT/deploy/gitea/runner/compose.yaml"
OVERRIDE="$ROOT/deploy/gitea/runner/tests/compose.smoke.yaml"
suffix="$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
tmp="$(mktemp -d)"
runner_start_log="$tmp/runner-start.log"

export GITEA_RUNNER_SMOKE_PROJECT="gitea-runner-smoke-$suffix"
export GITEA_RUNNER_SMOKE_DATA_VOLUME="$GITEA_RUNNER_SMOKE_PROJECT-data"
export GITEA_RUNNER_SMOKE_DOCKER_DATA_VOLUME="$GITEA_RUNNER_SMOKE_PROJECT-docker-data"
export GITEA_RUNNER_SMOKE_RUNTIME_VOLUME="$GITEA_RUNNER_SMOKE_PROJECT-runtime"
export GITEA_RUNNER_SMOKE_NETWORK="$GITEA_RUNNER_SMOKE_PROJECT-network"
export GITEA_RUNNER_SMOKE_DOCKER_CONTAINER="$GITEA_RUNNER_SMOKE_PROJECT-docker"
export GITEA_RUNNER_SMOKE_RUNNER_CONTAINER="$GITEA_RUNNER_SMOKE_PROJECT-runner"
export GITEA_RUNNER_SMOKE_CACHE_CONTAINER="$GITEA_RUNNER_SMOKE_PROJECT-cache-endpoint"

set -a
# shellcheck source=/dev/null
source "$LOCK"
set +a

compose() {
  docker compose --env-file "$LOCK" -f "$COMPOSE" -f "$OVERRIDE" "$@"
}

cleanup() {
  docker rm -f "$GITEA_RUNNER_SMOKE_CACHE_CONTAINER" >/dev/null 2>&1 || true
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT HUP INT TERM

if docker ps -a --filter \
  "label=com.docker.compose.project=$GITEA_RUNNER_SMOKE_PROJECT" \
  --format '{{.ID}}' | grep -q .; then
  printf 'refusing pre-existing smoke project: %s\n' \
    "$GITEA_RUNNER_SMOKE_PROJECT" >&2
  exit 1
fi
for container in "$GITEA_RUNNER_SMOKE_DOCKER_CONTAINER" \
  "$GITEA_RUNNER_SMOKE_RUNNER_CONTAINER" \
  "$GITEA_RUNNER_SMOKE_CACHE_CONTAINER"; do
  if docker container inspect "$container" >/dev/null 2>&1; then
    printf 'refusing pre-existing smoke container: %s\n' "$container" >&2
    exit 1
  fi
done
if docker network inspect "$GITEA_RUNNER_SMOKE_NETWORK" >/dev/null 2>&1; then
  printf 'refusing pre-existing smoke network: %s\n' \
    "$GITEA_RUNNER_SMOKE_NETWORK" >&2
  exit 1
fi
for volume in "$GITEA_RUNNER_SMOKE_DATA_VOLUME" \
  "$GITEA_RUNNER_SMOKE_DOCKER_DATA_VOLUME" \
  "$GITEA_RUNNER_SMOKE_RUNTIME_VOLUME"; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    printf 'refusing pre-existing smoke volume: %s\n' "$volume" >&2
    exit 1
  fi
done

docker run --rm --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true --entrypoint /bin/sh "$DIND_IMAGE" \
  -ec 'test "$(id -u):$(id -g)" = 1000:1000; command -v newuidmap >/dev/null; command -v rootlesskit >/dev/null'

compose up -d docker >/dev/null
container_id="$(compose ps -q docker)"
test -n "$container_id"
test "$(docker inspect -f '{{.Name}}' "$container_id")" = \
  "/$GITEA_RUNNER_SMOKE_DOCKER_CONTAINER"

ready=0
for _attempt in $(seq 1 120); do
  state="$(docker inspect -f '{{.State.Status}}' "$container_id")"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id")"
  if [[ "$state" == running && "$health" == healthy ]]; then
    ready=1
    break
  fi
  if [[ "$state" != running || "$health" == unhealthy ]]; then
    compose logs docker >&2
    printf 'rootless DinD stopped before becoming healthy\n' >&2
    exit 1
  fi
  sleep 1
done
[[ "$ready" == 1 ]] || {
  compose logs docker >&2
  printf 'rootless DinD health deadline exceeded\n' >&2
  exit 1
}

socket_metadata="$(docker run --rm --network none --read-only \
  --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$GITEA_RUNNER_SMOKE_RUNTIME_VOLUME,dst=/run/user/1000" \
  "$APP_ALPINE_IMAGE" sh -ec '
    test -S /run/user/1000/docker.sock
    owner=$(stat -c "%u:%g" /run/user/1000/docker.sock)
    mode=$(stat -c "%a" /run/user/1000/docker.sock)
    printf "%s %s\n" "$owner" "$mode"
  ')"
socket_owner=${socket_metadata%% *}
socket_mode=${socket_metadata#* }
if [[ "$socket_owner" != 1000:1000 ||
  ("$socket_mode" != 660 && "$socket_mode" != 1660) ]]; then
  printf 'unsafe rootless socket ownership/mode: %s\n' "$socket_metadata" >&2
  exit 1
fi

dind_cli() {
  docker run --rm --network none --read-only --user 1000:1000 \
    --cap-drop ALL --security-opt no-new-privileges:true \
    --mount "type=volume,src=$GITEA_RUNNER_SMOKE_RUNTIME_VOLUME,dst=/run/user/1000" \
    -e DOCKER_HOST=unix:///run/user/1000/docker.sock \
    "$DOCKER_CLI_IMAGE" "$@"
}

security_options="$(dind_cli info --format '{{json .SecurityOptions}}')"
grep -F 'name=rootless' <<<"$security_options" >/dev/null

compose exec -T docker sh -ec '
  if ss -lnt | grep -E "[:.]237(5|6)[[:space:]]" >/dev/null; then
    echo "DinD exposed a TCP Docker listener" >&2
    exit 1
  fi
'
[[ -z "$(docker port "$container_id")" ]]

jq -e '
  .[0].Config.Cmd == [
    "dockerd",
    "--host=unix:///run/user/1000/docker.sock",
    "--group=root"
  ]
  and .[0].Config.User == "1000:1000"
  and .[0].HostConfig.Privileged == true
' < <(docker inspect "$container_id") >/dev/null

dind_cli run --rm --user 65534:65534 --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true "$APP_ALPINE_IMAGE" sh -ec '
    test "$(id -u):$(id -g)" = 65534:65534
    test ! -w /
    printf "unprivileged inner container passed\n"
  '

docker run -d --name "$GITEA_RUNNER_SMOKE_CACHE_CONTAINER" \
  --network "$GITEA_RUNNER_SMOKE_NETWORK" \
  --network-alias gitea-runner-cache --read-only --user 65534:65534 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  "$APP_ALPINE_IMAGE" sh -ec '
    while true; do
      printf "HTTP/1.1 200 OK\\r\\nContent-Length: 2\\r\\n\\r\\nok" | nc -l -p 8088
    done
  ' \
  >/dev/null
[[ -z "$(docker port "$GITEA_RUNNER_SMOKE_CACHE_CONTAINER")" ]]
dind_cli run --rm --user 65534:65534 --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true "$APP_ALPINE_IMAGE" sh -ec '
    wget -qO /dev/null http://gitea-runner-cache:8088/sh
  '
docker rm -f "$GITEA_RUNNER_SMOKE_CACHE_CONTAINER" >/dev/null

# Create the Runner to inspect the effective Docker model, then start only its
# fail-closed preflight branches (never registration or the daemon).
# This also proves Compose reduces each escaped `$$` to one shell `$`.
compose create runner >/dev/null
runner_id="$(compose ps -aq runner)"
test -n "$runner_id"
test "$(docker inspect -f '{{.Name}}' "$runner_id")" = \
  "/$GITEA_RUNNER_SMOKE_RUNNER_CONTAINER"
jq -e --arg config "$ROOT/deploy/gitea/runner/config.yaml" '
  .[0].Config.User == "1000:1000"
  and .[0].HostConfig.Privileged == false
  and .[0].Config.Entrypoint == ["/bin/sh", "-ec"]
  and (.[0].Config.Cmd[0] | contains("$state"))
  and (.[0].Config.Cmd[0] | contains("$$state") | not)
  and ([.[0].Mounts[] | .Destination] | sort) == [
    "/data",
    "/etc/gitea-runner/config.yaml",
    "/run/user/1000",
    "/usr/local/bin/gitea-runner-cache-maintenance"
  ]
  and (([.[0].Mounts[] | select(.Type == "bind") | .Source] | sort) == [
    ($config | sub("config\\.yaml$"; "cache-maintenance.sh")),
    $config
  ])
  and ([.[0].Mounts[] | select(.Type == "bind") | .RW] == [false, false])
  and ([.[0].Mounts[] | .Source | select(contains("/var/run/docker.sock"))] |
    length) == 0
' < <(docker inspect "$runner_id") >/dev/null

docker update --restart=no "$runner_id" >/dev/null
docker run --rm --network none --read-only --cap-drop ALL --cap-add CHOWN \
  --security-opt no-new-privileges:true \
  --mount "type=volume,src=$GITEA_RUNNER_SMOKE_DATA_VOLUME,dst=/data" \
  "$APP_ALPINE_IMAGE" sh -ec '
    chmod 0700 /data
    chown 1000:1000 /data
  '
if docker start -a "$runner_id" >"$runner_start_log" 2>&1; then
  printf 'Runner started without registration state or staged token\n' >&2
  exit 1
fi
grep -F 'registration state is absent and staged token is missing or unsafe' \
  "$runner_start_log" >/dev/null

docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$GITEA_RUNNER_SMOKE_DATA_VOLUME,dst=/data" \
  "$APP_ALPINE_IMAGE" ln -s /etc/passwd /data/.runner
if docker start -a "$runner_id" >"$runner_start_log" 2>&1; then
  printf 'Runner accepted an unsafe registration-state symlink\n' >&2
  exit 1
fi
grep -F 'registration state exists but is unsafe' "$runner_start_log" >/dev/null
docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$GITEA_RUNNER_SMOKE_DATA_VOLUME,dst=/data" \
  "$APP_ALPINE_IMAGE" rm -f /data/.runner

docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$GITEA_RUNNER_SMOKE_RUNTIME_VOLUME,dst=/runtime" \
  "$APP_ALPINE_IMAGE" sh -ec '
    umask 022
    printf "synthetic-unsafe-token\n" > /runtime/runner-registration-token
    chmod 0644 /runtime/runner-registration-token
  '
if docker start -a "$runner_id" >"$runner_start_log" 2>&1; then
  printf 'Runner accepted an unsafe staged token\n' >&2
  exit 1
fi
grep -F 'staged token is missing or unsafe' \
  "$runner_start_log" >/dev/null
docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=volume,src=$GITEA_RUNNER_SMOKE_RUNTIME_VOLUME,dst=/runtime" \
  "$APP_ALPINE_IMAGE" rm -f /runtime/runner-registration-token

printf 'rootless DinD socket=%s; security=%s\n' \
  "$socket_metadata" "$security_options"

compose down --volumes --remove-orphans >/dev/null
for volume in "$GITEA_RUNNER_SMOKE_DATA_VOLUME" \
  "$GITEA_RUNNER_SMOKE_DOCKER_DATA_VOLUME" \
  "$GITEA_RUNNER_SMOKE_RUNTIME_VOLUME"; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    printf 'smoke cleanup left volume behind: %s\n' "$volume" >&2
    exit 1
  fi
done
if docker network inspect "$GITEA_RUNNER_SMOKE_NETWORK" >/dev/null 2>&1; then
  printf 'smoke cleanup left network behind: %s\n' \
    "$GITEA_RUNNER_SMOKE_NETWORK" >&2
  exit 1
fi
rm -rf -- "$tmp"
trap - EXIT HUP INT TERM

printf 'disposable rootless DinD smoke passed\n'
