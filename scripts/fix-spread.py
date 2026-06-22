#!/usr/bin/env python
"""One-off repair: strip-emdash's cleanup wrongly removed the comma before spread
operators (`, ...x` -> `...x`). Restore it. Only matches a spread (`...` followed
by an identifier/[/{/( ) that is glued to a previous token (}, ), ], word) with no
separator — which is exactly the corruption. String ellipses ("Loading...") are
left alone because they are not followed by an identifier/bracket.
"""
import os
import re
import pathlib

ROOTS = [("src/app", (".tsx", ".ts")), ("src/components", (".tsx", ".ts")), ("src/server/data", (".ts",))]
EXTRA = ["src/lib/therapy-config.ts", "src/lib/group-session/templates.ts", "src/lib/achievements.ts"]

PAT = re.compile(r"([}\)\]\w])\.\.\.(?=[\w\[{(])")


def candidates():
    for root, exts in ROOTS:
        for dp, _d, files in os.walk(root):
            for f in files:
                if f.endswith(exts):
                    yield pathlib.Path(dp) / f
    for f in EXTRA:
        p = pathlib.Path(f)
        if p.exists():
            yield p


def main() -> None:
    changed = 0
    for path in candidates():
        s = path.read_text(encoding="utf-8")
        fixed = PAT.sub(r"\1, ...", s)
        if fixed != s:
            path.write_text(fixed, encoding="utf-8")
            print(f"  fixed spreads in {path.as_posix()}")
            changed += 1
    print(f"Done. {changed} file(s) repaired.")


if __name__ == "__main__":
    main()
