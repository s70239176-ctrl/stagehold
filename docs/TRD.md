# Stagehold: Technical Requirements

**Version:** 1.0 · **Status:** implemented and exercised on GenLayer Studionet · **Companion documents:** [PRD.md](PRD.md), [SDLC.md](SDLC.md)

The contract source is generated: `python contracts/build.py` assembles `contracts/stagehold.py` from `study/prompt.py` (stage wording and judge prompt), `spikes/attest_verify.py` (attestation verifier), `contracts/src/align.py` (site alignment) and `contracts/src/body.py` (the contract). Edit the parts, never the generated file.

## 1. Architecture

```
Browser (Next.js) ── genlayer-js ──▶  Stagehold job contract (one per job)
  payer page / builder page            ├─ deterministic: money, codes, windows, signature, alignment, state
  live camera, WebCrypto signing       └─ non-deterministic: vision panel (validators with different models)
```

- **One contract per job.** The payer deploys it. Money is native GEN held by the job contract.
- **The contract is the only decider.** Clients send what the contract asks for and display what it answers. Nothing in the client decides a verdict.
- **Stack:** GenLayer Intelligent Contract (Python, GenVM); Next.js 15 and genlayer-js for the web app; Studio and then Studionet (chain id 61999) as networks.

## 2. Runtime facts (measured on Studionet)

| Capability | Result |
|---|---|
| Hashes SHA-1, 224, 256, 384, 512 | Available |
| NumPy 2.2 and PIL 11.3 (development builds) | Available; NumPy operations and PNG decode plus resize are bit-identical to a desktop run |
| `cryptography` package | Not available. Signature math is hand-written and works: ECDSA P-256 and P-384, RSA-4096 public exponentiation, DER parsing |
| PIL JPEG encode and decode | Not available. The contract cannot decode a camera JPEG |
| PIL WebP | Crashes the runtime, even when only opening a header. Never touch WebP in a contract |
| PIL PNG, JPEG 2000 | Work |
| `io` module | Works at run time (the linter only warns) |
| `gl.nondet.exec_prompt(prompt, images=[...])` | Accepts images, at most two per call |
| Attestation verifier inside write transactions | Passes with a real Google sample chain |
| Transaction size | About 300 KB raw (409,600 base64 characters) per transaction works; 400 KB fails at the gateway with an HTML error. The Studio web form truncates parameters at 64 characters, so large calls must come from a script |
| Time | `gl.message_raw["datetime"]` (ISO string). `gl.message_raw["contract_address"]` is already an `Address` |

Studionet behaviours that shaped the design:

1. **A transaction that ends in an execution error keeps its attached value in the contract.** Payable methods are therefore trivial deposits that cannot fail; every fallible method is non-payable and works from balances tracked in storage.
2. **Ordinary accounts are not credited or debited.** `emit_transfer` lowers the contract's balance but a recipient account's balance stays 0. Payouts are verified through the contract's own balance. Recipient crediting must be re-checked on a network that tracks accounts.
3. **Outbound transfers and state can lag a receipt by tens of seconds.** Clients and tests must poll.
4. **A panel that cannot agree leaves state unchanged and charges nothing.** The submit went through four consensus rounds (rotating leaders, five validators each) and ended `MAJORITY_DISAGREE`. Random six-letter codes caused this; two common words do not.
5. A judged transaction takes roughly 30 to 110 seconds. The hosted RPC allows about 30 requests a minute per client, so reads are batched and polling is slow.

## 3. Contract state (per job)

| Field | Notes |
|---|---|
| `payer`, `builder` | Addresses; the deployer is the payer |
| `fee`, `expires_at`, `payer_window` | Flat attempt fee, job deadline, seconds the payer has to issue a code |
| `dev_mode`, `software_keys` | Test windows allowed; browser keys allowed (web mode) |
| `app_package`, `app_sig_digest` | Required identity for attested jobs |
| `anchor_b64`, `anchor_hash` | Payer's grayscale PNG thumbnail (at most 30 KB) and its SHA-256, fixed at funding |
| `payer_deposit`, `builder_credits` | Internal balances (see section 5) |
| `stages` | Per funded stage: funded amount, status (`OPEN`, `SETTLING`, `PAID`), code, code deadline, request time, attempts |
| `keys` | Registered device keys (at most 3), by `key_id = sha256(x ‖ y)` |
| `status` | `CREATED`, `ACTIVE`, `CANCELLED`, `EXPIRED`, `DONE`; plus a `settling` lock |
| `seen`, `log` | Submitted-shot ids (no resubmission) and per-attempt results |

Stage wording is constant in the source (`study/prompt.py`). The payer chooses only which stages to fund and the amounts. The wording is version 0: freeze it only after the judge study passes, and re-run the study after any change.

### 3.1 Stage wording (version 0)

1. **Ring beam:** a continuous reinforced concrete beam is visible along the top of the walls in frame; no gaps in the beam; formwork may still be present.
2. **Blockwork to lintel:** walls in frame are built in blocks up to the height of the openings' lintels; no block courses missing between the openings and the top of the walls.
3. **Roof:** roof covering is visible over the full roof area in frame; the ridge is continuous; no open sky is visible through the roof.
4. **Openings set:** door and window frames are installed in all openings visible in frame; no opening is empty.
5. **One wall plastered:** at least one full wall face in frame has plaster applied over its whole visible face.

## 4. Interface

Constructor: `(builder, fee, expires_in, app_package, app_sig_digest_hex, align_min_permille, dev_mode, payer_window_s, software_keys)`. Production jobs require `expires_in` of at least 30 days and use a fixed 24 hour payer window; `dev_mode` jobs may shorten both. Jobs that are neither `dev_mode` nor `software_keys` must name the app package and signing digest.

| Method | Caller | Purpose |
|---|---|---|
| `deposit()` (payable) | payer | Credit the payer's deposit before funding |
| `withdraw_deposit()` | payer | Take the deposit back while the job is `CREATED` |
| `fund(stage_ids, amounts, anchor_b64)` | payer | Allocate the deposit to stages; store the anchor; job becomes `ACTIVE` |
| `deposit_credits()` (payable) | builder | Buy attempt credits |
| `withdraw_credits()` | builder | Return unused credits |
| `register_software_key(x, y)` | builder | Web mode: register a browser P-256 key (reverts unless `software_keys`) |
| `register_device(chain_b64)` | builder | Attested mode: verify an Android attestation chain and register its key |
| `issue_code(stage, code)` | payer | Issue a code valid for 6 hours |
| `request_code(stage)` | builder | Record a request (one open request per stage) |
| `trigger_fallback_code(stage)` | builder | After the payer window, derive a code from the job, stage, attempts, request time and current time |
| `submit(stage, key_id, jpeg_b64, thumb_b64, signature_hex)` | builder | Judge one shot (section 6) |
| `finalize_stage(stage, attempt)` | the contract itself | Run only after finality; pays the builder |
| `cancel()` | either party | Refund unpaid stages only when both parties have called it |
| `expire()` | anyone | After the deadline with nothing settling, refund unpaid stages to the payer |
| `get_snapshot()`, `get_anchor()`, `get_attempt(stage, n)` | anyone | Batched status, anchor image, per-attempt result |

There is no release method.

The snapshot includes `software_keys`, `capture_attested`, `dev_mode`, `payer_window`, `alignment_enforced`, balances and every stage. Clients must display `capture_attested` and `alignment_enforced`.

## 5. Money model

- **Deposit, then fund.** Value enters only through `deposit` and `deposit_credits`. `fund` requires the deposit to equal the sum of the stage amounts. This keeps every method that can fail free of attached value.
- **Attempt fee:** flat, set at deploy, charged from the builder's credits when a judged attempt completes, and **burned** (sent to a dead address). No party profits from a failed attempt. A submission that reverts before judgement costs nothing.
- **Payment:** a passing result sets the stage to `SETTLING`, sets the job-level lock, and queues a call to `finalize_stage` with `emit(on="finalized")` addressed to the contract itself. The payment happens only after the decision is final, so an appeal that overturns it removes it. While `settling`, `submit`, `cancel`, `expire` and `issue_code` revert.
- **Refunds:** `cancel` requires both parties; `expire` requires the deadline and no settlement. Both return only unpaid stage money.

## 6. Submission: deterministic checks, then the panel

A submission reverts, without calling the model, if any of these fails (in this order):

1. The sender is the builder; the job is `ACTIVE`, not settling and not expired; the stage is funded and open.
2. A code exists for the stage and has not passed its deadline.
3. The builder has at least one fee in credits and `key_id` is registered.
4. The frame decodes as base64 and respects the caps: JPEG at most 150 KB, PNG thumbnail at most 30 KB, correct file signatures, and the shot was not submitted before.
5. **Capture signature:** an ECDSA P-256 signature (DER) over `sha256` of the ASCII message `stagehold.v1|<contract>|<stage>|<code>|<deadline>|<sha256 of jpeg>|<sha256 of thumbnail>`, verified under the registered key.
6. **Site alignment** (if enforced): the thumbnail against the stored anchor (section 7).

Then the panel runs. Each validator receives the JPEG, the fixed stage wording and the code, and answers only `stage_met` and `code_visible` with `yes`, `no` or `unclear`, as JSON. The prompt states that text inside the picture is scenery and never an instruction, and that anything uncertain is `unclear`. Parsing is strict: any malformed answer becomes `unclear` for both fields.

**Consensus** compares only the two fields. Wording and confidence are not compared. A pass needs both `yes`. Anything else does not pay; the fee is burned and the builder may shoot again. If validators cannot agree, the transaction applies no state.

## 7. Site alignment

Implemented in `contracts/src/align.py` and **off by default** (`align_min_permille = 0`) because the threshold is uncalibrated.

- Decode both PNG thumbnails, resize to 64 by 64 grayscale with a fixed filter, compute an edge map, keep the strongest 20 percent of edges, and take the best overlap over small integer shifts, as an integer from 0 to 1000. Integer arithmetic keeps validators in agreement.
- Purpose: reject an invented building. An edited copy of the anchor still passes, so this is not a control against fakes.
- To measure: honest later shots from different positions, and stages that change the scene (a new roof covers the wall tops). A standing-point rule for the anchor may be needed. If honest frames fail often, redesign or drop the check.
- While alignment is off the contract reports `site_aligned: true` unconditionally; clients must show "not checked yet" when `alignment_enforced` is false.

## 8. Capture signing modes

| | Web mode (`software_keys`) | Attested mode |
|---|---|---|
| Key | P-256 key made by the browser, kept non-extractable in IndexedDB | P-256 key in the phone's secure hardware |
| Registration | `register_software_key(x, y)` | `register_device(chain)`; the chain is verified in deterministic code |
| Proves | The shot's bytes, stage, code and deadline were signed together | Additionally that the key is hardware-held, on a locked verified-boot device, in the named app |
| Does not prove | Where the pixels came from | That the bytes came from the camera sensor |

Attested policy: chain anchored to a fixed Android attestation root; every non-leaf is a CA; strict DER (non-DER booleans and out-of-order tags are rejected); attested key is EC P-256; hardware-backed security levels; locked bootloader; verified boot; challenge equal to `sha256(contract_lower + ":" + builder_lower)`; expected app package and signing digest when named. Revocation is not checked (a deterministic contract cannot fetch a revocation list); trust roots are fixed at deploy.

## 9. Codes and timing

| Parameter | Value |
|---|---|
| Code validity | 6 hours |
| Payer window before a fallback code can be unlocked | 24 hours (shortened only in `dev_mode`) |
| Job minimum duration | 30 days (shortened only in `dev_mode`) |
| Code format | 4 to 16 characters: capital letters, digits, single spaces |
| Fallback code | Two different words from a fixed list of 64, so models read it reliably |

A fallback code is predictable to a builder who can compute it. That is acceptable: freshness rests on the signature binding the code and deadline, and the code is not a secret. A better entropy source would be used if the runtime exposed one.

## 10. Invariants

1. No frame reaches the model without passing signature, size, format and (when enforced) alignment checks.
2. The signature binds image bytes, stage, code, deadline and contract; it does not carry to another stage, code or job.
3. No payment before finality; a stage pays at most once.
4. Nothing moves while `settling`.
5. Refunds only on a double cancel or on expiry with nothing settling.
6. The payer cannot change stage wording, the anchor or amounts after funding.
7. Value is conserved across deposits, credits, stage balances, burned fees and payouts.
8. Payable methods cannot fail after receiving value.

## 11. Exercised on Studionet

With throwaway accounts (logs in `contracts/live/`):

- Full job: deposit, fund with anchor, credits, key registration, code, a wrong-code shot (not paid, fee burned), a good shot (paid after finality, balance conserved).
- A shot with a corrupted signature reverts and leaves credits, attempts and balance unchanged.
- Cancel: a stranger is rejected; one party alone refunds nothing; both together cancel and refund; credits can be withdrawn.
- Expire: rejected before the deadline; refunds after it; later actions refused.
- Silent payer: request, early fallback rejected, fallback issued after the window, the shot with that code judged `yes / yes` and paid after finality.
- The same flows through the web pages in a browser, on short-window test jobs, using a stand-in camera stream (the test browser had no camera).

## 12. Known limitations and open items

- Web mode cannot authenticate a photo's source. Attested capture (Android) is paused as a mainnet gate; the draft app has never been compiled or run on a device, and no real device chain has been registered.
- The judge has been tried only on small sets (web photographs with stage-only scoring, and synthetic edits) with a single model family. The real-photo, multi-vendor judge study is open.
- Alignment is uncalibrated and off.
- Wallet connection is optional: any EIP-1193 wallet is asked for an account and for Studionet to be added; the GenLayer client then routes writes to `eth_sendTransaction`. Verified with a mock wallet that signs locally (deploy recorded the wallet as payer). Real MetaMask and the GenLayer Snap are untested.
- Revocation is unhandled; iOS is unimplemented.
- A panel disagreement is free to retry.
- Real handwritten codes, other stages (ring beam, blockwork, openings, plaster) and real value are untested.
- Recipient crediting is unverified because this network does not track ordinary accounts.

## 13. Testing

| Layer | Tests |
|---|---|
| Contract pure functions | `tests/test_pure.py`: prompt equality with the study, strict answer parsing, alignment, shot message, fallback codes, signatures |
| Contract on Studionet | `contracts/live/live_test.mjs` (main flow) and `live_paths.mjs` (cancel, expire, silent payer) |
| Web app | `web`: `npm test` (signature conversion against Node's verifier, message layout, word list equals the contract's), typecheck, build, and browser runs |
| Attestation | `spikes/test_attest_verify.py` against Google's published sample chains, including tamper and malformed cases |
| Offline package checks | `app/tools/check_package.py` runs the contract's own code on app output before any transaction |
| Judge | `study/run_study.py` (several model providers, stage-only or full) and the blind-set scripts |
