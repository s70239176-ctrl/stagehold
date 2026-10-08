# Stagehold: Development Plan and Status

**Version:** 1.0 · **Companion documents:** [PRD.md](PRD.md), [TRD.md](TRD.md)

Principles: build and test the judge before the product around it; stop at a gate when it fails; report measured results only; commit after each working checkpoint.

## 1. Repository layout

```
contracts/   stagehold.py (generated), src/ (align.py, body.py), build.py, live/ (Studionet scripts)
study/       judge prompt and stage wording, study harness, blind-set and synthetic-image tools
web/         Next.js app: payer page and builder page
app/         paused Android capture app (draft) and tested offline tools
spikes/      runtime probes and the pure-Python attestation verifier with its tests
tests/       local tests of the contract's pure functions
docs/        PRD, TRD, SDLC
fixtures/    manifests and attribution lists (photographs are fetched, not stored)
```

## 2. Direction

- **Now:** the web version on Studionet. It has no capture authenticity and says so on every page and in the contract.
- **Paused, on the roadmap:** the attested Android capture app. It is a **mainnet gate**: real value moves only in jobs that require an attested key. iOS follows Android.
- **Release order:** web on Studionet, then the real-photo judge study, then attested Android capture, then capped real value in a separate escrow.

## 3. Status by area

| Area | Status |
|---|---|
| Contract | Implemented. The full flow, cancel, expire and the silent-payer fallback have run on Studionet. Failed transactions leave no value stranded. |
| Web app | Builds, typechecks, passes its unit tests. A full job and the cancel, expire and fallback paths ran through the pages in a browser, using a stand-in camera stream. |
| Attestation verifier | 49 desktop tests against Google's published sample chains; runs inside the Studionet runtime, including in write transactions. |
| Android app | Draft only: never compiled or run on a device. Offline tools (`check_package.py`, `submit_package.mjs`, `deploy_job.mjs`) are tested. |
| Judge | Preliminary only (section 4). The gate is open. |
| Site alignment | Implemented, uncalibrated, off by default. |

## 4. Judge study

**Gate 1 is open.** Preliminary results:

- **Panel:** the contract's judges are GenLayer validators. The study ran offline, because the validators' models cannot be chosen here, so it used a single-vendor stand-in (three Claude models, run as independent blind judges). No other model families were used.
- **Web photographs (15 frames, stage-only):** the judges agreed with each other on 12 of 15. Splits occurred only on genuinely borderline frames (cropped or partly hidden roofs). Two frames first labelled "honest" were rejected by the judges and, on inspection, the judges were right. Those labels were changed afterwards, so the result is indicative only.
- **Synthetic edits (16 frames, all text drawn by the authors):** all three judges produced the intended outcome on every class: a correct code passes; a wrong code, no code, a code on a separate sheet, dark and cropped frames do not; an "approve" sign in the frame was not obeyed. Splits occurred only on cropped frames and on code answers in frames whose stage failed anyway, and none changed an outcome. Scoring must use the judges' answer files, not their prose summaries, which can misdescribe them.
- **Not yet tested:** real handwritten codes, real signs, repeated runs, other model families, photographs of real sites, and the stages other than the roof.

Planned gate (proposed thresholds): honest frames pass unanimously in at least 90 percent of runs across at least three model families; every negative class (dark, cropped, wrong stage, wrong subject, sign, no code, wrong code, code on a separate sheet) is refused in at least 95 percent of runs; no model obeys a sign. Wrong-site frames are tested through alignment, not the panel. **Stop** if honest roofs split across models.

## 5. Phases and gates

| Phase | Content | Exit criterion |
|---|---|---|
| 0. Definition | PRD, TRD, SDLC; design decisions recorded | Done |
| 0.5. Runtime feasibility | Probes of crypto, imaging, size limits and money behaviour in the contract runtime | Done for Android sample chains; a real-device chain is outstanding |
| 1. Judge study (gate 1) | Real photographs, several model families, frozen wording | Open |
| 2. Contract (gate 2) | Scripted failures and invariants on Studionet | Passed for the paths listed in the TRD |
| 3. Web client | Payer and builder pages | Done; real camera untested |
| 4. Real wall on Studionet (gate 3) | Payer anchors in person, builder shoots later; two honest frames pay, dark, wrong-angle and sign frames do not | Open. **Stop** if honest shots fail often or the builder would not wait for a real payment |
| 5. Attested Android capture | Compile and run the app; register a real device chain; submit a real signed shot | Open (mainnet gate) |
| 6. Real value | Capped, single template, separate stablecoin escrow that listens for finality; no off-ramp, chat or marketplace | Not started |

## 6. Risks watched in every phase

| Risk | Check |
|---|---|
| Models disagree | Rerun the study after any change to the stage wording or prompt |
| Payment before finality | Invariant tests on every run |
| Deadlock from payer silence | Fallback-code test |
| Image size limits | Encoders guarantee the caps; the contract rejects oversize inputs |
| RPC rate limits | Batched snapshot reads, slow polling, retry on rate-limit and network errors |
| Overclaiming | Report measured results only; keep the capture-authenticity statements |

## 7. Definition of done

- [ ] Gate 1 passed with published study results
- [x] Gate 2: scripted failures and invariants pass on Studionet
- [ ] Gate 3: real-wall trial passed
- [ ] Attested capture verified with a real device
- [ ] The README states the limits: public photographs, offline rehearsal, generated images, no proof of title or materials

## 8. Submission checklist

- [x] App runs locally, build passes, tests pass
- [x] `.env` is not committed; `web/.env.example` exists; no keys in code
- [x] README has summary, contract details, stack, how it works, run steps, demo evidence, limitations, roadmap
- [x] Contract deployed on Studionet and documented (reference deployment in the README; each job deploys its own contract)
- [x] Screenshots added (`docs/screenshots/`)
- [ ] Live link: deploy `web/` on Vercel and add the URL to the README
- [ ] Demo video recorded (script in [DEMO.md](DEMO.md))
- [ ] Real-photo judge study (gate 1) and real-wall trial (gate 3)
