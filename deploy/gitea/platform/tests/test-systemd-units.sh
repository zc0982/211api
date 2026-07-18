#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
UNIT_DIR="$ROOT/deploy/gitea/platform/systemd"

systemd-analyze calendar '*-*-* 18:30:00 UTC' >/dev/null
grep -Fx 'OnFailure=gitea-backup-notify@%N.service' \
  "$UNIT_DIR/gitea-backup.service" >/dev/null
grep -Fx 'ExecStart=/opt/gitea/platform/gitea-backup-notify --unit %i.service' \
  "$UNIT_DIR/gitea-backup-notify@.service" >/dev/null
grep -Fx 'Persistent=true' "$UNIT_DIR/gitea-backup.timer" >/dev/null
grep -Fx 'RandomizedDelaySec=0' "$UNIT_DIR/gitea-backup.timer" >/dev/null

set +e
verify_output="$(systemd-analyze verify "$UNIT_DIR"/*.service "$UNIT_DIR"/*.timer 2>&1)"
verify_status=$?
set -e
if [[ "$verify_status" -ne 0 ]]; then
  while IFS= read -r line; do
    case "$line" in
      netplan-ovs-cleanup.service:*Permission\ denied) ;;
      gitea-backup.service:*'/opt/gitea/platform/gitea-backup'*No\ such\ file\ or\ directory) ;;
      gitea-backup-notify@i.service:*'/opt/gitea/platform/gitea-backup-notify'*No\ such\ file\ or\ directory) ;;
      "") ;;
      *)
        printf 'unexpected systemd verification error: %s\n' "$line" >&2
        exit 1
        ;;
    esac
  done <<<"$verify_output"
fi

printf 'systemd unit syntax and failure-handler contract passed\n'
