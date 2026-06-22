#!/usr/bin/env python
"""Generate warm empty-state illustrations for authenticated KinSpace pages with
OpenAI gpt-image-2. Writes PNGs to public/images/app/ (optimize to webp after).

Run:  OPENAI_API_KEY=... python scripts/gen-app-images.py [name ...]
"""
import base64
import json
import os
import pathlib
import sys
import urllib.request
import urllib.error

API = "https://api.openai.com/v1/images/generations"
MODEL = "gpt-image-2"
OUT = pathlib.Path("public/images/app")

STYLE = (
    " Warm, cozy, modern flat editorial spot illustration. Earthy palette: terracotta, "
    "sage green, warm cream, soft mustard gold, deep forest green. Soft organic shapes, "
    "gentle gradients, subtle paper grain. Inclusive and diverse where people appear. "
    "Hopeful, calm, reassuring. Centered subject with generous negative space, simple "
    "background. No text, no words, no letters, no logos, no UI."
)

JOBS = [
    ("empty-groups", "Two stylized figures walking together toward a warm, open, glowing doorway, about to join a welcoming space."),
    ("empty-feed", "A person writing the first note at a cozy desk with soft speech-bubble and heart shapes floating gently nearby, inviting conversation."),
    ("empty-matches", "Two open hands reaching gently toward each other with a soft warm glow between them, a connection about to form."),
    ("empty-search", "A person calmly holding a compass and looking at a small folded map, gently searching, hopeful and unhurried."),
    ("empty-ask", "A person raising one hand to ask a question, with a soft supportive silhouette of people behind them, encouraging and safe."),
    ("empty-insights", "A small green seedling growing in a clay pot under a gentle drizzle and soft light, patterns and growth emerging over time."),
    ("empty-lanterns", "A single warm glowing paper lantern floating in a calm dusk sky, quiet readiness, comfort and care."),
    ("empty-games", "A cozy low table with a friendly board game and pieces set out, two cushions, inviting others to join, playful and low-pressure."),
]


def generate(name: str, prompt: str) -> None:
    body = json.dumps({"model": MODEL, "prompt": prompt + STYLE, "size": "1024x1024", "quality": "medium", "n": 1}).encode()
    req = urllib.request.Request(
        API, data=body,
        headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"], "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"  [x] {name}: HTTP {e.code} {e.read().decode('utf-8','replace')[:400]}")
        sys.exit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    path.write_bytes(base64.b64decode(data["data"][0]["b64_json"]))
    print(f"  [ok] {name}.png -> {path.stat().st_size // 1024} KB")


def main() -> None:
    wanted = set(sys.argv[1:])
    jobs = [j for j in JOBS if not wanted or j[0] in wanted]
    print(f"Generating {len(jobs)} app image(s) with {MODEL} ...")
    for name, prompt in jobs:
        generate(name, prompt)
    print("Done.")


if __name__ == "__main__":
    main()
