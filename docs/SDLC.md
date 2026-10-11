# Stagehold: Development Plan and Status

**Version:** 1.0 · **Companion documents:** [PRD.md](PRD.md), [TRD.md](TRD.md)

Principles: test the judging prompt before the product around it; stop at a gate when it fails; report measured results only; commit after each working checkpoint.

## 1. Repository layout

```
contracts/   stagehold.py (generated), src/ (align.py, body.py), build.py, live/ (Studionet scripts)
study/       judging prompt and stage wording (embedded into the contract)
web/         Next.js app: payer page and builder page
app/         paused Android capture app (draft) and tested offline tools
spikes/      runtime probes and the pure-Python attestation verifier with its tests
tests/       local tests of the contract's pure functions
docs/        PRD, TRD, SDLC
fixtures/    attribution lists for test photographs (the photographs are fetched, not stored)
```

## 2. Direction

- **Now:** the web version on Studionet. It has no capture authenticity and says so on every page and in the contract.
- **Paused, on the roadmap:** the attested Android capture app. It is a **mainnet gate**: real value moves only in jobs that require an attested key. iOS follows Android.
- **Release order:** web on Studionet, then the real-wall trial, then attested Android capture, then capped real value in a separate escrow.

## 3. Status by area

| Area | Status |
|---|---|
| Contract | Implemented. The full flow, cancel, expire and the silent-payer fallback have run on Studionet, and through the deployed frontend ([EVIDENCE.md](EVIDENCE.md)). A thumbnail that is not a copy of the judged frame is refused; a stuck `SETTLING` stage can be recovered; value left by failed transactions is reported and reclaimable ([TRD.md](TRD.md) sections 5.1, 5.2, 6.1). |
| Web app | Builds, typechecks, passes its unit tests. Every flow runs through the deployed pages in a headless browser with a real construction-site photograph and simulated lettering on a stand-in camera stream ([EVIDENCE.md](EVIDENCE.md)). |
| Attestation verifier | 49 desktop tests against Google's published sample chains; runs inside the Studionet runtime, including in write transactions. |
| Android app | Draft only: never compiled or run on a device. Offline tools (`check_package.py`, `submit_package.mjs`, `deploy_job.mjs`) are tested. |
| Judging | Panel verdicts verified on Studionet; real photographs not yet tried (section 4). |
| Site alignment | Implemented, uncalibrated, off by default. The thumbnail it works on is now verified to be a copy of the judged frame. |
| Capture authentication | Not complete: web mode authenticates the bytes, not the camera. Stated as a limitation everywhere; attested capture is a mainnet gate. |

## 4. Judging

The judges are GenLayer validators: the protocol selects the panel for each transaction, and each validator runs its own model. The contract sends a fixed prompt with fixed stage wording (`study/prompt.py`) and accepts only strict JSON; anything else counts as `unclear`. The full flow has run on Studionet with the panel returning a verdict.

**Not yet tried on-chain:** real handwritten codes, real photographs of sites, repeated runs on the same frame. These are covered by the real-wall trial (gate 3). If honest frames split across the validators' models, the panel pays nothing and the stage wording needs work.

## 5. Phases and gates

| Phase | Content | Exit criterion |
|---|---|---|
| 0. Definition | PRD, TRD, SDLC; design decisions recorded | Done |
| 0.5. Runtime feasibility | Probes of crypto, imaging, size limits and money behaviour in the contract runtime | Done for Android sample chains; a real-device chain is outstanding |
| 2. Contract (gate 2) | Scripted failures and invariants on Studionet | Passed for the paths listed in the TRD |
| 3. Web client | Payer and builder pages | Done; real camera untested |
| 4. Real wall on Studionet (gate 3) | Payer anchors in person, builder shoots later; two honest frames pay, dark, wrong-angle and sign frames do not | Open. **Stop** if honest shots fail often or the builder would not wait for a real payment |
| 5. Attested Android capture | Compile and run the app; register a real device chain; submit a real signed shot | Open (mainnet gate) |
| 6. Real value | Capped, single template, separate stablecoin escrow that listens for finality; no off-ramp, chat or marketplace | Not started |

## 6. Risks watched in every phase

| Risk | Check |
|---|---|
| Validators disagree | Re-test on Studionet after any change to the stage wording or prompt |
| Payment before finality | Invariant tests on every run |
| Deadlock from payer silence | Fallback-code test |
| Image size limits | Encoders guarantee the caps; the contract rejects oversize inputs |
| RPC rate limits | Batched snapshot reads, slow polling, retry on rate-limit and network errors |
| Overclaiming | Report measured results only; keep the capture-authenticity statements |

## 7. Response to the steward review

| Request | What was done | Evidence |
|---|---|---|
| Complete and test site verification and capture authentication, or clearly maintain their limitations | Maintained as limitations: web capture cannot prove the camera, and alignment stays off until it can be calibrated on honest and dishonest photographs. Both are stated in the README, the contract snapshot (`capture_attested: false`, `alignment_enforced: false`) and every page | README, TRD sections 8 and 12 |
| Recovery for failed finalized payout calls; no permanent `SETTLING` | `recover_settlement`: retry after a delay, direct settlement after a longer one, all payment paths idempotent | `tests/test_recovery.py`; live runs F and G in [live_hardening.md](evidence/live_hardening.md); the frontend button in the `recover` run of [EVIDENCE.md](EVIDENCE.md) |
| Verify the submitted JPEG and the alignment thumbnail are the same image | A pure-Python reader gets the JPEG's block averages inside GenVM; the contract refuses a thumbnail that differs. The client builds the thumbnail from the encoded JPEG | `tests/test_jpegdc.py`, `tests/test_pure.py`; live run D |
| Test failed payable transactions so attached GEN is not unaccounted for | Surplus accounting and `reclaim_surplus`; failed payable calls were exercised live (payer-only and builder-only payables, a non-payable method) | `tests/test_recovery.py`; live run E; the `cancel` run of [EVIDENCE.md](EVIDENCE.md) |
| Successful end-to-end evidence with real construction photographs and handwritten codes, validator judgments, GenVM execution, finalized payouts, cancellation, expiration, refunds, correct financial changes, through the deployed frontend | Run through the deployed frontend: pass (wrong code refused first), recover, cancel with stray-fund reclaim, expire, silent-payer fallback, each with transaction hashes, votes, GenVM result and balance checks against expected figures. **Codes were simulated lettering on a real construction-site photograph, not a human hand**; a real wall with handwriting remains to be done | [EVIDENCE.md](EVIDENCE.md), `evidence/` |

## 8. Definition of done

- [x] Gate 2: scripted failures and invariants pass on Studionet
- [ ] Gate 3: real-wall trial passed
- [ ] Attested capture verified with a real device
- [ ] The README states the limits: public photographs, offline rehearsal, generated images, no proof of title or materials

## 9. Submission checklist

- [x] App runs locally, build passes, tests pass
- [x] `.env` is not committed; `web/.env.example` exists; no keys in code
- [x] README has summary, contract details, stack, how it works, run steps, demo evidence, limitations, roadmap
- [x] Contract deployed on Studionet and documented (reference deployment in the README; each job deploys its own contract)
- [x] Screenshots added (`docs/screenshots/`)
- [x] Live link: https://stagehold-cr.vercel.app/
- [x] Demo video recorded ([demo/stagehold-demo.mp4](demo/stagehold-demo.mp4), 1 min 50 s with voiceover; script in [DEMO.md](DEMO.md))
- [x] End-to-end evidence through the deployed frontend ([EVIDENCE.md](EVIDENCE.md))
- [ ] Real-wall trial with true handwritten codes (gate 3): needs photographs from a real wall; `evidence/run.mjs` accepts them
