#!/usr/bin/env python
"""Replace em dashes in user-facing copy with commas (+ cleanup artifacts).

Scoped to UI/copy files; skips low-level server modules (crypto/ai/auth) where a
'—' would only ever be in a comment and is not worth the risk. Run:
    python scripts/strip-emdash.py
"""
import os
import re
import pathlib

ROOTS = [
    ("src/app", (".tsx", ".ts")),
    ("src/components", (".tsx", ".ts")),
    ("src/server/data", (".ts",)),
]
EXTRA_FILES = [
    "src/lib/therapy-config.ts",
    "src/lib/group-session/templates.ts",
    "src/lib/achievements.ts",
]


def fix(text: str) -> str:
    text = re.sub(r"\s*—\s*", ", ", text)  # em dash (+ surrounding ws) -> ", "
    text = re.sub(r",\s*,", ",", text)            # collapse double commas
    text = re.sub(r"\(\s*,\s*", "(", text)        # "(, " -> "("
    text = re.sub(r",\s*\)", ")", text)            # ", )" -> ")"
    text = re.sub(r" +,", ",", text)               # " ," -> ","
    text = re.sub(r",\s*([.!?;:])", r"\1", text)   # ", ." -> "."
    return text


def candidates():
    for root, exts in ROOTS:
        for dirpath, _dirs, files in os.walk(root):
            for f in files:
                if f.endswith(exts):
                    yield pathlib.Path(dirpath) / f
    for f in EXTRA_FILES:
        p = pathlib.Path(f)
        if p.exists():
            yield p


def main() -> None:
    changed = 0
    for path in candidates():
        original = path.read_text(encoding="utf-8")
        if "—" not in original:
            continue
        updated = fix(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            n = original.count("—")
            print(f"  {path.as_posix()}: {n} em dash(es) replaced")
            changed += 1
    print(f"Done. {changed} file(s) updated.")


if __name__ == "__main__":
    main()
