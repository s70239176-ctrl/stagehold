# Payouts and refunds: the GenVM error, its cause, and the fix

## What went wrong

Stagehold's first payout code used `emit_transfer`, the SDK's way to move native tokens out of a contract. On Studionet every payout, refund and fee burn to an ordinary account then ended in a GenVM error and **never reached the account**:

| Recipient of `emit_transfer` | Recipient's balance | Triggered message |
|---|---|---|
| A contract that accepts transfers (`__receive__`) | credited | GenVM SUCCESS |
| A funded ordinary account | not credited (1 GEN stayed 1 GEN) | NO_MAJORITY, GenVM **ERROR**: `Contract 0x… not found` |
| An unfunded ordinary account | not credited | the same error |
| The same, with `on="accepted"` instead of the default | not credited | the same error |
| A funded payer's refund from Stagehold | not credited (4.9 GEN stayed 4.9 GEN) | the same error |

The contract debited exactly what it owed, so its own books balanced, but the GEN left the contract and arrived nowhere. Reading the SDK from inside GenVM (a probe contract that prints `inspect.getsource`) showed why: `emit_transfer` posts a message **to a contract**. It is documented as a transfer "that the receiver may catch with `__receive__`". An ordinary account has no contract to run, so Studionet records a failed call.

## The fix

The same SDK has a second way to send value: the EVM-style plain send (`EthSend`, exposed as `gl.evm.contract_interface` in newer SDKs and as `genlayer.gl._internal.eth.evm_contract_interface` in the runtime Studionet uses). It sends native tokens to any address with empty calldata and no contract call. Probed in isolation, the same contract paying through it:

| Recipient of the plain send | Recipient's balance | Triggered message |
|---|---|---|
| A funded ordinary account | **1.0 to 1.1 GEN, credited** | type SEND, FINALIZED, no GenVM run |
| An unfunded ordinary account | **0 to 0.1 GEN, credited** | type SEND, FINALIZED, no GenVM run |

It lands only when the transaction that emitted it is FINALIZED (measured: the parent was ACCEPTED for 32 seconds with the recipient at 0, and the recipient was credited when the parent turned FINALIZED), so the "pay only at finality" rule is kept.

`contracts/src/body.py` now pays through it (`_pay`): payouts, refunds, the fee burn and the surplus reclaim all use the plain send. It tries the public name first and falls back to the runtime's.

## Verified in the accounts, on Studionet

`contracts/live/live_accounts.mjs` runs the real contract with a payer (5 GEN) and a builder (1 GEN) made known to Studionet with `sim_fundAccount`, and reads the **accounts**, not just the contract. All passed ([log](live_accounts.log)):

| Step | Result |
|---|---|
| Funding a stage | payer account 5 to 4.5 GEN (debited exactly 0.5) |
| Buying credits | builder account 1 to 0.9 GEN (debited exactly 0.1) |
| A refused attempt | the burn address credited exactly the 0.01 GEN fee |
| The panel passes the right code | at finality the **builder's account 0.9 to 1.4 GEN**: the 0.5 GEN stage payout, once; nothing more afterwards |
| The messages the submit triggered | the payout self-call FINALIZED with GenVM SUCCESS; the transfer FINALIZED, no GenVM run, **no error** |
| Withdrawing the credits | the remaining 0.08 GEN reached the builder's account (1.48 GEN); contract at 0 |
| Cancel by both parties | the **payer's account 4.1 to 4.5 GEN**: the whole 0.4 GEN refund |
| A stray 0.007 GEN left by a failed payable call, then closing and `reclaim_surplus` | the payer's account received the 0.2 GEN refund and the 0.007 GEN reclaimed; contract at 0 |

The through-the-frontend runs in [../EVIDENCE.md](../EVIDENCE.md) now check the payer's and builder's account balances after every financial step in the same way.

## Notes

- Studionet GEN has no market value.
- A plain send to an address that is a contract with no `__receive__` would fail like any transfer to it; Stagehold's recipients are the payer's and the builder's own accounts.
- The probes (`contracts/live/transfer_recipients.mjs`, `probe/`) are kept so the behaviour can be re-checked when the network or SDK changes.
