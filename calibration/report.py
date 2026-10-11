"""Writes docs/SITE_VERIFICATION.md from the calibration results.

    python calibration/report.py        (after make_pairs.py, align_calibration.py and run_site_probe.mjs, twice)
"""
import csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pairs = json.load(open(ROOT + "/calibration/pairs/pairs.json"))
align = json.load(open(ROOT + "/calibration/results/align_scores.json"))
runs = [json.load(open(ROOT + "/calibration/results/panel_results_run%d.json" % i)) for i in (1, 2)]
attr = {r["file"]: r for r in csv.DictReader(open(ROOT + "/fixtures/sites/ATTRIBUTION.csv", encoding="utf-8"))}
attr_local = {}
for d in ("web", "web2"):
    for r in csv.DictReader(open(ROOT + "/fixtures/%s/ATTRIBUTION.csv" % d, encoding="utf-8")):
        attr_local[r["file"]] = r

def verdict(r):
    m = re.search(r'"(yes|no|unclear)"', r["verdict"])
    return m.group(1) if m else "error"

score = {r[0]: r[2] for r in align["rows"]}
res = [{r["id"]: verdict(r) for r in run["results"]} for run in runs]
votes = [{r["id"]: r.get("votes") for r in run["results"]} for run in runs]
M = [p for p in pairs if p["label"].startswith("M")]
U = [p for p in pairs if p["label"].startswith("U")]

def tally(ids, k):
    c = {"yes": 0, "no": 0, "unclear": 0, "error": 0}
    for i in ids:
        c[res[k][i]] += 1
    return c

lines = []
w = lines.append
w("# Site verification: calibration on genuine photographs\n")
w("Two mechanisms can tell whether a builder's photograph shows the payer's anchor site. Both were tested on the same **26 pairs of genuine photographs**: 12 pairs of the same construction site and 14 pairs of unrelated sites, 5 of them deliberately look-alike (two different houses under construction, two different roof-truss sites, and so on). The photographs are real; none is generated or edited. Sources and licences are listed at the end.\n")
w("## What was tested\n")
w("1. **Deterministic alignment** (`contracts/src/align.py`, present since the first version): an integer edge-overlap score between the anchor and the frame's thumbnail, best over small shifts. It needs a threshold, and `align_min_permille = 0` switched it off.\n2. **Panel same-site question** (new): the validators are shown the anchor and the frame and answer `same_site` with `yes`, `no` or `unclear` (`study/prompt.py`, `build_site_prompt`). The frame passes the site check only on `yes`; `no`, `unclear` and any malformed answer refuse it.\n")
w("Matching pairs are labelled by what a builder could actually do: **same spot** (similar viewpoint, different stage or time; 9 pairs) and **other angle** (same site, a different viewpoint; 3 pairs). Labels were set by looking at the photographs before any score was computed.\n")
w("## Result 1: the deterministic alignment cannot be calibrated\n")
m = [r[2] for r in align["rows"] if r[1].startswith("M")]
u = [r[2] for r in align["rows"] if r[1].startswith("U")]
import statistics
w("| | Pairs | Lowest | Median | Highest |\n|---|---|---|---|---|")
w("| Same site | %d | %d | %d | %d |" % (len(m), min(m), statistics.median(m), max(m)))
w("| Unrelated | %d | %d | %d | %d |\n" % (len(u), min(u), statistics.median(u), max(u)))
w("The ranges overlap almost completely. The chance that a matching pair scores above an unrelated one (AUC) is **%.2f**, where 0.50 is a coin flip. The best single threshold (%d) accepts %s of the matching pairs and still accepts %s of the unrelated ones. A photograph is never pixel-aligned with an earlier one of the same site: the stage changes the scene, and a hand-held camera moves. Only a fixed camera would separate the two, and no threshold works for people. **The mechanism stays off, and the contract no longer relies on it.** (It is still available through `align_min_permille` for jobs that use a fixed camera; it has not been calibrated for any other use.)\n" % (align["auc"], align["best"], "%d%%" % round(100 * sum(1 for x in m if x >= align["best"]) / len(m)), "%d%%" % round(100 * sum(1 for x in u if x >= align["best"]) / len(u))))
w("## Result 2: the panel's same-site question separates them\n")
w("Run on Studionet through a probe contract that uses exactly the prompt and parser the real contract embeds, with real validators. Every pair was asked twice, in two separate runs.\n")
w("| | Pairs | yes | unclear | no |\n|---|---|---|---|---|")
for k in (0, 1):
    t = tally([p["id"] for p in M], k)
    w("| Same site, run %d | %d | %d | %d | %d |" % (k + 1, len(M), t["yes"], t["unclear"], t["no"]))
for k in (0, 1):
    t = tally([p["id"] for p in U], k)
    w("| Unrelated, run %d | %d | %d | %d | %d |" % (k + 1, len(U), t["yes"], t["unclear"], t["no"]))
fa = sum(res[k][p["id"]] == "yes" for k in (0, 1) for p in U)
tp = sum(res[k][p["id"]] == "yes" for k in (0, 1) for p in M)
tps = sum(res[k][p["id"]] == "yes" for k in (0, 1) for p in M if p["label"] == "M_spot")
ns = 2 * sum(1 for p in M if p["label"] == "M_spot")
w("")
w("- **False accepts: %d of %d** unrelated answers were `yes` (a frame from a different site would have been accepted). With this few pairs that supports \"rare\", not \"never\": 0 of 28 leaves a plausible true rate up to about 10%% (rule of three, 3/28).\n- **Same site accepted: %d of %d** answers (%d%%); same spot %d of %d. A same-site frame that gets `no` or `unclear` is refused and the builder may shoot again from the anchor's spot; the failure is a delay, not a loss.\n- Hard look-alike negatives (two different houses under construction and similar): see the table.\n" % (fa, 2 * len(U), tp, 2 * len(M), round(100 * tp / (2 * len(M))), tps, ns))
w("### Every pair\n")
w("| Pair | What it is | Class | Edge-overlap score | Panel run 1 | Panel run 2 |\n|---|---|---|---|---|---|")
for p in pairs:
    w("| %s | %s | %s | %d | %s | %s |" % (p["id"], p["note"], p["label"].replace("_", " "), score[p["id"]], res[0][p["id"]], res[1][p["id"]]))
w("")
w("The panel's own votes (for example 3 agree, 2 idle) are in `calibration/results/panel_results_run1.json` and `_run2.json`, with every transaction hash.\n")
w("## What this does and does not establish\n")
w("- It is a small set (26 pairs, 5 repeat-photographed sites plus local fixtures), asked twice. It is a calibration, not a guarantee.\n- The validators' models are chosen by the network for each transaction. Different panels can answer differently; the contract fails closed on any answer other than `yes`.\n- The anchor and the frame are both public. A builder who obtains a genuine photograph of the real site (or an edited copy of the anchor) and letters the code on it is not stopped by this check. The site check stops a photograph of the wrong place; it does not prove the photograph is live (that is the capture limitation in [TRUST_MODEL.md](TRUST_MODEL.md)).\n- The check judges surroundings, not the stage; the stage question is separate and both must be `yes`.\n- Hand-held repeat photographs of one site from very different angles and stages are the hard case (M12 here). The anchor hint in the payer page asks the payer to photograph from where the builder will stand.\n")
w("## What the frontend says\n")
w("- A job with the check on shows **Site check on** on every page, and each result card has a *Same site as the anchor* row with the panel's answer.\n- A job created without it (an option under *Advanced* on the payer page) shows **Site not checked** on every page, and the result row reads *Not checked yet*. Jobs made before this change show the same.\n")
w("## Reproduce\n")
w("```bash\npython calibration/make_pairs.py            # builds the pairs from fixtures/\npython calibration/align_calibration.py     # deterministic scores, AUC\npython calibration/build_site_probe.py      # the probe contract (study/prompt.py wording)\nnode calibration/run_site_probe.mjs calibration/results/panel_results_run1.json   # asks the validators, on Studionet\npython calibration/report.py                # this file\n```\n")
w("## Photograph sources\n")
w("All are on Wikimedia Commons under the licence shown; authors and links are in `fixtures/sites/ATTRIBUTION.csv`, `fixtures/web/ATTRIBUTION.csv` and `fixtures/web2/ATTRIBUTION.csv`. The photographs are not stored in this repository.\n")
w("| Pair | Anchor | Frame |\n|---|---|---|")
def cred(fn):
    r = attr.get(fn) or attr_local.get(fn)
    if not r:
        return fn
    a = re.sub(r"\s+", " ", r.get("author", ""))[:40]
    return "%s (%s, %s)" % (r["title"].replace("File:", "")[:48], a, r["license"])
for p in pairs:
    w("| %s | %s | %s |" % (p["id"], cred(p["anchor"]), cred(p["frame"])))
open(ROOT + "/docs/SITE_VERIFICATION.md", "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("wrote docs/SITE_VERIFICATION.md")
