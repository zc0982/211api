#!/usr/bin/env python3

"""Validate the encrypted deployment archive's plaintext stream.

The caller tees the tar stream here before encryption.  This validator never
extracts data and accepts exactly the two production control files.
"""

from __future__ import annotations

import json
import sys
import tarfile


EXPECTED = {"docker-compose.yml", ".env"}


def fail(message: str) -> None:
    raise SystemExit(f"gateway archive validator: {message}")


def main() -> None:
    seen: set[str] = set()
    records: list[dict[str, int | str]] = []
    try:
        with tarfile.open(fileobj=sys.stdin.buffer, mode="r|*") as archive:
            for member in archive:
                name = member.name.removeprefix("./")
                if name not in EXPECTED:
                    fail(f"unexpected member: {name}")
                if name in seen:
                    fail(f"duplicate member: {name}")
                if not member.isfile():
                    fail(f"member is not a regular file: {name}")
                if member.mode & 0o7000:
                    fail(f"unsafe special mode on member: {name}")
                if member.size < 1:
                    fail(f"empty member: {name}")
                seen.add(name)
                records.append(
                    {"name": name, "mode": member.mode & 0o777, "size": member.size}
                )
    except (tarfile.TarError, OSError) as exc:
        fail(f"invalid tar stream: {exc}")

    if seen != EXPECTED:
        fail(f"missing members: {sorted(EXPECTED - seen)}")
    json.dump(sorted(records, key=lambda item: str(item["name"])), sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
