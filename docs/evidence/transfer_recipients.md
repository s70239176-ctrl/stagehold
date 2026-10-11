# Do outbound transfers reach their recipient on Studionet?

Every Stagehold payout, refund and fee burn is an `emit_transfer` from the job contract. The contract debits exactly what it owes; this page records what Studionet then does with the value, because it decides whether "finalized payouts" can be verified at the recipient.

`contracts/live/transfer_recipients.mjs` (with `contracts/live/probe/sender.py` and `sink.py`) deploys a contract that holds a 0.3 GEN deposit and pays 0.1 GEN with the same `emit_transfer` call that Stagehold's `_pay` uses, to three kinds of recipient. Throwaway accounts; an account made known to Studionet with `sim_fundAccount` counts as "funded".

| Recipient | Recipient balance before, after | Sender contract | Triggered message |
|---|---|---|---|
| A contract that accepts transfers (`__receive__`) | 0 GEN to **0.1 GEN: credited** | 0.3 to 0.2 GEN | ACCEPTED, MAJORITY_AGREE, **GenVM SUCCESS** |
| A funded ordinary account | 1 GEN to 1 GEN: **not credited** | 0.2 to 0.1 GEN | FINALIZED, NO_MAJORITY, **GenVM ERROR** |

A second observation, with Stagehold itself on a funded payer: `deposit` of 0.1 GEN debited the payer's account (5 to 4.9 GEN) and credited the job contract, as it should. `withdraw_deposit` then debited the contract (0.1 to 0 GEN), but the payer stayed at 4.9 GEN and the triggered message ended `NO_MAJORITY` / `ERROR`.

An unfunded ordinary account behaves the same way in every Stagehold flow recorded in [../EVIDENCE.md](../EVIDENCE.md): the contract's balance falls by exactly the payout, refund or burn, and the message's GenVM result is `ERROR: Contract 0x… not found`. The unfunded case of this probe did not complete in its last run because the network connection dropped; those flows are the evidence for it.

## What this means

- **The contract's side is correct and verified:** it debits exactly what it owes, once, and a transfer to a contract that accepts transfers is credited with GenVM SUCCESS.
- **On Studionet, GEN paid to an ordinary account is debited from the contract but never credited to the account.** The network treats the transfer as a call to a contract that does not exist. This is why the evidence checks payouts, refunds and burns against the contract's own balance, and why those messages show GenVM ERROR while every call to the contract itself finishes SUCCESS.
- **So the web version's payouts and refunds cannot be shown arriving in a person's account on Studionet.** Nothing in the contract can fix that: a builder and a payer sign with their own keys, so neither can be a contract. A network that credits ordinary accounts is needed to verify arrival at the recipient (Bradbury, Asimov or a local network); that has not been done, and no real value should rely on it until it has.
- The Studionet GEN in all of these tests has no market value.
