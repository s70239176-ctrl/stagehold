"""Writes docs/PHOTO_TESTS.md from calibration/results/photo_results.json."""
import csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = json.load(open(ROOT + "/calibration/results/photo_results.json"))
rows = res["results"]
sources = {
    "P01": "w2_11_roof_done_candidate.jpg", "P02": "w2_12_roof_done_candidate.jpg", "P03": "w2_09_mid_build.jpg",
    "P04": "w2_14_wrong_subject.jpg", "P05": "w2_10_wrong_building.jpg", "P06": "w2_11_roof_done_candidate.jpg",
    "P07": "w2_11_roof_done_candidate.jpg", "P08": "w2_11_roof_done_candidate.jpg", "P09": "w2_11_roof_done_candidate.jpg",
    "P10": None, "P11": "w2_09_mid_build.jpg",
}
attr = {r["file"]: r for r in csv.DictReader(open(ROOT + "/fixtures/web2/ATTRIBUTION.csv", encoding="utf-8"))}
sattr = list(csv.DictReader(open(ROOT + "/fixtures/sites/ATTRIBUTION.csv", encoding="utf-8")))

def parse(r):
    m = re.search(r'"stage_met":\s*"(\w+)".*"code_visible":\s*"(\w+)"', r["verdict"])
    return (m.group(1), m.group(2)) if m else ("error", "error")

lines = []
w = lines.append
w("# Realistic photograph tests\n")
w("Eleven genuine construction-site photographs put through the real validators on Studionet with the exact prompt and parser the contract embeds (`study/prompt.py`, through a stateless probe, `calibration/judge_probe.py`). For each, the stage asked about and the code the validators were told to look for are given, together with what a person looking at the photograph would expect. **The expectations were written down before the validators were asked** (`calibration/build_photo_cases.py`). Agreement is reported as it came out; nothing was tuned afterwards.\n")
w("**What is real and what is simulated.** The photographs are genuine (Wikimedia Commons, credits below). The code on the wall is **simulated lettering**: a handwriting-style font with jitter, blur and wear drawn onto the photograph. It is not a human hand on a real wall; photographs of true handwriting have not been run yet. Darkening and cropping are applied in software.\n")
w("| Case | Photograph and what was done to it | Stage asked | Expected (stage / code) | Validators said | Agreement | Votes |\n|---|---|---|---|---|---|---|")
agree = 0
for r in rows:
    s, c = parse(r)
    ok = (s == r["expect_stage"]) and (c == r["expect_code"])
    agree += ok
    w("| %s | %s | %s | %s / %s | %s / %s | %s | %s |" % (r["id"], r["title"], r["stage"], r["expect_stage"], r["expect_code"], s, c, "yes" if ok else "**no**", json.dumps(r.get("votes"))))
w("")
w("**%d of %d cases matched the expectation on both questions.**\n" % (agree, len(rows)))
w("Reading the table:\n")
w("- A wrong code, no code, a nearly black frame and a frame with the roof cropped out must never pay. Check the corresponding rows: a pass needs both answers `yes`.\n- Where the validators and the author's reading differ, the row says so; a disagreement on a borderline photograph (an unfinished building under a roof, for example) is information about the stage wording, not a failure of the contract, which fails closed on `no`, `unclear` and malformed answers.\n- Each row is one asked question. Panel votes (for example 3 agree, 2 idle) are the transaction's consensus record; every transaction hash is in `calibration/results/photo_results.json`.\n")
w("The same photographs also run through the full product (deposit, fund, code, signed frame, panel, payout) in [EVIDENCE.md](EVIDENCE.md), and the site check has its own calibration in [SITE_VERIFICATION.md](SITE_VERIFICATION.md).\n")
w("## Photograph sources\n")
w("| Case | Photograph | Author | Licence |\n|---|---|---|---|")
for r in rows:
    f = sources.get(r["id"])
    if f and f in attr:
        a = attr[f]
        w("| %s | %s | %s | %s |" % (r["id"], a["title"].replace("File:", ""), re.sub(r"\s+", " ", a["author"])[:50], a["license"]))
    elif r["id"] == "P10":
        a = next(x for x in sattr if x["file"].startswith("s11_"))
        w("| %s | %s | %s | %s |" % (r["id"], a["title"].replace("File:", ""), re.sub(r"\s+", " ", a["author"])[:50], a["license"]))
w("\nThe photographs are not stored in this repository; fetch them from the Commons pages in the `ATTRIBUTION.csv` files.\n")
w("## Reproduce\n")
w("```bash\npython calibration/build_photo_cases.py\npython calibration/build_judge_probe.py\nnode calibration/run_judge_probe.mjs      # asks the validators on Studionet\npython calibration/report_photos.py\n```\n")
open(ROOT + "/docs/PHOTO_TESTS.md", "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("wrote docs/PHOTO_TESTS.md", agree, "/", len(rows))
