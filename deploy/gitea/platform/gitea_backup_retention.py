#!/usr/bin/env python3

"""Deterministic retention selector for validated Gitea backup sets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


BACKUP_ID = re.compile(r"^gitea-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
COMPONENT_NAME = re.compile(r"^[0-9A-Za-z][0-9A-Za-z._-]*\.age$")
BACKUP_ROLES = {"daily", "bootstrap", "upgrade-predecessor"}


def parse_timestamp(value: object) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError("timestamp must be an RFC3339 UTC string")
    parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    if parsed.tzinfo is None:
        raise ValueError("timestamp must include UTC")
    return parsed.astimezone(timezone.utc)


@dataclass
class BackupSet:
    path: Path
    backup_id: str
    valid: bool = False
    validated_at: datetime = field(default_factory=lambda: datetime.min.replace(tzinfo=timezone.utc))
    role: str = ""
    lease_until: datetime | None = None
    referenced_by: list[str] = field(default_factory=list)
    reasons: set[str] = field(default_factory=set)
    error: str = ""
    device: int = 0
    inode: int = 0


def load_backup(path: Path) -> BackupSet:
    backup_id = path.name.removesuffix(".validated")
    entry = BackupSet(path=path, backup_id=backup_id)
    try:
        if path.is_symlink() or not path.is_dir():
            raise ValueError("backup set is not a real directory")
        path_stat = path.stat(follow_symlinks=False)
        if (path_stat.st_mode & 0o777) != 0o700:
            raise ValueError("backup set mode is not 0700")
        entry.device = path_stat.st_dev
        entry.inode = path_stat.st_ino
        if not BACKUP_ID.fullmatch(backup_id):
            raise ValueError("backup directory name is not recognized")
        manifest_path = path / "manifest.json"
        if manifest_path.is_symlink() or not manifest_path.is_file():
            raise ValueError("manifest is missing or is a symlink")
        if (manifest_path.stat().st_mode & 0o777) != 0o600:
            raise ValueError("manifest mode is not 0600")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("schema") != "gitea-platform-backup.v1":
            raise ValueError("manifest schema is not recognized")
        if manifest.get("backup_id") != backup_id:
            raise ValueError("manifest backup_id does not match directory")
        entry.validated_at = parse_timestamp(manifest.get("validated_at"))
        role = manifest.get("role")
        if role not in BACKUP_ROLES:
            raise ValueError("manifest role is not recognized")
        entry.role = role
        lease_value = manifest.get("lease_until")
        if lease_value is not None:
            entry.lease_until = parse_timestamp(lease_value)
        references = manifest.get("referenced_by")
        if not isinstance(references, list) or any(not isinstance(item, str) or not item for item in references):
            raise ValueError("manifest referenced_by must be a string array")
        entry.referenced_by = references
        components = manifest.get("components")
        if not isinstance(components, list) or not components:
            raise ValueError("manifest components are missing")
        component_names: set[str] = set()
        for component in components:
            if not isinstance(component, dict):
                raise ValueError("manifest component is not an object")
            name = component.get("name")
            checksum = component.get("sha256")
            listing_checksum = component.get("listing_sha256")
            size = component.get("size")
            if not isinstance(name, str) or not COMPONENT_NAME.fullmatch(name):
                raise ValueError("manifest component name is unsafe")
            if name in component_names:
                raise ValueError("manifest component name is duplicated")
            if not isinstance(checksum, str) or not SHA256.fullmatch(checksum):
                raise ValueError("manifest component checksum is invalid")
            if not isinstance(listing_checksum, str) or not SHA256.fullmatch(listing_checksum):
                raise ValueError("manifest component listing checksum is invalid")
            if not isinstance(size, int) or isinstance(size, bool) or size <= 0:
                raise ValueError("manifest component size is invalid")
            component_path = path / name
            if component_path.is_symlink() or not component_path.is_file():
                raise ValueError(f"component is missing or unsafe: {name}")
            if (component_path.stat().st_mode & 0o777) != 0o600:
                raise ValueError(f"component mode is not 0600: {name}")
            if component_path.stat().st_size != size:
                raise ValueError(f"component size does not match: {name}")
            with component_path.open("rb") as component_file:
                actual_checksum = hashlib.file_digest(component_file, "sha256").hexdigest()
            if actual_checksum != checksum:
                raise ValueError(f"component checksum does not match: {name}")
            component_names.add(name)
        entry.valid = True
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        entry.error = str(exc)
        entry.reasons.add("invalid-or-incomplete-manifest")
    return entry


def select_retention(entries: list[BackupSet], now: datetime) -> None:
    valid = sorted(
        (entry for entry in entries if entry.valid),
        key=lambda item: (item.validated_at, item.backup_id),
        reverse=True,
    )
    if not valid:
        return

    valid[0].reasons.add("newest-known-good")
    daily = [entry for entry in valid if entry.role == "daily"]
    for entry in daily[:7]:
        entry.reasons.add("daily-7")

    weekly_keys: set[tuple[int, int]] = set()
    for entry in valid:
        iso = entry.validated_at.isocalendar()
        key = (iso.year, iso.week)
        if key in weekly_keys:
            continue
        if len(weekly_keys) >= 4:
            break
        weekly_keys.add(key)
        entry.reasons.add("weekly-4")

    for entry in valid:
        if entry.role == "upgrade-predecessor":
            entry.reasons.add("upgrade-predecessor")
        if entry.lease_until is not None and entry.lease_until > now:
            entry.reasons.add("active-lease")
        if entry.referenced_by:
            entry.reasons.add("referenced")


def emit(entries: list[BackupSet]) -> None:
    for entry in sorted(entries, key=lambda item: item.path.name):
        action = "keep" if entry.reasons else "delete"
        record = {
            "action": action,
            "backup_id": entry.backup_id,
            "reasons": sorted(entry.reasons),
        }
        if entry.error:
            record["error"] = entry.error
        print(json.dumps(record, sort_keys=True, separators=(",", ":")))


def apply_deletions(root: Path, entries: list[BackupSet]) -> None:
    if not shutil.rmtree.avoids_symlink_attacks:
        raise RuntimeError("platform lacks fd-based symlink-safe rmtree")
    root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for entry in entries:
            if entry.reasons:
                continue
            candidate_name = entry.path.name
            if not entry.valid:
                raise RuntimeError(f"refusing to delete invalid set: {candidate_name}")
            if entry.path.parent != root or not BACKUP_ID.fullmatch(entry.backup_id):
                raise RuntimeError(f"refusing unsafe candidate: {candidate_name}")
            current = os.stat(candidate_name, dir_fd=root_fd, follow_symlinks=False)
            if not stat.S_ISDIR(current.st_mode):
                raise RuntimeError(f"candidate is no longer a directory: {candidate_name}")
            if (current.st_dev, current.st_ino) != (entry.device, entry.inode):
                raise RuntimeError(f"candidate identity changed before deletion: {candidate_name}")

            quarantine_name = f".deleting-{entry.backup_id}-{os.getpid()}"
            try:
                os.stat(quarantine_name, dir_fd=root_fd, follow_symlinks=False)
            except FileNotFoundError:
                pass
            else:
                raise RuntimeError(f"quarantine path already exists: {quarantine_name}")
            os.rename(
                candidate_name,
                quarantine_name,
                src_dir_fd=root_fd,
                dst_dir_fd=root_fd,
            )
            os.fsync(root_fd)
            quarantined = os.stat(quarantine_name, dir_fd=root_fd, follow_symlinks=False)
            if not stat.S_ISDIR(quarantined.st_mode) or (
                quarantined.st_dev,
                quarantined.st_ino,
            ) != (entry.device, entry.inode):
                raise RuntimeError(
                    f"quarantined candidate identity mismatch: {quarantine_name}"
                )
            try:
                shutil.rmtree(quarantine_name, dir_fd=root_fd)
            except Exception as exc:
                os.fsync(root_fd)
                raise RuntimeError(
                    f"quarantined backup deletion failed: {quarantine_name}"
                ) from exc
            os.fsync(root_fd)
    finally:
        os.close(root_fd)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--now", help="RFC3339 UTC override for deterministic tests")
    args = parser.parse_args()

    requested_root = args.root
    if requested_root.is_symlink():
        raise RuntimeError("backup root must not be a symlink")
    root = requested_root.resolve(strict=True)
    if not root.is_dir():
        raise RuntimeError("backup root must be a real directory")
    now = parse_timestamp(args.now) if args.now else datetime.now(timezone.utc)
    entries = [load_backup(path) for path in root.glob("*.validated")]
    select_retention(entries, now)
    emit(entries)
    if args.apply:
        apply_deletions(root, entries)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # fail closed with one bounded diagnostic
        sys.stderr.write(f"retention failed: {exc}\n")
        raise SystemExit(1)
