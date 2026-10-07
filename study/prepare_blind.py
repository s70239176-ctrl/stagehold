"""Prepare a blind judging set: neutral file names, shuffled, frames re-encoded like the app
(long edge 1280, JPEG <= 150 KB), plus the exact contract prompt for each. The class key is
written outside the blind folder so a judge never sees it.

  python study/prepare_blind.py --manifest fixtures/manifest.web2.json
"""

import argparse
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import prompt as P  # noqa: E402
from run_study import prepare_frame  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--manifest", default="fixtures/manifest.web2.json")
ap.add_argument("--seed", type=int, default=11)
ap.add_argument("--blind-dir", default="blind")
ap.add_argument("--key", default="blind_key.json")
args = ap.parse_args()

root = os.path.dirname(HERE)
base = os.path.dirname(os.path.abspath(os.path.join(root, args.manifest)))
items = json.load(open(os.path.join(root, args.manifest)))
random.Random(args.seed).shuffle(items)

blind = os.path.join(HERE, args.blind_dir)
os.makedirs(blind, exist_ok=True)
prompts, key = {}, {}
for i, item in enumerate(items, 1):
    pid = "p%02d" % i
    jpeg = prepare_frame(os.path.join(base, item["file"]))
    open(os.path.join(blind, pid + ".jpg"), "wb").write(jpeg)
    prompts[pid] = P.build_prompt(item["stage"], item["issued_code"])
    key[pid] = {"file": item["file"], "class": item["class"], "stage": item["stage"]}

json.dump(prompts, open(os.path.join(blind, "prompts.json"), "w"), indent=1)
json.dump(key, open(os.path.join(HERE, args.key), "w"), indent=1)
print("prepared", len(items), "blind frames in", blind)
print("class key (not for judges):", os.path.join(HERE, args.key))
