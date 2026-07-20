#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$REPO_ROOT/deploy/gitea/images.lock.env"
cd "$REPO_ROOT"

usage() {
  printf 'Usage: %s {backend-unit|backend-integration|frontend|lint|security-backend|security-frontend|shell-syntax}\n' "${0##*/}" >&2
}

assert_go_version() {
  local version
  version="$(go version)"
  if [[ ! "$version" =~ (^|[[:space:]])go1\.26\.5([[:space:]]|$) ]]; then
    printf 'Expected Go 1.26.5, got: %s\n' "$version" >&2
    return 1
  fi
}

assert_node_version() {
  local version
  version="$(node --version)"
  if [[ ! "$version" =~ ^v20(\.|$) ]]; then
    printf 'Expected Node.js major 20, got: %s\n' "$version" >&2
    return 1
  fi
}

activate_pnpm() {
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
}

run_backend_unit() {
  assert_go_version
  make -C backend test-unit
}

configure_testcontainers_for_gitea() {
  local -r testcontainers_host=docker
  local -r dind_socket=/run/user/1000/docker.sock

  [[ "${GITEA_CI:-}" == true ]] || return 0

  if [[ -n "${TESTCONTAINERS_HOST_OVERRIDE:-}" &&
    "$TESTCONTAINERS_HOST_OVERRIDE" != "$testcontainers_host" ]]; then
    printf 'Preconfigured Testcontainers host does not match the isolated DinD service\n' >&2
    return 1
  fi
  if [[ -n "${TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE:-}" &&
    "$TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE" != "$dind_socket" ]]; then
    printf 'Preconfigured Testcontainers socket does not match the isolated DinD socket\n' >&2
    return 1
  fi

  export TESTCONTAINERS_HOST_OVERRIDE="$testcontainers_host"
  export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE="$dind_socket"
}

run_backend_integration() (
  local docker_shim_dir
  assert_go_version
  configure_testcontainers_for_gitea
  if ! command -v docker >/dev/null 2>&1; then
    command -v curl >/dev/null 2>&1
    docker_shim_dir="$(mktemp -d)"
    trap 'rm -rf -- "$docker_shim_dir"' EXIT
    ln -s "$REPO_ROOT/tools/gitea-docker-probe.sh" "$docker_shim_dir/docker"
    export PATH="$docker_shim_dir:$PATH"
  fi
  make -C backend test-integration
)

run_frontend() {
  assert_node_version
  activate_pnpm
  (
    cd frontend
    pnpm install --frozen-lockfile
  )
  make test-frontend
}

run_lint() (
  local tool_dir
  assert_go_version
  tool_dir="$(mktemp -d)"
  trap 'rm -rf -- "$tool_dir"' EXIT
  GOMAXPROCS=1 GOBIN="$tool_dir" \
    go install "github.com/golangci/golangci-lint/v2/cmd/golangci-lint@${GOLANGCI_LINT_VERSION}"
  (
    cd backend
    GOMAXPROCS=1 "$tool_dir/golangci-lint" run --timeout=30m
  )
)

run_security_backend() (
  local tool_dir
  assert_go_version
  tool_dir="$(mktemp -d)"
  trap 'rm -rf -- "$tool_dir"' EXIT
  GOBIN="$tool_dir" go install "golang.org/x/vuln/cmd/govulncheck@${GOVULNCHECK_VERSION}"
  (
    cd backend
    "$tool_dir/govulncheck" ./...
  )
)

run_security_frontend() (
  local audit_file
  assert_node_version
  activate_pnpm
  (
    cd frontend
    pnpm install --frozen-lockfile
  )
  audit_file="$(mktemp)"
  trap 'rm -f -- "$audit_file"' EXIT
  if ! (
    cd frontend
    pnpm audit --prod --audit-level=high --json
  ) >"$audit_file"; then
    : # The exception checker owns the high/critical vulnerability gate.
  fi
  python3 tools/check_pnpm_audit_exceptions.py \
    --audit "$audit_file" \
    --exceptions .gitea/audit-exceptions.yml
)

run_shell_syntax() {
  local -a shell_files=()
  local path basename first_line

  while IFS= read -r -d '' path; do
    shell_files+=("$path")
  done < <(git ls-files -z -- '*.sh')

  while IFS= read -r -d '' path; do
    basename="${path##*/}"
    [[ "$basename" == *.* || ! -f "$path" ]] && continue
    IFS= read -r first_line <"$path" || true
    [[ "$first_line" == '#!'* ]] || continue
    shell_files+=("$path")
  done < <(git ls-files -z -- deploy/gitea)

  if ((${#shell_files[@]} > 0)); then
    # Syntax-check only. In particular, never execute the Apple container fixture.
    bash -n -- "${shell_files[@]}"
  fi
}

if (($# != 1)); then
  usage
  exit 64
fi

case "$1" in
  backend-unit) run_backend_unit ;;
  backend-integration) run_backend_integration ;;
  frontend) run_frontend ;;
  lint) run_lint ;;
  security-backend) run_security_backend ;;
  security-frontend) run_security_frontend ;;
  shell-syntax) run_shell_syntax ;;
  *)
    usage
    exit 64
    ;;
esac
