"""Score blind judge results against the class key and print the gate report.

  python study/score_blind.py --stage-only study/blind/results_*.json
Each results file is a JSON array: [{"id": "p01", "stage_met": "...", "code_visible": "..."}, ...]
The file name after 'results_' is used as the model name.
"""

import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import prompt as P  # noqa: E402
from run_study import report  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("files", nargs="+")
ap.add_argument("--stage-only", action="store_true")
ap.add_argument("--key", default="blind_key.json")
args = ap.parse_args()

key = json.load(open(os.path.join(HERE, args.key)))
rows = []
missing = []
for pattern in args.files:
    for path in sorted(glob.glob(pattern)):
        model = os.path.basename(path)[len("results_"):-len(".json")]
        data = json.load(open(path))
        got = {d["id"]: d for d in data if isinstance(d, dict) and "id" in d}
        for pid, meta in key.items():
            d = got.get(pid)
            if d is None:
                missing.append((model, pid))
                continue
            ans = P.parse_answers({"stage_met": d.get("stage_met"), "code_visible": d.get("code_visible")})
            rows.append({
                "file": meta["file"], "class": meta["class"], "stage": meta["stage"], "model": model, "run": 0,
                "answers": ans, "pass": (ans["stage_met"] == "yes") if args.stage_only else P.passes(ans),
            })
if missing:
    print("MISSING answers:", missing)
if args.stage_only:
    print("*** STAGE-ONLY: the code question was not scored. This cannot pass the real gate. ***")
print("raw answers per image:")
by = {}
for r in rows:
    by.setdefault((r["file"], r["class"]), {})[r["model"]] = r["answers"]["stage_met"]
for (f, c), v in sorted(by.items(), key=lambda kv: kv[0][1]):
    print("  %-8s %-34s %s" % (c, f.split("/")[-1][:34], "  ".join("%s=%s" % (m, a) for m, a in sorted(v.items()))))
report(rows)
