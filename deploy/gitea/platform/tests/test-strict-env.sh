#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../strict-env.sh
source "$ROOT/deploy/gitea/platform/strict-env.sh"

tmp="$(mktemp -d)"
cleanup() {
  rm -rf -- "$tmp"
}
trap cleanup EXIT HUP INT TERM

gitea_load_image_lock "$ROOT/deploy/gitea/images.lock.env"
[[ "$GITEA_IMAGE" == *@sha256:* && "$APP_ALPINE_IMAGE" == *@sha256:* ]]

cp "$ROOT/deploy/gitea/images.lock.env" "$tmp/malicious.lock"
image_sentinel="$tmp/image-lock-executed"
sed -i "s|^GITEA_IMAGE=.*|GITEA_IMAGE=\$(touch $image_sentinel)|" \
  "$tmp/malicious.lock"
if gitea_load_image_lock "$tmp/malicious.lock" 2>/dev/null; then
  printf 'executable image-lock input was accepted\n' >&2
  exit 1
fi
[[ ! -e "$image_sentinel" ]]

key_sentinel="$tmp/key-executed"
printf '%s\n' "\$(touch $key_sentinel)=forbidden" >"$tmp/malicious-key.lock"
if gitea_load_image_lock "$tmp/malicious-key.lock" 2>/dev/null; then
  printf 'executable image-lock key was accepted\n' >&2
  exit 1
fi
[[ ! -e "$key_sentinel" ]]

cat >"$tmp/platform.env" <<'EOF'
GITEA_DB_PASSWORD_FILE=/etc/gitea/db-password
GITEA_SECRET_KEY_FILE=/etc/gitea/secret-key
GITEA_INTERNAL_TOKEN_FILE=/etc/gitea/internal-token
GITEA_BACKUP_API_CONFIG=/etc/gitea/backup-api.curl
BACKUP_AGE_RECIPIENT=age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq
EOF
gitea_load_platform_env "$tmp/platform.env"
[[ "$GITEA_DB_PASSWORD_FILE" == /etc/gitea/db-password ]]

platform_sentinel="$tmp/platform-env-executed"
printf 'GITEA_DB_PASSWORD_FILE=$(touch %s)\n' "$platform_sentinel" >"$tmp/malicious.env"
cat >>"$tmp/malicious.env" <<'EOF'
GITEA_SECRET_KEY_FILE=/etc/gitea/secret-key
GITEA_INTERNAL_TOKEN_FILE=/etc/gitea/internal-token
BACKUP_AGE_RECIPIENT=age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq
EOF
if gitea_load_platform_env "$tmp/malicious.env" 2>/dev/null; then
  printf 'executable platform-env input was accepted\n' >&2
  exit 1
fi
[[ ! -e "$platform_sentinel" ]]

printf 'strict environment loaders passed\n'
