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
| `site` | The site check: a photograph of a different site with the right code is refused by the validators; a later photograph of the same site (the Highland extension, steel frame then finished) passes |
| `disclosure` | A job created without the site check says **Site not checked** on the pages |

**Camera.** A headless browser has no camera, so the script installs a canvas stream as the camera: a real
construction-site photograph (Wikimedia Commons, CC BY-SA 4.0, see `fixtures/web2/ATTRIBUTION.csv`) with the code lettered on the
wall in a handwriting-style font with jitter, blur and wear (`make_scene.py`). This is **simulated lettering, not a human hand**.
To run the same flows on your own handwritten photographs, put JPEGs named after the codes in a folder
(`TREE_BLUE.jpg`, `MOON_FISH.jpg`) and run `USER_SCENES=/path/to/folder node run.mjs pass`. `PHOTO=/path/to/site.jpg` also swaps the site
photograph used for the anchor and the generated scenes.

## Running it on your own photographs (true handwriting)

The strongest evidence needs photographs that cannot be simulated. Take these with a phone:

1. **The anchor**: one clear photograph of your construction site from where the builder will stand.
2. **Later shots of the same site** from the same spot (a later stage, another day).
3. **A different site** (any other building).
4. **A code written by hand on the work**: chalk or marker on a wall that is part of the building, large and clear, for example `TREE BLUE` on two lines. Photograph the whole stage with the code in frame.

Then:

```bash
# put the shots in a folder, named after the code on the wall: TREE_BLUE.jpg (right code), MOON_FISH.jpg (a wrong code)
USER_SCENES=/path/to/folder PHOTO=/path/to/anchor.jpg SITE=https://stagehold-cr.vercel.app node run.mjs pass site
```

The harness drives the deployed site exactly as before and records the validators' verdicts, transaction hashes and balances. `PHOTO` is also the picture used for the anchor and the generated scenes.
