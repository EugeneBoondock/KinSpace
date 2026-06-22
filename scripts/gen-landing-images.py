#!/usr/bin/env python
"""Generate the KinSpace landing collage illustrations with OpenAI gpt-image-2.

Run:  OPENAI_API_KEY=... python scripts/gen-landing-images.py [name ...]
Writes PNGs to public/images/landing/. Stops on the first API error so we don't
burn credits on a bad parameter. Pass specific names to regenerate a subset.
"""
import base64
import json
import os
import pathlib
import sys
import urllib.request

API = "https://api.openai.com/v1/images/generations"
MODEL = "gpt-image-2"
OUT = pathlib.Path("public/images/landing")

STYLE = (
    " Warm, cozy, modern flat editorial illustration. Earthy palette: terracotta, "
    "sage green, warm cream, soft mustard gold, deep forest green. Soft organic "
    "shapes, gentle gradients, subtle paper grain. Inclusive, diverse people of "
    "different skin tones, ages and body types. Hopeful, calm, emotionally warm. "
    "No text, no words, no letters, no logos, no UI. Generous negative space."
)

JOBS = [
    (
        "hero-community",
        "1024x1536",
        "A small diverse group of people sitting close together in a warm cozy circle, "
        "supporting one another; one person gently rests a hand on another's shoulder, "
        "soft reassuring smiles, a deep sense of belonging and safety.",
    ),
    (
        "hero-peer",
        "1024x1024",
        "Two friends sitting on a comfortable sofa under warm lamplight, one listening "
        "with care while the other opens up — a calm, intimate peer-support moment.",
    ),
    (
        "hero-selfcare",
        "1024x1024",
        "One calm person sitting peacefully by a large sunlit window doing a gentle "
        "breathing and mindfulness moment, surrounded by soft houseplants, serene and "
        "restorative morning light.",
    ),
    (
        "hero-avatar",
        "1024x1024",
        "A friendly close-up portrait of one warm, smiling person looking gently toward "
        "the viewer, soft natural light, approachable and kind.",
    ),
]


def generate(name: str, size: str, prompt: str) -> None:
    body = json.dumps(
        {"model": MODEL, "prompt": prompt + STYLE, "size": size, "quality": "medium", "n": 1}
    ).encode()
    req = urllib.request.Request(
        API,
        data=body,
        headers={
            "Authorization": "Bearer " + os.environ["OPENAI_API_KEY"],
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.load(resp)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:500]
        print(f"  [x] {name}: HTTP {e.code} {detail}")
        sys.exit(1)
    b64 = data["data"][0]["b64_json"]
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    path.write_bytes(base64.b64decode(b64))
    print(f"  [ok] {name}.png ({size}) -> {path.stat().st_size // 1024} KB")


def main() -> None:
    wanted = set(sys.argv[1:])
    jobs = [j for j in JOBS if not wanted or j[0] in wanted]
    print(f"Generating {len(jobs)} image(s) with {MODEL} ...")
    for name, size, prompt in jobs:
        generate(name, size, prompt)
    print("Done.")


if __name__ == "__main__":
    main()
