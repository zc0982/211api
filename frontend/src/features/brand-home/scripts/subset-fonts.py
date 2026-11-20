#!/usr/bin/env python3
"""Rebuild the brand-home Geist Mono WOFF2 subsets (code panels and figures).

Body text and headings use the system font stack (Inter / PingFang SC / …,
same as astrlink.com), so only the monospace face is self-hosted. The subset
is ASCII plus a few symbols; it does not depend on the locale files.

Requirements (any throwaway virtualenv):
    python3 -m venv .venv && .venv/bin/pip install fonttools==4.60.1 brotli

Source (official release, SIL OFL 1.1):
    Geist Mono  vercel/geist-font  v1.9.2  geist-font-v1.9.2.zip
                GeistMono/ttf/GeistMono-{Regular,Medium}.ttf

Usage:
    .venv/bin/python subset-fonts.py --src <dir with the files above>

Writes ../assets/fonts/geist-mono-*.woff2 and charset-mono.txt next to this script.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from fontTools import subset

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "assets" / "fonts"

ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
MONO_EXTRA = "·•→…—–¥$€"


def charset(*parts: str) -> str:
    chars = {c for part in parts for c in part if c not in "\n\r\t"}
    return "".join(sorted(chars))


def build(src: Path, filename: str, out_name: str, text: str) -> int:
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.hinting = False
    options.desubroutinize = True
    font = subset.load_font(str(src / filename), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    target = OUT / out_name
    subset.save_font(font, str(target), options)
    return target.stat().st_size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", type=Path, required=True)
    args = parser.parse_args()

    mono_chars = charset(ASCII, MONO_EXTRA)
    (HERE / "charset-mono.txt").write_text(mono_chars + "\n", encoding="utf-8")

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for filename, out_name in [
        ("GeistMono-Regular.ttf", "geist-mono-400.woff2"),
        ("GeistMono-Medium.ttf", "geist-mono-500.woff2"),
    ]:
        size = build(args.src, filename, out_name, mono_chars)
        total += size
        print(f"{out_name:28} {size / 1024:7.1f} KB  ({len(mono_chars)} chars)")
    print(f"{'total':28} {total / 1024:7.1f} KB")


if __name__ == "__main__":
    main()
