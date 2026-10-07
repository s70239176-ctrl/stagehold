# Stagehold

Hold a construction payment until a named stage is visible in a photo, then pay the builder, even if the payer does nothing. A panel of independent GenLayer validators reads the photo; neither the payer nor the builder chose it.

> **Status: a working build on GenLayer Studionet, a development network whose GEN has no market value. Not audited; do not use real value.**
>
> **The web version cannot prove a photo came from a live camera.** A gallery photo or an AI-generated image cannot be told apart from a live frame, and the contract marks every web job `capture_attested: false`. The attested Android capture app is paused and is a **mainnet gate**: real value only moves in jobs that require an attested key.
>
> The judge (the vision panel) has been tried on a small set of web photos and synthetic edits with a Claude-only proxy panel. It has **not** passed a real-photo study with several model families, and that gate is still open.

## What is in this repository

| Path | What it is |
|---|---|
| `contracts/stagehold.py` | The job contract (GenLayer Intelligent Contract). **Generated** by `python contracts/build.py` from `study/prompt.py`, `spikes/attest_verify.py`, `contracts/src/align.py` and `contracts/src/body.py`. |
| `web/` | The Next.js web app: a payer page and a builder page. See `web/README.md`. |
| `study/` | The judge's stage wording and prompt (`prompt.py`) and the judge-study harness. |
| `app/` | The paused Android attested-capture app (draft, uncompiled) and tested offline tools. |
| `spikes/` | Feasibility probes of the contract runtime and the pure-Python attestation verifier. |
| `docs/` | Product requirements, technical requirements (with measured runtime facts and live results) and the development plan and status. |
| `tests/` | Local tests of the contract's pure functions. |
| `contracts/live/` | Scripts that run the contract live on Studionet with throwaway keys. |

## Run the web app locally

```
cd web
npm install
npm run sync-contract      # copies contracts/stagehold.py into web/public/
npm run dev                # http://localhost:3100
```

## Deploy the web app on Vercel

1. Import this repository in Vercel.
2. **Root Directory: `web`** (the app is not at the repository root). Framework preset: Next.js. Defaults for build and install commands are fine.
3. No environment variables are needed. Optional: `NEXT_PUBLIC_GENLAYER_RPC` (defaults to the Studionet RPC) and `NEXT_PUBLIC_EXPLORER_URL`.
4. `web/public/stagehold.py` is committed so the payer page can deploy a job. After any change to the contract, run `python contracts/build.py` and `npm run sync-contract` in `web/`, and commit the result.

The deployed site talks straight to the public GenLayer Studionet RPC from each visitor's browser, using a throwaway account kept in that browser's localStorage. Amounts are in GEN, the network's native token, held and paid by the job contract. The camera needs HTTPS, which Vercel provides.

## Tests

```
python tests/test_pure.py            # contract pure functions (needs: pip install pillow numpy cryptography)
cd web && npm test                   # signature, message and word-list tests
cd web && npx tsc --noEmit && npx next build
genvm-lint check contracts/stagehold.py
```

## Known limits

- No capture authenticity on the web (above).
- Site alignment is implemented but uncalibrated and switched off; pages say "not checked yet".
- Revocation of attestation certificates is not handled; trust roots are fixed at deploy.
- This Studionet does not credit ordinary accounts, so payouts are verified through the contract's own balance.
- The judge gate, real handwritten codes and real photos are untested.

## Credits and licenses

- Photographs used in tests were fetched from Wikimedia Commons (CC BY-SA or public domain); sources and authors are in `fixtures/web/ATTRIBUTION.csv` and `fixtures/web2/ATTRIBUTION.csv`. The photos themselves are not in this repository.
- `spikes/testdata/` holds Google's published Android attestation roots and sample chains from the Apache-2.0 `android/keyattestation` project, used only to test the verifier.
- This repository's own code is MIT licensed (see `LICENSE`). Third-party material keeps its own license, as noted above.
