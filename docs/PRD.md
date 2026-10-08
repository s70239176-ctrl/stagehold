# Stagehold: Product Requirements

**Version:** 1.0 · **Status:** working build on GenLayer Studionet · **Companion documents:** [TRD.md](TRD.md), [SDLC.md](SDLC.md)

## 1. Summary

Stagehold holds a construction payment until a named stage of the work is visible in a photograph, then pays the builder, even if the payer takes no action. The decision is made by a panel of independent GenLayer validators that neither party chose. A payer-owned or builder-owned inspection app is not a neutral judge, and a normal escrow cannot read a photograph.

## 2. Problem

A person pays in stages for a building they cannot stand in front of. The disputes are ordinary: the roof is on or it is not; the photo is dark; the payer goes quiet after the work is done; or the builder sends a picture of a different site, or a caption or sign in the frame that tells a vision model to answer yes.

- A normal escrow cannot evaluate a phrase such as "ridge continuous".
- A vision service run by either party is not a judge.
- A single known model can be rehearsed against until the picture passes, and text inside the frame can instruct it.

## 3. Users

Two parties, one job.

- **Payer:** has, or can take, one photograph of the real site. Wants to pay only for work that is visibly done.
- **Builder:** is willing to wait for a digital payment instead of needing cash for materials immediately. Wants payment that does not depend on the payer's goodwill.

Intended tranche size: large enough to dispute, small enough that a human inspector is not worth sending (a roof, a gate, one stage of blockwork). Whole buildings, vehicles and machines are out of scope because too much of their condition is hidden from a photograph.

## 4. Why GenLayer

Neither party may be the judge. GenLayer validators run different models, and the protocol selects the panel for each transaction, so neither party's wallet chose it. The payer is protected from a flattering caption, a sign in the frame and a builder-chosen model. The builder is protected from a payer who never approves. Both protections fail if either party can choose the model.

## 5. How a job works

Five stages are fixed in the contract: ring beam, blockwork to lintel, roof, openings set, one wall plastered. The payer chooses which to fund and for how much. **The payer does not write the stage wording; the fixed wording is what the panel judges.**

1. **Anchor.** Before any shot, the payer stores a small grayscale thumbnail of a trusted photograph of the site on-chain, and the contract fixes its hash. The builder never supplies the first reference and never needs the payer to receive it.
2. **Code.** When a stage is ready, a short code is issued, valid for 6 hours. A code is not a secret. The builder can request a code; if the payer has not issued one within 24 hours, the builder can unlock a fallback code, so a silent payer cannot block payment.
3. **Submission.** The builder submits, in one transaction, a frame (a JPEG and a small PNG thumbnail made from the same capture) with a signature over the exact bytes, the stage, the code and the deadline. Before any model runs, the contract checks the signature and the hashes, and aligns the thumbnail to the stored anchor. If a check fails, the transaction reverts and the panel never sees the picture. Links are not accepted, because a link can show one picture to one validator and another to the next.
4. **Panel.** Each validator sees only the frame. Text in the picture is scenery, not an instruction. The panel answers two questions: is the stage fully in frame (`stage_met`), and is the code written on the work itself (`code_visible`). There is no "is this synthetic" question, because honest phone photos fail it and new generators do not.
5. **Pass.** Payment requires `stage_met` yes, `code_visible` yes, a valid signature and an aligned site, and then finality. An answer of `unclear` does not pay. A panel that cannot agree does not pay, and the builder can shoot again.
6. **Cost.** Each judged attempt costs a small flat fee, which is burned so no party profits from a failed attempt. Practising against public models is still free, and the design does not claim otherwise.
7. **No release button.** A passing result queues a payment held until the decision is final. An accepted result can still be appealed. The builder is paid at finality even if the payer is offline. While a payment settles, nothing else on that job can move.
8. **Refund.** Unpaid money is refunded only when both parties cancel, or when the job has expired with nothing settling.

## 6. What a photograph does not prove

Title to the land, materials used, or what is inside a wall. The photograph is a way to release the next payment without either party owning the decision.

## 7. Capture authenticity and generated images

A generated image is a file. A real defense is to refuse any file that did not come out of an attested camera app after the code existed.

- **Web mode (current):** a browser cannot sign inside secure hardware. The builder page takes a live camera frame (no file picker) and signs it with a browser-made key. That key binds the shot to its stage, code, deadline and bytes, but it cannot distinguish a live frame from a generated or gallery image. Every web job says so: the contract exposes `capture_attested: false`, and every page shows a permanent banner. Web jobs are for Studionet and low-stakes pilots only.
- **Attested mode (roadmap, mainnet gate):** an Android capture app generates a hardware-backed key whose attestation chain the contract verifies. A draft app and offline tools exist and are paused. Real value moves only in jobs that require an attested key. iOS follows Android.
- **Not closed even with attestation:** a genuine camera pointed at a screen or a print, and a rooted or hooked device feeding the app a fake image.
- **Deterministic site alignment** (image libraries in the contract runtime, comparing the frame's thumbnail with the stored anchor) removes the lazy fake, such as a house invented from scratch. An edited copy of the anchor still passes it, so it is not the control. It is implemented but uncalibrated and switched off by default; pages show "not checked yet" while it is off.
- **Claim rule:** until a real attested capture has passed on a test network, no claim of protection against generated images may be made. A prompt that says "reject AI" is not a substitute for attestation.
- **Optional, pilot-gated:** a flash and no-flash pair of the same shot checked for flash falloff across a real surface, which rejects some honest noon shots. Another option is a sticker that the anchor places and the shot must show peeled or folded.

## 8. Scope and release order

1. A real-wall trial with real photographs and handwritten codes, before any real value (see SDLC).
2. One contract per job, in the network's native token, with the five fixed stage definitions.
3. Scripted failure tests before relying on any screen.
4. Two mobile web pages (payer and builder).
5. One real wall on Studionet.
6. Attested Android capture.
7. Last: real value, capped, with a single template, in a separate escrow that listens for finality.

**Out of scope:** off-ramps, chat, a marketplace, custom stage text (it may return only if the builder accepts that exact text on-chain first), whole-building projects, vehicles and machines, proof of title or materials, video, GPS or EXIF proofs.

## 9. Clients

- **Payer page:** create the job, fund a stage and store the anchor, issue a code, cancel, expire, see status.
- **Builder page:** register a browser key, add attempt credits, request or unlock a code, take a live frame, submit, cancel, withdraw unused credits.
- Both show three results and never the model's explanation: stage complete, code visible on the work, same site as the anchor.
- A clearly labelled **test job** option shortens the fallback window and the expiry so those paths can be exercised.

## 10. Success criteria

- Honest frames pay; dark frames, wrong angles, wrong buildings and an instruction sign do not.
- Payment never moves before finality, and nothing else on a job moves while a payment settles.
- A builder is paid when the payer is offline.
- A real-wall trial on Studionet passes, and the builder reports that they would have waited for a real payment.

## 11. Stop conditions

- **Real-wall trial:** if honest frames split across the validators' models, stop. A contract cannot create agreement that the models do not have.
- **Real-wall trial:** if honest shots fail often, or the builder would not have waited for a real payment, stop.

## 12. Risks and limitations

| Risk | Handling |
|---|---|
| Models disagree on honest frames | Real-wall trial first; stop condition. A split panel pays nothing. |
| A builder retries freely when the panel disagrees | A disagreement applies no state and charges nothing; only agreed answers burn the fee. Accepted for now. |
| Site alignment unreliable across time, angle and a changing scene | Measure on real frames before enforcing; consider a standing-point protocol for the anchor. |
| Offline rehearsal against public models | Stated plainly; fee on live attempts; fresh codes. |
| Generated or gallery image in web mode | Not defended; stated on every page and in the contract. |
| Camera pointed at a screen or print | Not closed; optional flash check only if a pilot shows it matters. |
| Rooted or hooked device in attested mode | Attestation policy (boot state, security level, app identity) narrows it; residual risk stated. |
| Payer silence blocks a code | Builder-triggered fallback code after the payer window. |
| Photographs are public on-chain | The anchor is a small grayscale thumbnail; use non-sensitive sites only. |
| Certificate revocation not handled | Trust roots are fixed at deploy; a consensus-checked revocation fetch is a later option. |
| This test network does not credit ordinary accounts | Payouts are verified through the contract's own balance; re-check on a network that tracks accounts. |
