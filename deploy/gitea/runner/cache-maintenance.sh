#!/bin/sh

set -eu

readonly TARGET=/data/cache/actions
readonly DEFAULT_MAX_KIB=20971520
readonly DEFAULT_MAX_PERCENT=80

max_kib=$DEFAULT_MAX_KIB
max_percent=$DEFAULT_MAX_PERCENT
if [ "${GITEA_CACHE_MAINTENANCE_TEST:-}" = true ]; then
  [ -z "${GITEA_CACHE_MAINTENANCE_MAX_KIB:-}" ] ||
    max_kib=$GITEA_CACHE_MAINTENANCE_MAX_KIB
  [ -z "${GITEA_CACHE_MAINTENANCE_MAX_PERCENT:-}" ] ||
    max_percent=$GITEA_CACHE_MAINTENANCE_MAX_PERCENT
fi

case "$max_kib:$max_percent" in
  *[!0-9:]* | :* | *:) exit 1 ;;
esac

[ ! -L "$TARGET" ] && [ -d "$TARGET" ] || exit 1
[ "$(stat -c '%u:%g' "$TARGET")" = 1000:1000 ] || exit 1

size_kib=$(du -sk "$TARGET" | awk 'NR == 1 { print $1 }')
used_percent=$(df -P "$TARGET" | awk 'NR == 2 { sub(/%$/, "", $5); print $5 }')
case "$size_kib:$used_percent" in
  *[!0-9:]* | :* | *:) exit 1 ;;
esac

if [ "$size_kib" -le "$max_kib" ] && [ "$used_percent" -lt "$max_percent" ]; then
  printf 'action cache retained: size_kib=%s filesystem_used_percent=%s\n' \
    "$size_kib" "$used_percent"
  exit 0
fi

find "$TARGET" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
printf 'action cache cleared: size_kib=%s filesystem_used_percent=%s\n' \
  "$size_kib" "$used_percent"
