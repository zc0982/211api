#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
PROGRAM="$ROOT/deploy/gitea/platform/gitea_backup_retention.py"
tmp="$(mktemp -d)"
backup_root="$tmp/backups"

cleanup() {
  rm -rf -- "$tmp"
}
trap cleanup EXIT HUP INT TERM
mkdir -m 0700 "$backup_root"

add_set() {
  local stamp=$1 date=$2 role=${3:-daily} lease=${4:-null} references=${5:-'[]'}
  local id="gitea-${stamp}-deadbeef" dir="$backup_root/gitea-${stamp}-deadbeef.validated"
  local component=sample.age checksum listing size
  mkdir -m 0700 "$dir"
  printf 'ciphertext-%s\n' "$stamp" >"$dir/$component"
  checksum="$(sha256sum "$dir/$component" | awk '{print $1}')"
  listing="$(printf 'listing-%s' "$stamp" | sha256sum | awk '{print $1}')"
  size="$(stat -c '%s' "$dir/$component")"
  jq -n \
    --arg id "$id" --arg date "$date" --arg role "$role" \
    --arg checksum "$checksum" --arg listing "$listing" --arg component "$component" \
    --argjson size "$size" --argjson lease "$lease" --argjson references "$references" '
      {
        schema:"gitea-platform-backup.v1", backup_id:$id, role:$role,
        validated_at:$date, lease_until:$lease, referenced_by:$references,
        components:[{name:$component,sha256:$checksum,listing_sha256:$listing,size:$size}]
      }
    ' >"$dir/manifest.json"
  chmod 0600 "$dir/manifest.json" "$dir/$component"
}

add_set 20260718T000000Z 2026-07-18T00:00:00Z
add_set 20260717T000000Z 2026-07-17T00:00:00Z
add_set 20260716T000000Z 2026-07-16T00:00:00Z
add_set 20260715T000000Z 2026-07-15T00:00:00Z
add_set 20260714T000000Z 2026-07-14T00:00:00Z
add_set 20260713T000000Z 2026-07-13T00:00:00Z
add_set 20260712T000000Z 2026-07-12T00:00:00Z
add_set 20260711T000000Z 2026-07-11T00:00:00Z
add_set 20260705T000000Z 2026-07-05T00:00:00Z
add_set 20260628T000000Z 2026-06-28T00:00:00Z
add_set 20260621T000000Z 2026-06-21T00:00:00Z
add_set 20260620T000000Z 2026-06-20T00:00:00Z
add_set 20260601T000000Z 2026-06-01T00:00:00Z upgrade-predecessor
add_set 20260501T000000Z 2026-05-01T00:00:00Z daily '"2026-07-19T00:00:00Z"'
add_set 20260401T000000Z 2026-04-01T00:00:00Z daily null '["quarterly-drill"]'
add_set 20260201T000000Z 2026-02-01T00:00:00Z daily '"2026-02-02T00:00:00Z"'
add_set 20260101T000000Z 2026-01-01T00:00:00Z
printf 'corrupted-ciphertext\n' >"$backup_root/gitea-20260101T000000Z-deadbeef.validated/sample.age"

invalid="$backup_root/gitea-20260301T000000Z-deadbeef.validated"
mkdir -m 0700 "$invalid"
printf '{}\n' >"$invalid/manifest.json"
chmod 0600 "$invalid/manifest.json"

python3 "$PROGRAM" --root "$backup_root" --dry-run \
  --now 2026-07-18T12:00:00Z >"$tmp/selection.jsonl"

jq -se '
  def item($id): map(select(.backup_id == $id))[0];
  (item("gitea-20260711T000000Z-deadbeef").action == "delete")
  and (item("gitea-20260621T000000Z-deadbeef").action == "delete")
  and ([.[] | select(.reasons | index("daily-7") != null)] | length == 7)
  and ([.[] | select(.reasons | index("weekly-4") != null)] | length == 4)
  and (item("gitea-20260601T000000Z-deadbeef").reasons | index("upgrade-predecessor") != null)
  and (item("gitea-20260501T000000Z-deadbeef").reasons | index("active-lease") != null)
  and (item("gitea-20260401T000000Z-deadbeef").reasons | index("referenced") != null)
  and (item("gitea-20260201T000000Z-deadbeef").action == "delete")
  and (item("gitea-20260101T000000Z-deadbeef").reasons | index("invalid-or-incomplete-manifest") != null)
  and (item("gitea-20260301T000000Z-deadbeef").reasons | index("invalid-or-incomplete-manifest") != null)
' "$tmp/selection.jsonl" >/dev/null

python3 "$PROGRAM" --root "$backup_root" --apply \
  --now 2026-07-18T12:00:00Z >/dev/null
[[ ! -e "$backup_root/gitea-20260711T000000Z-deadbeef.validated" ]]
[[ ! -e "$backup_root/gitea-20260621T000000Z-deadbeef.validated" ]]
[[ ! -e "$backup_root/gitea-20260201T000000Z-deadbeef.validated" ]]
[[ -d "$backup_root/gitea-20260301T000000Z-deadbeef.validated" ]]
[[ -d "$backup_root/gitea-20260101T000000Z-deadbeef.validated" ]]
[[ -d "$backup_root/gitea-20260601T000000Z-deadbeef.validated" ]]
if find "$backup_root" -mindepth 1 -maxdepth 1 -name '.deleting-*' | grep -q .; then
  printf 'retention left a deletion quarantine after success\n' >&2
  exit 1
fi

ln -s "$backup_root" "$tmp/root-link"
if python3 "$PROGRAM" --root "$tmp/root-link" --dry-run \
  --now 2026-07-18T12:00:00Z >/dev/null 2>&1; then
  printf 'symlink backup root was accepted\n' >&2
  exit 1
fi

python3 - "$PROGRAM" "$tmp/race" <<'PY'
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

program = Path(sys.argv[1])
root = Path(sys.argv[2])
root.mkdir(mode=0o700)
backup_id = "gitea-20250101T000000Z-deadbeef"
candidate = root / f"{backup_id}.validated"
candidate.mkdir(mode=0o700)
component = candidate / "sample.age"
component.write_bytes(b"ciphertext\n")
component.chmod(0o600)
checksum = hashlib.sha256(component.read_bytes()).hexdigest()
manifest = {
    "schema": "gitea-platform-backup.v1",
    "backup_id": backup_id,
    "role": "daily",
    "validated_at": "2025-01-01T00:00:00Z",
    "lease_until": None,
    "referenced_by": [],
    "components": [{
        "name": "sample.age",
        "sha256": checksum,
        "listing_sha256": "0" * 64,
        "size": component.stat().st_size,
    }],
}
(candidate / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
(candidate / "manifest.json").chmod(0o600)

spec = importlib.util.spec_from_file_location("retention", program)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
entry = module.load_backup(candidate)
assert entry.valid and not entry.reasons

original = root / "original.validated"
candidate.rename(original)
candidate.mkdir(mode=0o700)
try:
    module.apply_deletions(root.resolve(), [entry])
except RuntimeError as exc:
    assert "identity changed" in str(exc)
else:
    raise AssertionError("candidate replacement race was accepted")
assert candidate.is_dir() and original.is_dir()
PY

printf 'retention selection and safe deletion passed\n'
