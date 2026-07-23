#!/usr/bin/env bash

set -euo pipefail

readonly REPO_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly TYPE="${1:-}"

usage() {
  printf 'Usage: %s {go|pnpm}\n' "${0##*/}" >&2
}

if (($# != 1)); then
  usage
  exit 64
fi

case "$TYPE" in
  go)
    readonly INPUTS=(
      tools/gitea-cache-key.sh
      tools/gitea-ci.sh
      deploy/gitea/images.lock.env
      backend/go.mod
      backend/go.sum
      backend/.golangci.yml
    )
    ;;
  pnpm)
    readonly INPUTS=(
      tools/gitea-cache-key.sh
      tools/gitea-ci.sh
      deploy/gitea/images.lock.env
      frontend/package.json
      frontend/pnpm-lock.yaml
    )
    ;;
  *)
    usage
    exit 64
    ;;
esac

cd "$REPO_ROOT"
for input in "${INPUTS[@]}"; do
  [[ -f "$input" && ! -L "$input" ]] || {
    printf 'Cache key input is missing or unsafe: %s\n' "$input" >&2
    exit 1
  }
done

digest="$({
  for input in "${INPUTS[@]}"; do
    sha256sum "$input"
  done
} | sha256sum | awk '{print $1}')"
[[ "$digest" =~ ^[0-9a-f]{64}$ ]] || exit 1
printf 'gitea-%s-linux-amd64-v1-%s\n' "$TYPE" "$digest"
