# Stagehold: Development Plan and Status

**Version:** 1.2 · **Companion documents:** [PRD.md](PRD.md), [TRD.md](TRD.md), [TRUST_MODEL.md](TRUST_MODEL.md)

Principles: test the judging prompt before the product around it; stop at a gate when it fails; report measured results only; commit after each working checkpoint.

## 1. Repository layout

```
contracts/   stagehold.py (generated), src/ (body.py, jpegdc.py, align.py), build.py, live/ (Studionet test scripts)
study/       judging prompt, stage wording and the same-site question (embedded into the contract)
web/         Next.js app: landing page, payer page, builder page, camera check
evidence/    harness that drives the deployed site in a headless browser and records evidence
calibration/ the 26 photograph pairs and the eleven photograph cases, with their results
app/         paused Android capture app (draft) and tested offline tools
spikes/      runtime probes and the pure-Python attestation verifier with its tests
tests/       in-process tests of the contract (pure functions, JPEG reader, money paths)
docs/        PRD, TRD, SDLC, trust model, evidence, site verification, photograph tests, demo guide
fixtures/    attribution lists for the test photographs (the photographs are fetched, not stored)
```

## 2. Direction

- **Now:** the web version on Studionet. It has no capture authenticity and says so on every page and in the contract.
- **Paused, on the roadmap:** the attested Android capture app. It is a **mainnet gate**: real value moves only in jobs that require an attested key. iOS follows Android.
- **Release order:** web on Studionet, then a real-wall trial with true handwriting, then attested Android capture, then capped real value in a separate escrow.

## 3. Status by area

| Area | Status |
|---|---|
| Contract | Implemented and exercised on Studionet: the full flow, cancel, expire, the silent-payer fallback, the thumbnail check, payout recovery, surplus reclaim, the site check. Payouts, refunds, burns and reclaims are plain sends and were verified arriving in the recipients' accounts ([evidence/transfer_recipients.md](evidence/transfer_recipients.md)) |
| Web app | Builds, typechecks, 18 unit tests. Every flow runs through the deployed pages in a headless browser on genuine photographs with simulated lettering on a stand-in camera stream ([EVIDENCE.md](EVIDENCE.md)) |
| Site verification | The validators compare each frame with the payer's anchor (on by default on web jobs); calibrated on 26 genuine pairs ([SITE_VERIFICATION.md](SITE_VERIFICATION.md)). The deterministic alignment cannot separate sites and stays off |
| Judging | Real validators judged eleven genuine photographs, ten as expected ([PHOTO_TESTS.md](PHOTO_TESTS.md)); true handwriting on a real wall is untried |
| Capture authentication | Not complete: web mode authenticates the bytes, not the camera. Stated as a limitation everywhere ([TRUST_MODEL.md](TRUST_MODEL.md)); attested capture is a mainnet gate |
| Attestation verifier | 49 desktop tests against Google's published sample chains; runs inside the Studionet runtime, including in write transactions |
| Android app | Draft only: never compiled or run on a device. Offline tools (`check_package.py`, `submit_package.mjs`, `deploy_job.mjs`) are tested |
| Tests | `tests/`: 45 + 39 + 16 in-process checks; `web`: 18; live scripts in `contracts/live/` |

## 4. Judging

The judges are GenLayer validators: the protocol selects the panel for each transaction, and each validator runs its own model. The contract sends fixed prompts with fixed wording (`study/prompt.py`) and accepts only strict JSON; anything else counts as `unclear`. Questions: the stage, the code and, with the site check on, whether the frame shows the same place as the anchor.

**Not yet tried on-chain:** true handwritten codes on a real wall. If honest frames split across the validators' models, the panel pays nothing and the wording needs work.

## 5. Phases and gates

| Phase | Content | Exit criterion |
|---|---|---|
| 0. Definition | PRD, TRD, SDLC; design decisions recorded | Done |
| 0.5. Runtime feasibility | Probes of crypto, imaging, size limits and money behaviour in the contract runtime | Done for Android sample chains; a real-device chain is outstanding |
| 2. Contract (gate 2) | Scripted failures and invariants on Studionet | Passed for the paths listed in the TRD |
| 3. Web client | Landing, payer, builder and camera pages | Done; real camera untested |
| 3.5. Hardening and evidence | Thumbnail check, payout recovery, surplus, site check, plain-send payouts; evidence through the deployed site | Done ([EVIDENCE.md](EVIDENCE.md), [evidence/live_hardening.md](evidence/live_hardening.md)) |
| 4. Real wall on Studionet (gate 3) | Payer anchors in person, builder writes the code by hand and shoots later; honest frames pay, dark, wrong-site and sign frames do not | Open. Needs photographs from a real wall; `evidence/run.mjs` and `calibration/` accept them. **Stop** if honest shots fail often or the builder would not wait for a real payment |
| 5. Attested Android capture | Compile and run the app; register a real device chain; submit a real signed shot | Open (mainnet gate) |
| 6. Real value | Capped, single template, separate stablecoin escrow that listens for finality; no off-ramp, chat or marketplace | Not started. Re-check payouts on the target network first |

## 6. Risks watched in every phase

| Risk | Check |
|---|---|
| Validators disagree | Re-test on Studionet after any change to the wording or prompts |
| Payment before finality | Invariant tests on every run; plain sends land only when the emitting transaction is FINALIZED |
| Payout that does not land | `recover_settlement`; tests in process and live |
| Deadlock from payer silence | Fallback-code test |
| Value that does not arrive | Account-level checks after every financial step (`contracts/live/live_accounts.mjs`, the evidence harness) |
| Image size limits | Encoders guarantee the caps; the contract rejects oversize inputs |
| RPC rate limits (30 a minute, 500 an hour) | Batched snapshot reads, slow polling, parked idle pages, retry on rate-limit and network errors |
| Overclaiming | Report measured results only; keep the capture-authenticity statements |

## 7. Steward review history

### 7.1 First review

| Request | What was done | Evidence |
|---|---|---|
| Complete and test site verification and capture authentication, or clearly maintain their limitations | Capture authentication is maintained as a limitation. Site verification was later completed (see 7.2) | [TRUST_MODEL.md](TRUST_MODEL.md), [SITE_VERIFICATION.md](SITE_VERIFICATION.md) |
| Recovery for failed finalized payout calls; no permanent `SETTLING` | `recover_settlement`: retry after a delay, direct settlement after a longer one, all payment paths idempotent | `tests/test_recovery.py`; paths F and G in [evidence/live_hardening.md](evidence/live_hardening.md); the frontend button in the `recover` flow of [EVIDENCE.md](EVIDENCE.md) |
| Verify the submitted JPEG and the alignment thumbnail are the same image | A pure-Python reader gets the JPEG's block averages inside GenVM; the contract refuses a thumbnail that differs; the client builds the thumbnail from the encoded JPEG | `tests/test_jpegdc.py`, `tests/test_pure.py`; path D |
| Test failed payable transactions so attached GEN is not unaccounted for | Surplus accounting and `reclaim_surplus`; failed payable calls exercised live | `tests/test_recovery.py`; path E; the `cancel` flow of [EVIDENCE.md](EVIDENCE.md) |
| End-to-end evidence through the deployed frontend | The flows run through the deployed site with votes, GenVM results and balance checks | [EVIDENCE.md](EVIDENCE.md), `evidence/` |

### 7.2 Second review

| Request | What was done | Evidence |
|---|---|---|
| Calibrate and test the alignment mechanism with genuine photographs from matching and unrelated sites | The deterministic alignment was calibrated on 26 genuine pairs (12 same site, 14 unrelated): AUC 0.57, it cannot separate them, so it stays off. A panel-based same-site question was added and calibrated on the same pairs, asked twice with real validators: 0 of 28 unrelated answers accepted, 18 of 24 same-site answers accepted | [SITE_VERIFICATION.md](SITE_VERIFICATION.md), `calibration/`; `contracts/live/live_site.mjs`; the `site` flow in [EVIDENCE.md](EVIDENCE.md) |
| Keep the frontend disclosing when site verification is not enforced | **Site check on** / **Site not checked** on every job panel; the result row reads the validators' answer or *Not checked yet*; the `disclosure` flow shows a job without the check saying so | [EVIDENCE.md](EVIDENCE.md) (`disclosure`) |
| More realistic photographic tests; clarify the trust limits | Eleven genuine photographs through the real validators with expectations set beforehand; the site pairs; every frontend flow on a genuine photograph. Codes are simulated lettering, stated everywhere; the harnesses accept the user's own handwritten photographs. The trust limits are written out party by party | [PHOTO_TESTS.md](PHOTO_TESTS.md), [TRUST_MODEL.md](TRUST_MODEL.md) |
| Demonstrate forced recovery after an intentionally failed finalized payout, and that a delayed original payout cannot settle twice | A test-job-only fault injector (`dev_set_fault`) makes the payout fail on purpose; the original fails, past the force delay the stage is settled directly, the builder is paid once. Without the injector, the late original payout was captured being refused | paths G and H of [evidence/live_hardening.md](evidence/live_hardening.md); `tests/test_recovery.py` |
| Every relevant transaction finalizes with GenVM success; balances correct | The harness waits until every transaction and every message it triggered is FINALIZED and checks the GenVM result | [EVIDENCE.md](EVIDENCE.md) |

### 7.3 Payout error

Payouts, refunds and fee burns ended in a GenVM error ("Contract … not found") and never reached ordinary accounts, because `emit_transfer` only reaches contracts. The contract now pays with the SDK's plain send. Payout, refund, burn, credit withdrawal and surplus reclaim were verified arriving in the recipients' accounts, directly against the contract and through the deployed site ([evidence/transfer_recipients.md](evidence/transfer_recipients.md), [EVIDENCE.md](EVIDENCE.md)).

## 8. Definition of done

- [x] Gate 2: scripted failures and invariants pass on Studionet
- [x] End-to-end evidence through the deployed frontend, with account balances ([EVIDENCE.md](EVIDENCE.md))
- [x] Site verification calibrated on genuine photographs ([SITE_VERIFICATION.md](SITE_VERIFICATION.md))
- [ ] Gate 3: real-wall trial with true handwritten codes
- [ ] Attested capture verified with a real device
- [x] The README states the limits: public photographs, generated images, unauthenticated capture, no proof of title or materials

## 9. Submission checklist

- [x] App runs locally, build passes, tests pass
- [x] `.env` is not committed; `web/.env.example` exists; no keys in code
- [x] README has summary, contract details, stack, how it works, run steps, demo evidence, limitations, roadmap
- [x] Contract deployed on Studionet and documented (reference deployment in the README; each job deploys its own contract)
- [x] Screenshots added (`docs/screenshots/`)
- [x] Live link: https://stagehold-cr.vercel.app/
- [x] Demo video ([YouTube](https://youtu.be/kOrpqyhMxDE), also [demo/stagehold-demo.mp4](demo/stagehold-demo.mp4); it was recorded before the site check and the payout fix, and shows the same flow)
- [ ] Real-wall trial with true handwritten codes (gate 3)
