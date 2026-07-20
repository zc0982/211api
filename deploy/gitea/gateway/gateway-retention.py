#!/usr/bin/env python3

"""Select and safely remove classified Gateway pre-deploy backup sets."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import stat
import sys
from dataclasses import dataclass
from pathlib import Path


SET_RE = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{40}$")
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")


class RetentionError(RuntimeError):
    pass


@dataclass(frozen=True)
class Backup:
    name: str
    path: Path
    validated_at: dt.datetime
    target_commit: str
    previous_commit: str | None
    lease_until: dt.datetime | None
    referenced_by: tuple[str, ...]


def parse_time(value: object, field: str) -> dt.datetime:
    if not isinstance(value, str):
        raise RetentionError(f"{field} is not a string")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RetentionError(f"invalid {field}") from exc
    if parsed.tzinfo is None:
        raise RetentionError(f"{field} has no timezone")
    return parsed.astimezone(dt.timezone.utc)


def require_regular(path: Path, mode: int, uid: int, gid: int) -> os.stat_result:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise RetentionError(f"not a regular file: {path}")
    if info.st_uid != uid or info.st_gid != gid or stat.S_IMODE(info.st_mode) != mode:
        raise RetentionError(f"unsafe ownership or mode: {path}")
    return info


def require_directory(path: Path, mode: int, uid: int, gid: int) -> os.stat_result:
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise RetentionError(f"not a directory: {path}")
    if info.st_uid != uid or info.st_gid != gid or stat.S_IMODE(info.st_mode) != mode:
        raise RetentionError(f"unsafe ownership or mode: {path}")
    return info


def load_backup(path: Path, uid: int, gid: int) -> Backup:
    require_directory(path, 0o700, uid, gid)
    if not SET_RE.fullmatch(path.name):
        raise RetentionError(f"unclassified backup directory: {path.name}")
    manifest_path = path / "manifest.json"
    require_regular(manifest_path, 0o600, uid, gid)
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RetentionError(f"invalid manifest: {path.name}") from exc

    if manifest.get("schema") != "211api-predeploy-backup.v1":
        raise RetentionError(f"invalid schema: {path.name}")
    if manifest.get("backup_id") != path.name:
        raise RetentionError(f"backup id mismatch: {path.name}")
    if manifest.get("role") != "pre-deploy":
        raise RetentionError(f"invalid role: {path.name}")
    target = manifest.get("target", {})
    if not isinstance(target, dict) or not COMMIT_RE.fullmatch(str(target.get("commit", ""))):
        raise RetentionError(f"invalid target commit: {path.name}")
    if not DIGEST_RE.fullmatch(str(target.get("digest", ""))):
        raise RetentionError(f"invalid target digest: {path.name}")
    previous = manifest.get("previous", {})
    if not isinstance(previous, dict):
        raise RetentionError(f"invalid previous state: {path.name}")
    previous_commit = previous.get("commit")
    if previous_commit is not None and not COMMIT_RE.fullmatch(str(previous_commit)):
        raise RetentionError(f"invalid previous commit: {path.name}")
    refs = manifest.get("referenced_by")
    if not isinstance(refs, list) or any(
        not isinstance(item, str) or not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", item)
        for item in refs
    ):
        raise RetentionError(f"invalid references: {path.name}")
    lease_raw = manifest.get("lease_until")
    lease = None if lease_raw is None else parse_time(lease_raw, "lease_until")

    components = manifest.get("components")
    if not isinstance(components, list) or not components:
        raise RetentionError(f"invalid components: {path.name}")
    expected_names: set[str] = set()
    for component in components:
        if not isinstance(component, dict):
            raise RetentionError(f"invalid component entry: {path.name}")
        name = component.get("name")
        checksum = component.get("sha256")
        size = component.get("size")
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9][a-z0-9.-]{0,63}", name):
            raise RetentionError(f"invalid component name: {path.name}")
        if name in expected_names or not SHA_RE.fullmatch(str(checksum)):
            raise RetentionError(f"invalid component metadata: {path.name}")
        if not isinstance(size, int) or size < 1:
            raise RetentionError(f"invalid component size: {path.name}")
        component_path = path / name
        info = require_regular(component_path, 0o600, uid, gid)
        if info.st_size != size:
            raise RetentionError(f"component size drift: {path.name}/{name}")
        digest = hashlib.sha256()
        with component_path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != checksum:
            raise RetentionError(f"component checksum drift: {path.name}/{name}")
        expected_names.add(name)

    allowed = expected_names | {"manifest.json"}
    actual = {entry.name for entry in path.iterdir()}
    if actual != allowed:
        raise RetentionError(f"unexpected backup entries: {path.name}")

    return Backup(
        name=path.name,
        path=path,
        validated_at=parse_time(manifest.get("validated_at"), "validated_at"),
        target_commit=str(target["commit"]),
        previous_commit=None if previous_commit is None else str(previous_commit),
        lease_until=lease,
        referenced_by=tuple(refs),
    )


def load_state(path: Path, uid: int, gid: int) -> dict[str, object]:
    require_regular(path, 0o600, uid, gid)
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RetentionError("invalid deployment state") from exc
    if state.get("schema") != "211api-deployment-state.v1":
        raise RetentionError("invalid deployment state schema")
    return state


def select(backups: list[Backup], state: dict[str, object], now: dt.datetime) -> list[Backup]:
    newest = sorted(backups, key=lambda item: (item.validated_at, item.name), reverse=True)
    keep = {item.name for item in newest[:3]}
    for key in ("backup_id", "predecessor_backup_id", "known_good_backup_id"):
        value = state.get(key)
        if isinstance(value, str):
            keep.add(value)
    current_commit = state.get("commit")
    predecessor_commit = state.get("previous_commit")
    for item in backups:
        if item.lease_until is not None and item.lease_until > now:
            keep.add(item.name)
        if item.target_commit in {current_commit, predecessor_commit}:
            keep.add(item.name)
        if item.previous_commit in {current_commit, predecessor_commit}:
            keep.add(item.name)
    return [item for item in newest if item.name not in keep]


def fsync_directory(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def remove_tree_fd(parent: Path, name: str, expected: os.stat_result) -> None:
    quarantine = f".retiring-{name}"
    parent_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        if (current.st_dev, current.st_ino) != (expected.st_dev, expected.st_ino):
            raise RetentionError(f"backup changed before deletion: {name}")
        try:
            os.stat(quarantine, dir_fd=parent_fd, follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise RetentionError(f"quarantine path already exists: {quarantine}")
        os.rename(name, quarantine, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
        os.fsync(parent_fd)
        root_fd = os.open(quarantine, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
        try:
            entries = os.listdir(root_fd)
            for entry in entries:
                info = os.stat(entry, dir_fd=root_fd, follow_symlinks=False)
                if not stat.S_ISREG(info.st_mode):
                    raise RetentionError(f"unsafe entry during deletion: {name}/{entry}")
                os.unlink(entry, dir_fd=root_fd)
            os.fsync(root_fd)
        finally:
            os.close(root_fd)
        os.rmdir(quarantine, dir_fd=parent_fd)
        os.fsync(parent_fd)
    finally:
        os.close(parent_fd)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--expected-plan-sha256")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    root = Path(args.root)
    state_path = Path(args.state)
    uid = os.geteuid()
    gid = os.getegid()
    root_info = require_directory(root, 0o700, uid, gid)
    state = load_state(state_path, uid, gid)
    backups: list[Backup] = []
    for entry in root.iterdir():
        info = entry.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise RetentionError(f"symlink in backup root: {entry.name}")
        if entry.name.endswith(".partial"):
            continue
        if not stat.S_ISDIR(info.st_mode):
            raise RetentionError(f"unclassified entry in backup root: {entry.name}")
        backups.append(load_backup(entry, uid, gid))

    now = dt.datetime.now(dt.timezone.utc)
    deletions = select(backups, state, now)
    plan = json.dumps({"delete": [item.name for item in deletions]}, separators=(",", ":"))
    print(plan)
    if not args.apply:
        return
    if not isinstance(args.expected_plan_sha256, str) or not SHA_RE.fullmatch(
        args.expected_plan_sha256
    ):
        raise RetentionError("apply requires an expected plan checksum")
    if hashlib.sha256(plan.encode("utf-8")).hexdigest() != args.expected_plan_sha256:
        raise RetentionError("retention plan changed after dry-run")

    if (root.lstat().st_dev, root.lstat().st_ino) != (root_info.st_dev, root_info.st_ino):
        raise RetentionError("backup root changed")
    for item in deletions:
        expected = item.path.lstat()
        remove_tree_fd(root, item.name, expected)
    fsync_directory(root)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RetentionError) as exc:
        print(f"gateway retention: {exc}", file=sys.stderr)
        raise SystemExit(1)
