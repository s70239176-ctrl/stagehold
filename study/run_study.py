"""Judge study harness: do several vision models agree on honest frames and refuse bad ones?

Usage (from the project root):
  python study/run_study.py --manifest fixtures/manifest.json --runs 3
  python study/run_study.py --mock          # offline self-test of the harness logic

Models are chosen with the STUDY_MODELS environment variable, e.g.
  STUDY_MODELS="anthropic:<model-id>,openai:<model-id>,gemini:<model-id>"
and keys ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY. Model ids are NOT defaulted here
because they change; set the ones the account can call. Providers without keys are skipped.

Frames are re-encoded the way the Stagehold app will send them (long edge 1280, JPEG,
<= 150 KB) before being judged, using the same prompt the contract uses (study/prompt.py).
"""

import argparse
import base64
import hashlib
import io
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prompt as P  # noqa: E402

# wrong_site (a different building) is NOT a panel gate: same-site is checked by the contract's deterministic
# alignment, so the panel is never asked about it. Test that class with the alignment function instead.
NEGATIVE_CLASSES = ("dark", "cropped", "wrong_subject", "sign", "no_code", "wrong_code", "code_on_sheet", "wrong_stage")
MAX_BYTES = 150 * 1024

# Gate thresholds (proposed; confirm). Honest frames must pass; every negative class must be refused.
HONEST_MIN_UNANIMOUS_PASS = 0.90
NEGATIVE_MIN_REFUSED = 0.95


def prepare_frame(path):
    from PIL import Image

    img = Image.open(path).convert("RGB")
    long_edge = max(img.size)
    if long_edge > 1280:
        scale = 1280 / long_edge
        img = img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS)
    # Guarantee the size cap, as the real app must: lower the quality first, then shrink the image.
    quality = 80
    while True:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        data = buf.getvalue()
        if len(data) <= MAX_BYTES:
            return data
        if quality > 40:
            quality -= 5
        else:
            img = img.resize((round(img.size[0] * 0.88), round(img.size[1] * 0.88)), Image.LANCZOS)
            quality = 70


def http_json(url, headers, body, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 529) and attempt < 3:
                time.sleep(2 ** attempt * 3)
                continue
            raise RuntimeError("HTTP %s: %s" % (exc.code, exc.read()[:300]))
    raise RuntimeError("unreachable")


def extract_json(text):
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        return json.loads(text[start:end + 1])
    except ValueError:
        return None


def ask_anthropic(model, jpeg, text):
    key = os.environ["ANTHROPIC_API_KEY"]
    body = {
        "model": model,
        "max_tokens": 200,
        "messages": [{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(jpeg).decode()}},
            {"type": "text", "text": text},
        ]}],
    }
    out = http_json("https://api.anthropic.com/v1/messages",
                    {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}, body)
    return "".join(b.get("text", "") for b in out.get("content", []))


def ask_openai(model, jpeg, text):
    key = os.environ["OPENAI_API_KEY"]
    data_url = "data:image/jpeg;base64," + base64.b64encode(jpeg).decode()
    body = {
        "model": model,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": data_url}},
        ]}],
    }
    out = http_json("https://api.openai.com/v1/chat/completions",
                    {"Authorization": "Bearer " + key, "content-type": "application/json"}, body)
    return out["choices"][0]["message"]["content"]


def ask_gemini(model, jpeg, text):
    key = os.environ["GEMINI_API_KEY"]
    body = {"contents": [{"parts": [
        {"text": text},
        {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(jpeg).decode()}},
    ]}]}
    url = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s" % (model, key)
    out = http_json(url, {"content-type": "application/json"}, body)
    return "".join(p.get("text", "") for p in out["candidates"][0]["content"]["parts"])


PROVIDERS = {
    "anthropic": ("ANTHROPIC_API_KEY", ask_anthropic),
    "openai": ("OPENAI_API_KEY", ask_openai),
    "gemini": ("GEMINI_API_KEY", ask_gemini),
}


def mock_ask(model, jpeg, text):
    """Offline stand-in: behaves like a sensible but imperfect model, seeded by the image bytes."""
    rnd = random.Random(hashlib.sha256(jpeg + model.encode()).hexdigest())
    roll = rnd.random()
    # Class-blind on purpose: this only exercises the harness plumbing and report, not judging quality.
    return json.dumps({"stage_met": "yes" if roll < 0.9 else "unclear", "code_visible": "yes" if roll < 0.92 else "no"})


def load_models(mock):
    if mock:
        return [("mock", "mock-a", mock_ask), ("mock", "mock-b", mock_ask), ("mock", "mock-c", mock_ask)]
    spec = os.environ.get("STUDY_MODELS", "")
    models = []
    for item in [s.strip() for s in spec.split(",") if s.strip()]:
        provider, _, model = item.partition(":")
        if provider not in PROVIDERS or not model:
            print("skipping malformed STUDY_MODELS entry:", item)
            continue
        env, fn = PROVIDERS[provider]
        if not os.environ.get(env):
            print("skipping %s: %s not set" % (item, env))
            continue
        models.append((provider, model, fn))
    return models


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="fixtures/manifest.json")
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--mock", action="store_true")
    ap.add_argument("--stage-only", action="store_true",
                    help="score only stage_met (for web photos that carry no written code). "
                         "This does NOT test the code question and cannot pass the real gate.")
    ap.add_argument("--out", default="study/results.json")
    args = ap.parse_args()

    models = load_models(args.mock)
    if len(models) < (1 if args.mock else 3):
        print("Need at least 3 models for the study (set STUDY_MODELS and keys), got %d." % len(models))
        if not args.mock:
            sys.exit(2)

    base = os.path.dirname(os.path.abspath(args.manifest))
    items = json.load(open(args.manifest))
    rows = []
    for item in items:
        cls = item["class"]
        path = os.path.join(base, item["file"])
        if args.mock and not os.path.exists(path):
            jpeg = hashlib.sha256(item["file"].encode()).digest() * 40
        else:
            jpeg = prepare_frame(path)
        text = P.build_prompt(item["stage"], item["issued_code"])
        for provider, model, fn in models:
            for run in range(args.runs):
                try:
                    raw = fn(model, jpeg, text)
                    answers = P.parse_answers(raw if isinstance(raw, dict) else extract_json(raw) if isinstance(raw, str) else None)
                except Exception as exc:  # noqa: BLE001 - record and continue
                    answers = {"stage_met": "error", "code_visible": "error"}
                    print("  error:", provider, model, item["file"], str(exc)[:120])
                rows.append({
                    "file": item["file"], "class": cls, "stage": item["stage"],
                    "model": provider + ":" + model, "run": run,
                    "answers": answers,
                    "pass": (False if answers["stage_met"] == "error" else
                             (answers["stage_met"] == "yes" if args.stage_only else P.passes(answers))),
                })
        print("done", item["file"])

    json.dump(rows, open(args.out, "w"), indent=1)
    if args.stage_only:
        print("\n*** STAGE-ONLY MODE: the code question was not scored. This cannot pass the real gate. ***")
    report(rows)


def report(rows):
    by_class = {}
    for r in rows:
        by_class.setdefault(r["class"], []).append(r)

    print("\n=== Per class ===")
    print("%-16s %6s %10s %10s" % ("class", "rows", "pass_rate", "refused"))
    verdicts = {}
    for cls, rs in sorted(by_class.items()):
        passed = sum(1 for r in rs if r["pass"])
        rate = passed / len(rs)
        print("%-16s %6d %9.1f%% %9.1f%%" % (cls, len(rs), rate * 100, (1 - rate) * 100))
        verdicts[cls] = rate

    # unanimity per honest image: all models x runs agree on pass
    honest = [r for r in rows if r["class"] == "honest"]
    per_image = {}
    for r in honest:
        per_image.setdefault(r["file"], []).append(r["pass"])
    unanimous_pass = sum(1 for v in per_image.values() if all(v))
    split = sum(1 for v in per_image.values() if any(v) and not all(v))
    n_img = max(1, len(per_image))

    print("\n=== Honest frames (per image, all models and runs) ===")
    print("images: %d  unanimous pass: %d  split: %d  unanimous fail: %d" %
          (len(per_image), unanimous_pass, split, len(per_image) - unanimous_pass - split))

    print("\n=== Per model, honest pass rate / negative refusal rate ===")
    models = sorted({r["model"] for r in rows})
    for m in models:
        h = [r for r in honest if r["model"] == m]
        n = [r for r in rows if r["model"] == m and r["class"] in NEGATIVE_CLASSES]
        hp = sum(1 for r in h if r["pass"]) / max(1, len(h))
        nr = sum(1 for r in n if not r["pass"]) / max(1, len(n))
        print("%-40s honest pass %5.1f%%   negatives refused %5.1f%%" % (m, hp * 100, nr * 100))

    print("\n=== Gate ===")
    honest_ok = (unanimous_pass / n_img) >= HONEST_MIN_UNANIMOUS_PASS
    print("honest frames unanimously passed: %.1f%% (need >= %.0f%%) -> %s" %
          (100 * unanimous_pass / n_img, 100 * HONEST_MIN_UNANIMOUS_PASS, "OK" if honest_ok else "FAIL"))
    all_ok = honest_ok
    for cls in NEGATIVE_CLASSES:
        if cls in verdicts:
            refused = 1 - verdicts[cls]
            ok = refused >= NEGATIVE_MIN_REFUSED
            all_ok = all_ok and ok
            print("%-16s refused %.1f%% (need >= %.0f%%) -> %s" % (cls, 100 * refused, 100 * NEGATIVE_MIN_REFUSED, "OK" if ok else "FAIL"))
    print("\nGATE:", "PASS" if all_ok else "FAIL (stop and re-plan; do not build further)")


if __name__ == "__main__":
    main()
