#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LOCK="$ROOT/deploy/gitea/images.lock.env"
COMPOSE="$ROOT/deploy/gitea/runner/compose.yaml"
CONFIG="$ROOT/deploy/gitea/runner/config.yaml"
tmp="$(mktemp -d)"

cleanup() {
  rm -rf -- "$tmp"
}
trap cleanup EXIT HUP INT TERM

docker compose --env-file "$LOCK" -f "$COMPOSE" \
  config --format json >"$tmp/rendered.json"

# The rendered model, not source indentation, is the deployable contract.
jq -e '
  .name == "gitea-runner"
  and (.services | keys | sort) == ["docker", "runner"]
  and .services.docker.user == "1000:1000"
  and .services.runner.user == "1000:1000"
  and .services.docker.privileged == true
  and (.services.runner.privileged // false) == false
  and .services.docker.command == [
    "dockerd",
    "--host=unix:///run/user/1000/docker.sock",
    "--group=root"
  ]
  and .services.runner.environment.DOCKER_HOST ==
    "unix:///run/user/1000/docker.sock"
  and .services.runner.environment.GITEA_RUNNER_REGISTRATION_TOKEN_FILE ==
    "/run/user/1000/runner-registration-token"
  and .services.runner.read_only == true
  and .services.runner.mem_limit == "536870912"
  and .services.runner.cpus == 0.5
  and .services.docker.mem_limit == "3221225472"
  and .services.docker.cpus == 3
  and ([.services[] | .ports[]?] | length) == 0
  and ([.services | to_entries[] | select(.value.privileged == true) | .key] ==
    ["docker"])
  and ([.services[] | .volumes[]? | select(.type == "bind")] | length) == 0
  and .volumes.runner_data.name == "gitea-runner-data"
  and .volumes.docker_data.name == "gitea-runner-docker-data"
  and .volumes.runner_runtime.name == "gitea-runner-runtime"
  and .volumes.runner_runtime.driver == "local"
  and .volumes.runner_runtime.driver_opts.type == "tmpfs"
  and .volumes.runner_runtime.driver_opts.device == "tmpfs"
  and .networks.runner.enable_ipv6 == false
' "$tmp/rendered.json" >/dev/null

# Resolve the locked labels and require the exact four execution contexts.
set -a
# shellcheck source=/dev/null
source "$LOCK"
set +a
expected_labels="linux-amd64:docker://${NODE_CI_IMAGE},go-1.26.5:docker://${GO_CI_IMAGE},node-20.20.2:docker://${NODE_CI_IMAGE},docker-29.6.1:docker://${DOCKER_CLI_IMAGE}"
jq -e --arg labels "$expected_labels" \
  '.services.runner.environment.GITEA_RUNNER_LABELS == $labels' \
  "$tmp/rendered.json" >/dev/null

section() {
  local header=$1
  awk -v header="$header:" '
    $0 == header { inside = 1; next }
    inside && /^[^[:space:]]/ { exit }
    inside { print }
  ' "$CONFIG"
}
section log >"$tmp/log.section"
section runner >"$tmp/runner.section"
section cache >"$tmp/cache.section"
section container >"$tmp/container.section"
section metrics >"$tmp/metrics.section"

grep -Fx '  level: info' "$tmp/log.section" >/dev/null
for expected in \
  '  capacity: 1' \
  '  timeout: 3h' \
  '  insecure: false' \
  '  labels: []'; do
  grep -Fx "$expected" "$tmp/runner.section" >/dev/null
done
grep -Fx '  enabled: false' "$tmp/cache.section" >/dev/null
for expected in \
  '  privileged: false' \
  '  valid_volumes: []' \
  '  docker_host: unix:///run/user/1000/docker.sock' \
  '  force_pull: false' \
  '  bind_workdir: false' \
  '    enable_ipv6: false'; do
  grep -Fx "$expected" "$tmp/container.section" >/dev/null
done
grep -Fx '  enabled: false' "$tmp/metrics.section" >/dev/null

# Runner 2.1.0 must parse this exact schema. A missing registration file is the
# expected next failure; a config/schema failure is not.
if docker run --rm --network none --read-only --user 1000:1000 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --mount "type=bind,src=$CONFIG,dst=/config.yaml,readonly" \
  --entrypoint /bin/sh "$RUNNER_IMAGE" -ec '
    test "$(id -u):$(id -g)" = 1000:1000
    exec gitea-runner daemon --config /config.yaml
  ' >"$tmp/schema.log" 2>&1; then
  printf 'unregistered Runner unexpectedly started\n' >&2
  exit 1
fi
grep -F 'registration file not found' "$tmp/schema.log" >/dev/null
if rg -i 'config.*(invalid|unknown|unmarshal|parse)|yaml.*(invalid|unmarshal|parse)' \
  "$tmp/schema.log" >/dev/null; then
  printf 'Runner rejected config schema:\n' >&2
  cat "$tmp/schema.log" >&2
  exit 1
fi

if rg -n '/var/run/docker\.sock|tcp://|2375|2376|network_mode:[[:space:]]*host|pid:[[:space:]]*host' \
  "$COMPOSE" "$CONFIG" >"$tmp/prohibited"; then
  printf 'runner configuration contains a prohibited Docker endpoint or host namespace:\n' >&2
  cat "$tmp/prohibited" >&2
  exit 1
fi

printf 'runner Compose and config invariants passed\n'
