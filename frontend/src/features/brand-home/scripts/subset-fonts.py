#!/usr/bin/env python3
"""Rebuild the brand-home WOFF2 font subsets.

Not part of the build and not in package.json. Run it whenever brandHome copy
changes (locales/zh.ts, locales/en.ts) so every rendered character stays in the
subset. Characters outside the subset (site name, model names from the API)
fall back to the system font stack.

Requirements (any throwaway virtualenv):
    python3 -m venv .venv && .venv/bin/pip install fonttools==4.60.1 brotli

Sources (official releases, SIL OFL 1.1):
    Noto Serif SC  notofonts/noto-cjk  Serif2.003  14_NotoSerifSC.zip
                   SubsetOTF/SC/NotoSerifSC-{Medium,SemiBold}.otf
    Noto Sans SC   notofonts/noto-cjk  Sans2.004   18_NotoSansSC.zip
                   NotoSansSC-{Regular,Medium}.otf
    Geist / Mono   vercel/geist-font   v1.9.2      geist-font-v1.9.2.zip
                   Geist/ttf/Geist-SemiBold.ttf, GeistMono/ttf/GeistMono-{Regular,Medium}.ttf

Usage:
    .venv/bin/python subset-fonts.py --src <dir with the files above>

Writes ../assets/fonts/*.woff2 and the character lists charset-*.txt next to
this script.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from fontTools import subset

HERE = Path(__file__).resolve().parent
FEATURE = HERE.parent
LOCALES = [FEATURE / "locales" / "zh.ts", FEATURE / "locales" / "en.ts"]
OUT = FEATURE / "assets" / "fonts"

# Keys rendered in the serif display face (section titles, hero headline).
SERIF_KEYS = {
    "titleLine1",
    "titleLine2",
    "titleEmphasis",
    "title",  # section titles: quickstart/trace/features/plaza/faq/cta
}
# Sections whose `title` is NOT serif.
SERIF_EXCLUDED_SECTIONS = {"meta", "ecosystem"}

ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
PUNCT = "·•→←↗…—–©®™¥€£$%‰“”‘’«»（）【】「」『』《》〈〉，。、：；？！～￥％＋－×÷＝＜＞"
MONO_EXTRA = "·•→…—–¥$€"

ENTRY = re.compile(r"(\w+)\s*:\s*\n?\s*(['\"])((?:\\.|(?!\2).)*)\2", re.S)
SECTION = re.compile(r"^\s{2}(\w+)\s*:\s*\{", re.M)


def locale_strings(path: Path) -> tuple[str, str]:
    """Returns (all_text, serif_text) from a locale module."""
    source = path.read_text(encoding="utf-8")
    sections = [(m.start(), m.group(1)) for m in SECTION.finditer(source)]
    all_text: list[str] = []
    serif_text: list[str] = []
    for match in ENTRY.finditer(source):
        key, value = match.group(1), match.group(3)
        value = re.sub(r"\{\w+\}", "", value)  # drop placeholders
        all_text.append(value)
        section = ""
        for start, name in sections:
            if start <= match.start():
                section = name
        if key in SERIF_KEYS and section not in SERIF_EXCLUDED_SECTIONS:
            serif_text.append(value)
    return "".join(all_text), "".join(serif_text)


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

    all_parts, serif_parts = zip(*(locale_strings(p) for p in LOCALES))
    sans_chars = charset(ASCII, PUNCT, *all_parts)
    serif_chars = charset(ASCII, "·，、？", *serif_parts)
    latin_chars = charset(ASCII, "·")
    mono_chars = charset(ASCII, MONO_EXTRA)

    for name, chars in {
        "sans": sans_chars,
        "serif": serif_chars,
        "wordmark": latin_chars,
        "mono": mono_chars,
    }.items():
        (HERE / f"charset-{name}.txt").write_text(chars + "\n", encoding="utf-8")

    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [
        ("NotoSerifSC-SemiBold.otf", "noto-serif-sc-600.woff2", serif_chars),
        ("NotoSerifSC-Medium.otf", "noto-serif-sc-500.woff2", serif_chars),
        ("NotoSansSC-Regular.otf", "noto-sans-sc-400.woff2", sans_chars),
        ("NotoSansSC-Medium.otf", "noto-sans-sc-500.woff2", sans_chars),
        ("Geist-SemiBold.ttf", "geist-600.woff2", latin_chars),
        ("GeistMono-Regular.ttf", "geist-mono-400.woff2", mono_chars),
        ("GeistMono-Medium.ttf", "geist-mono-500.woff2", mono_chars),
    ]
    total = 0
    for filename, out_name, chars in jobs:
        size = build(args.src, filename, out_name, chars)
        total += size
        print(f"{out_name:28} {size / 1024:7.1f} KB  ({len(chars)} chars)")
    print(f"{'total':28} {total / 1024:7.1f} KB")


if __name__ == "__main__":
    main()
