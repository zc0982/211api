#!/usr/bin/env python3

"""Validate streamed platform tar members without writing plaintext to disk."""

from __future__ import annotations

import argparse
import json
import posixpath
import sys
import tarfile


def safe_text(value: str) -> bool:
    return bool(value) and all(ord(character) >= 32 and ord(character) != 127 for character in value)


def normalized_path(value: str) -> str:
    if not safe_text(value) or value.startswith("/"):
        raise ValueError("archive path is absolute, empty, or contains control characters")
    normalized = posixpath.normpath(value)
    if normalized == ".." or normalized.startswith("../"):
        raise ValueError("archive path escapes its root")
    return normalized


def normalized_link_target(member: tarfile.TarInfo, member_name: str) -> str:
    target = member.linkname
    if not safe_text(target) or target.startswith("/"):
        raise ValueError("archive link target is absolute, empty, or contains control characters")
    if member.issym():
        target = posixpath.join(posixpath.dirname(member_name), target)
    normalized = posixpath.normpath(target)
    if normalized == ".." or normalized.startswith("../"):
        raise ValueError("archive link target escapes its root")
    return normalized


def validate(profile: str) -> None:
    seen: set[str] = set()
    member_count = 0
    with tarfile.open(fileobj=sys.stdin.buffer, mode="r|*") as archive:
        for member in archive:
            member_count += 1
            name = normalized_path(member.name)
            if name in seen:
                raise ValueError("archive contains a duplicate normalized path")
            seen.add(name)
            if member.mode & 0o6000:
                raise ValueError("archive contains setuid or setgid mode bits")

            link_target = None
            if member.isfile():
                kind = "file"
            elif member.isdir():
                kind = "directory"
            elif profile == "volume" and (member.issym() or member.islnk()):
                kind = "symlink" if member.issym() else "hardlink"
                link_target = normalized_link_target(member, name)
            else:
                raise ValueError("archive contains a forbidden entry type")

            print(
                json.dumps(
                    {
                        "link_target": link_target,
                        "name": name,
                        "size": member.size,
                        "type": kind,
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                )
            )
    if member_count == 0:
        raise ValueError("archive is empty")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=("host", "volume"), required=True)
    args = parser.parse_args()
    validate(args.profile)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, tarfile.TarError) as exc:
        sys.stderr.write(f"tar validation failed: {exc}\n")
        raise SystemExit(1)
