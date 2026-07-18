#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LOCK="$ROOT/deploy/gitea/images.lock.env"
COMPOSE="$ROOT/deploy/gitea/platform/compose.yaml"
tmp="$(mktemp -d)"

cleanup() {
  rm -rf -- "$tmp"
}
trap cleanup EXIT HUP INT TERM

for name in db-password secret-key internal-token; do
  printf 'dummy-%s-sentinel\n' "$name" >"$tmp/$name"
  chmod 0600 "$tmp/$name"
done

cat >"$tmp/platform.env" <<EOF
GITEA_DB_PASSWORD_FILE=$tmp/db-password
GITEA_SECRET_KEY_FILE=$tmp/secret-key
GITEA_INTERNAL_TOKEN_FILE=$tmp/internal-token
EOF
chmod 0600 "$tmp/platform.env"
unset GITEA_DB_PASSWORD_FILE GITEA_SECRET_KEY_FILE GITEA_INTERNAL_TOKEN_FILE

docker compose \
  --env-file "$LOCK" \
  --env-file "$tmp/platform.env" \
  -f "$COMPOSE" config --format json >"$tmp/rendered.json"

jq -e '
  (.services | keys | sort) == ["caddy","gitea","postgres","secret-init"]
  and (.services.postgres.ports // [] | length) == 0
  and (.services.gitea.ports | length) == 1
  and (.services.caddy.ports | length) == 2
  and (.services."secret-init".network_mode == "none")
  and (.services."secret-init".read_only == true)
  and (.services.gitea.user == "1000:1000")
' "$tmp/rendered.json" >/dev/null

jq -r '
  .services | to_entries[] | .value.ports[]?
  | "\(.host_ip):\(.published):\(.target)/\(.protocol)"
' "$tmp/rendered.json" | sort >"$tmp/ports.actual"
cat >"$tmp/ports.expected" <<'EOF'
37.221.194.27:2222:2222/tcp
37.221.194.27:443:443/tcp
37.221.194.27:80:80/tcp
EOF
sort -o "$tmp/ports.expected" "$tmp/ports.expected"
cmp "$tmp/ports.expected" "$tmp/ports.actual"

if grep -F 'dummy-db-password-sentinel' "$tmp/rendered.json" >/dev/null ||
  grep -F 'dummy-secret-key-sentinel' "$tmp/rendered.json" >/dev/null ||
  grep -F 'dummy-internal-token-sentinel' "$tmp/rendered.json" >/dev/null; then
  printf 'rendered Compose leaked a secret file value\n' >&2
  exit 1
fi

jq -e \
  --arg db "$tmp/db-password" \
  --arg secret "$tmp/secret-key" \
  --arg token "$tmp/internal-token" '
    .secrets.gitea_db_password.file == $db
    and .secrets.gitea_secret_key.file == $secret
    and .secrets.gitea_internal_token.file == $token
  ' "$tmp/rendered.json" >/dev/null

for required in GITEA_DB_PASSWORD_FILE GITEA_SECRET_KEY_FILE GITEA_INTERNAL_TOKEN_FILE; do
  grep -v "^${required}=" "$tmp/platform.env" >"$tmp/missing.env"
  if docker compose \
    --env-file "$LOCK" \
    --env-file "$tmp/missing.env" \
    -f "$COMPOSE" config --quiet >/dev/null 2>&1; then
    printf 'Compose accepted missing required variable %s\n' "$required" >&2
    exit 1
  fi
done

printf 'platform Compose invariants passed\n'
