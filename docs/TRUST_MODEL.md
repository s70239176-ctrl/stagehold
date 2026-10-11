# Stagehold: trust model and limits

What you have to trust, what the contract enforces on its own, and what an attacker can still do. Written for the web version on Studionet. Read it together with [TRD.md](TRD.md) and [SITE_VERIFICATION.md](SITE_VERIFICATION.md).

## Who is trusted for what

| Party | Trusted to | Not trusted to |
|---|---|---|
| **GenLayer validators** (the panel) | Judge, by majority, whether a photograph shows the named stage, the issued code written on the work, and the same place as the anchor. Their models are chosen by the network, not by either party | Be right every time. Models can be wrong or fooled; a split panel records nothing and charges nothing |
| **Payer** | Fund the stages and choose the anchor photograph | Release money: there is no release method. Block payment: a silent payer cannot stop the builder (fallback code) |
| **Builder** | Photograph the work and write the code | Prove the photograph is live (see below) |
| **The contract** | Hold the money and follow its rules | Nothing: its rules are public and testable |
| **Web host (Vercel)** | Serve the page that makes and signs transactions | In sandbox mode the browser keys are throwaway test keys; a compromised host could read them. Use a wallet for anything you care about |
| **Studionet** | Run the contract | Hold value: its GEN has no market value. Payouts and refunds are plain sends and arrive in the recipients' accounts there (verified), but a different network should be re-checked |

## What the contract enforces by itself

- **Money.** Value enters only through `deposit` and `deposit_credits`. A stage pays only on the panel's pass, at finality. Refunds happen only when both parties cancel or the deadline has passed. Balances reconcile exactly (`get_accounting`); stray value from a failed transaction is reported and reclaimable by the payer.
- **No stuck payout.** A passed stage still `SETTLING` can be retried by anyone after a delay and settled directly after a longer one; a late or duplicate payout message pays nothing.
- **The signed shot.** The builder's signature binds the exact JPEG bytes, the stage, the code, its deadline and the contract. The alignment thumbnail is checked to be a small copy of that JPEG.
- **The question asked.** The validators see fixed wording and answer a fixed JSON; anything else counts as `unclear`. A pass needs the stage `yes`, the code `yes` and, when the site check is on, the same site `yes`. Text inside a photograph is treated as scenery.
- **Freshness.** The code is issued per stage, valid six hours, and must be on the work.

## What it does not do, and what an attacker can do with that

1. **The web version does not authenticate the camera.** A browser cannot prove that pixels came from a camera. The page takes frames only from the live camera stream and refuses software cameras and frozen feeds, but a builder who controls their device can feed it anything: a photograph from a gallery, an image from an editor or a generator, a screen. The contract sees valid bytes with a valid signature either way. **A builder can therefore try to pass with a picture that was not taken at the work**, by lettering the code onto it. What stands in the way: the code is only known after the payer issues it (or after the fallback window), it must be legible on the work, the same-site check must say yes against the anchor, and the stage must look complete to a majority of independent models. What does not stand in the way: a determined builder with the real site's photographs and an editor. The fix is attested capture on a phone (Android Key Attestation, implemented in the contract and in an uncompiled app draft), which is a **mainnet gate**: real value moves only in jobs that require an attested key.
2. **The site check stops the wrong place, not a faked picture of the right place.** Calibrated on 26 genuine pairs: no unrelated pair was accepted and most same-site pairs were ([SITE_VERIFICATION.md](SITE_VERIFICATION.md)). It does not stop an edited copy of the anchor or a genuine photograph of the site taken by someone else.
3. **The panel can be wrong.** Majority of five models, a small set of tests, no guarantee. A wrong yes pays a builder; a wrong no or unclear delays one (the attempt fee, 0.01 GEN in the demos, is burned). Prompts are written to fail closed.
4. **The anchor is the payer's choice and public.** A payer could choose an anchor that does not look like the real site, so honest photographs are refused. The builder sees the anchor on-chain before buying credits and can cancel (with the payer) or let the job expire; the builder's credits are withdrawable.
5. **Collusion.** A payer and a builder who agree can pass anything; only their own money is at stake.
6. **The fallback code is predictable** to anyone who can compute it from public job data. That is accepted: freshness rests on the signature and the deadline, not on secrecy.
7. **Test jobs.** A job created as a test job has short windows and a fault injector that lets its payer make the payout fail on purpose, to test recovery. It can only delay a builder (recovery works after 45 seconds), it is labelled on every page, and production jobs have neither.
8. **Real handwriting.** The tests so far use a real construction-site photograph with the code lettered in a handwriting-style font. Photographs of true handwriting on real work have not been run yet.

## Disclosure in the frontend

- **Capture:** every job page and footer says web capture is not device-attested; the job panel shows *Capture not verified*; the builder's camera card repeats it.
- **Site:** *Site check on* or *Site not checked* on every job panel; the builder's result card has a *Same site as the anchor* row (the panel's answer, or *Not checked yet*).
- **Test jobs:** a *test timing* badge.
