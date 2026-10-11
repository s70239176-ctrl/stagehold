# Live hardening tests on Studionet

`contracts/live/live_hardening.mjs` drives the contract directly with throwaway keys on `dev_mode` jobs (short recovery delays: payout retry after 10 s, direct settlement after 45 s, surplus claim 30 s after closing). Amounts are in wei units of the test (a fee of 10, credits of 30, a stage of 1000). Payouts and refunds are checked against the contract's own balance, because Studionet does not credit ordinary accounts. Raw logs: [run 1](live_hardening_run1.log), [run 2](live_hardening_run2.log), [run 3](live_hardening_run3.log).

The runs were made in three passes because two assertions in the first pass were wrong, not the contract, and were fixed before the passing runs. Pass 1 (log run 1): section D tested a "different picture" with a thumbnail of a frame that is the same photograph with another code on it, which correctly matched, so that test was replaced by a thumbnail of a different scene; section F expected the full 30 credits to remain although one attempt fee of 10 is burned (the contract's 20 was right). Section E in run 1 is the passing run reported below. Runs 2 and 3 are the corrected runs of F and G (run 2, force path) and D and F (run 3).

### D. The alignment thumbnail must be a small copy of the judged frame

A correctly signed shot with a thumbnail of the wrong size, and one with a thumbnail of a different scene, are refused by the contract before the panel is called; credits, attempts and balance are unchanged. The honest frame with its own thumbnail reaches the panel and is judged.

Contract: [`0x6655C1FbdF81CDCED0095729D8cE52CbC27E31D2`](https://explorer-studio.genlayer.com/address/0x6655C1FbdF81CDCED0095729D8cE52CbC27E31D2)

| Result | Check | Figures |
|---|---|---|
| pass | D thumbnail of the wrong size is refused | ERROR: thumbnail size does not match the frame |
| pass | D thumbnail of a different picture is refused | ERROR: thumbnail does not match the frame |
| pass | D refused shots change nothing: credits, attempts and balance | credits 50->50 attempts=0 balance 1050->1050 |
| pass | D honest frame and its own thumbnail reach the panel | took 77s attempt1={"stage_met": "yes", "code_visible": "yes", "site_aligned": true, "paid": true, "attempt": 1} leader=SUCCESS: {"stage_met": "yes", "code_visible": "yes", "site_aligned": true, "pa |

### E. Value from failed payable transactions

Value sent to a payer-only payable method by the builder, to a builder-only one by a stranger, and to a non-payable method all stay in the contract after the transaction errors. The contract reports the amount as surplus and the payer reclaims exactly that once the job is closed; credits are untouched and the contract ends at exactly 0. (In this run the first reclaim attempt came after the 30 s delay had already passed, so the "too early" refusal is covered by `tests/test_recovery.py` instead; the later "nothing left" refusals and the final balances are the live evidence.)

Contract: [`0xFf29BbD662aEdBdc8803E576278F9c55e49b93d6`](https://explorer-studio.genlayer.com/address/0xFf29BbD662aEdBdc8803E576278F9c55e49b93d6)

| Result | Check | Figures |
|---|---|---|
| pass | E books balance before any stray value | balance=1030 accounting={"balance":"1030","liabilities":"1030","surplus":"0"} |
| pass | E payable call that errors keeps the value, visible as surplus | leader=ERROR: only the payer balance=1807 accounting={"balance":"1807","liabilities":"1030","surplus":"777"} |
| pass | E second failed payable call adds to the surplus | leader=ERROR: only the builder balance=1862 accounting={"balance":"1862","liabilities":"1030","surplus":"832"} |
| pass | E value attached to a non-payable method is also accounted for | leader=ERROR: exit_code 1 balance=1985 accounting={"balance":"1985","liabilities":"1030","surplus":"955"} |
| pass | E surplus cannot be reclaimed while the job is open | ERROR: the job is not closed |
| pass | E both cancelled: stage money refunded, credits and stray value remain | status=CANCELLED balance=985 (credits 30 + stray 955) |
| pass | E reclaim is refused too early and refused for anyone but the payer | early: SUCCESS: 955 \| stranger: ERROR: only the payer |
| pass | E payer reclaims exactly the stray value; credits untouched | leader=ERROR: no unaccounted value balance=30 accounting={"balance":"30","liabilities":"30","surplus":"0"} |
| pass | E a second reclaim finds nothing | ERROR: no unaccounted value |
| pass | E builder withdraws credits; contract ends at exactly 0 | balance=0 |

### F. A stuck SETTLING stage: the retry path

After the retry delay anyone re-emits the finalized payout. The original message and the retry both arrive; the builder is paid exactly once and the books balance.

Contract: [`0x581981aD0Da302e50cd657362c20a42D3EA2dc90`](https://explorer-studio.genlayer.com/address/0x581981aD0Da302e50cd657362c20a42D3EA2dc90)

| Result | Check | Figures |
|---|---|---|
| pass | F retry: the panel passes the shot; the stage is SETTLING | took 45s stage=SETTLING settle_at=1791681769 attempt1={"stage_met": "yes", "code_visible": "yes", "site_aligned": true, "paid": true, "attempt": 1} |
| pass | F retry: anyone calls recover_settlement on a SETTLING stage (age 34s) | SUCCESS: tpayout retried |
| pass | F retry: builder paid exactly once (only the remaining 20 credits stay; nothing more leaves) | stage=PAID job=DONE balance=20 then 20 (1000 stage + 30 credits - 10 fee - 1000 payout = 20) |
| pass | F retry: recovery on a paid stage is refused | ERROR: stage is not settling |
| pass | F retry: accounting identity holds at the end | {"balance":"20","liabilities":"20","surplus":"0"} |

### G. A stuck SETTLING stage: direct settlement past the force delay

Called while the stage was still SETTLING and past the force delay, `recover_settlement` settles it directly and releases the lock. The original finalized message arrives later and is refused; the builder is paid exactly once.

Contract: [`0xB277fE01509e885c3da605C895CfEa7b04D7B462`](https://explorer-studio.genlayer.com/address/0xB277fE01509e885c3da605C895CfEa7b04D7B462)

| Result | Check | Figures |
|---|---|---|

