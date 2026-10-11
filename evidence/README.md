# evidence/

Runs the Stagehold flows through a **deployed frontend** in a headless browser and records evidence: every transaction hash,
the validators' judgment and GenVM execution result, and the contract's state and balance before and after each
financial step, checked against the expected figures.

```bash
cd evidence
npm install
SITE=https://stagehold-cr.vercel.app node run.mjs              # all flows
SITE=... node run.mjs pass recover cancel expire fallback      # or choose some
```

Output goes to `evidence/results/`: `evidence.json` (steps with expected and actual figures), `tx/<hash>.json` (one file per
transaction: status, GenVM result, consensus data), `scenes/` (the pictures used) and final screenshots.
Needs Python with Pillow and NumPy (to letter the code), Edge or Chrome, and `web/node_modules` (for `genlayer-js`).

| Flow | What it shows |
|---|---|
| `pass` | Wrong code on the wall is refused and the fee burned; right code passes; the builder is paid once at finality |
| `recover` | The same on a test job, with the "Payment is late: recover it" button clicked while the stage is settling |
| `cancel` | Cancelling needs both parties and refunds the payer; stray value from a failed transaction is reclaimable; credits withdraw to exactly 0 |
| `expire` | The payer cannot expire early; after the deadline the job expires and the payer is refunded |
| `fallback` | The payer never issues a code; the builder unlocks a fallback code and is still paid |

**Camera.** A headless browser has no camera, so the script installs a canvas stream as the camera: a real
construction-site photograph (Wikimedia Commons, CC BY-SA 4.0, see `fixtures/web2/ATTRIBUTION.csv`) with the code lettered on the
wall in a handwriting-style font with jitter, blur and wear (`make_scene.py`). This is **simulated lettering, not a human hand**.
To run the same flows on your own handwritten photographs, put JPEGs named after the codes in a folder
(`TREE_BLUE.jpg`, `MOON_FISH.jpg`) and run `USER_SCENES=/path/to/folder node run.mjs pass`. `PHOTO=/path/to/site.jpg` also swaps the site
photograph used for the anchor and the generated scenes.
