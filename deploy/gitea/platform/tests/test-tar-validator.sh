#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
VALIDATOR="$ROOT/deploy/gitea/platform/gitea_validate_tar.py"
tmp="$(mktemp -d)"

cleanup() {
  rm -rf -- "$tmp"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$tmp/safe/dir"
printf 'safe\n' >"$tmp/safe/dir/file"
printf 'unicode-safe\n' >"$tmp/safe/dir/证据"
tar -C "$tmp/safe" -cf "$tmp/safe-host.tar" .
python3 "$VALIDATOR" --profile host <"$tmp/safe-host.tar" >/dev/null

ln -s dir/file "$tmp/safe/link"
tar -C "$tmp/safe" -cf "$tmp/safe-volume.tar" .
python3 "$VALIDATOR" --profile volume <"$tmp/safe-volume.tar" >/dev/null
if python3 "$VALIDATOR" --profile host <"$tmp/safe-volume.tar" >/dev/null 2>&1; then
  printf 'host profile accepted a symbolic link\n' >&2
  exit 1
fi

rm -f "$tmp/safe/link"
ln -s ../../outside "$tmp/safe/escape"
tar -C "$tmp/safe" -cf "$tmp/escape-link.tar" .
if python3 "$VALIDATOR" --profile volume <"$tmp/escape-link.tar" >/dev/null 2>&1; then
  printf 'volume profile accepted an escaping symbolic link\n' >&2
  exit 1
fi

tar -C "$tmp/safe" --transform='s|^\./|../|' -cf "$tmp/traversal.tar" .
if python3 "$VALIDATOR" --profile volume <"$tmp/traversal.tar" >/dev/null 2>&1; then
  printf 'volume profile accepted a parent-traversal path\n' >&2
  exit 1
fi

printf 'streamed tar safety profiles passed\n'
