#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
# shellcheck source=../../images.lock.env
source "$ROOT/deploy/gitea/images.lock.env"
tmp="$(mktemp -d)"
run_id="$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
network="gitea-caddy-test-$run_id"
backend="gitea-caddy-backend-$run_id"
proxy="gitea-caddy-proxy-$run_id"
port="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"

cleanup() {
  docker rm -f "$proxy" "$backend" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -rf -- "$tmp"
}
trap cleanup EXIT HUP INT TERM

cat >"$tmp/Caddyfile" <<'EOF'
{
	admin off
	auto_https off
}

:8080 {
	log {
		output stdout
		format filter {
			wrap json
			fields {
				request>uri delete
			}
		}
	}
	reverse_proxy backend:8081
}
EOF

docker network create "$network" >/dev/null
docker run -d --name "$backend" --network "$network" --network-alias backend \
  "$CADDY_IMAGE" caddy respond --listen :8081 --body ok >/dev/null
docker run -d --name "$proxy" --network "$network" \
  -p "127.0.0.1:$port:8080" \
  -v "$tmp/Caddyfile:/etc/caddy/Caddyfile:ro" \
  "$CADDY_IMAGE" caddy run --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null

ready=0
for _ in $(seq 1 30); do
  if curl --silent --show-error --fail --connect-timeout 1 --max-time 2 \
    --header 'Authorization: Bearer authorization-sentinel' \
    --header 'Cookie: session=cookie-sentinel' \
    "http://127.0.0.1:$port/check?token=query-sentinel" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" -eq 1 ]]

logs="$(docker logs "$proxy" 2>&1)"
for sentinel in authorization-sentinel cookie-sentinel query-sentinel; do
  if grep -F "$sentinel" <<<"$logs" >/dev/null; then
    printf 'Caddy log leaked %s\n' "$sentinel" >&2
    exit 1
  fi
done

access_line="$(grep '"request"' <<<"$logs" | tail -n 1)"
[[ -n "$access_line" ]]
jq -e '.request.headers.Authorization == ["REDACTED"] and .request.headers.Cookie == ["REDACTED"]' \
  <<<"$access_line" >/dev/null

printf 'Caddy access-log credential and query redaction passed\n'
