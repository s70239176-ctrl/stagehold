# Live hardening tests on Studionet

`contracts/live/live_hardening.mjs` drives the **final** contract directly with throwaway keys on test (`dev_mode`) jobs, whose recovery delays are short (payout retry after 10 s, direct settlement after 45 s, surplus claim 30 s after closing). Amounts are in the test's own units (a fee of 10, credits of 30, a stage of 1000). Payouts and refunds are checked against the contract's own balance, because Studionet does not credit ordinary accounts.

Raw logs: [run A](live_hardening_runA.log) (paths D, E, F, G, H), [run B](live_hardening_runB.log) (path E again, which now also tests the "too early" refusal straight after closing) and [run C](live_hardening_runC.log) (path H again, written to cope with however long the panel takes: it retries only when there is room in the retry window). Earlier runs on earlier versions of the contract are in the git history.

Every transaction that matters reaches FINALIZED with GenVM SUCCESS; a transaction that is *expected* to fail (a refused call, the injected payout fault) is reported as such. Outbound value transfers to ordinary accounts are recorded by Studionet as calls to a contract that does not exist while the contract's balance is debited exactly as checked; see [../EVIDENCE.md](../EVIDENCE.md).

### D. The alignment thumbnail must be a small copy of the judged frame

A correctly signed shot with a thumbnail of the wrong size, and one with a thumbnail of a different scene, are refused before the panel is called; credits, attempts and balance are unchanged. The honest frame with its own thumbnail reaches the panel.

Contract: [`0x2528eF74942Ae5756556E73a7F5b10259937e40f`](https://explorer-studio.genlayer.com/address/0x2528eF74942Ae5756556E73a7F5b10259937e40f)

| Result | Check | Figures |
|---|---|---|
| pass | D thumbnail of the wrong size is refused | ERROR: thumbnail size does not match the frame |
| pass | D thumbnail of a different picture is refused | ERROR: thumbnail does not match the frame |
| pass | D refused shots change nothing: credits, attempts and balance | credits 50->50 attempts=0 balance 1050->1050 |
| pass | D honest frame and its own thumbnail reach the panel | took 47s attempt1={"stage_met": "yes", "code_visible": "yes", "same_site": "off", "site_aligned": true, "paid": true, "attempt": 1} leader=SUCCESS: {"stage_met": "yes", "code_visible": "yes", "same_site": "off", "site |

### E. Value from failed payable transactions

Value sent to a payer-only payable method by the builder, to a builder-only one by a stranger, and to a non-payable method stays in the contract after the transaction errors. The contract reports the amount as surplus; the payer cannot reclaim it while the job is open or straight after closing, a stranger can never, and the payer reclaims exactly the surplus afterwards. Credits are untouched and the contract ends at exactly 0.

Contract: [`0x7Dfe9DbeD7D1fFDb04aBE838D8D72827122D00D5`](https://explorer-studio.genlayer.com/address/0x7Dfe9DbeD7D1fFDb04aBE838D8D72827122D00D5)

| Result | Check | Figures |
|---|---|---|
| pass | E books balance before any stray value | balance=1030 accounting={"balance":"1030","liabilities":"1030","surplus":"0"} |
| pass | E payable call that errors keeps the value, visible as surplus | leader=ERROR: only the payer balance=1807 accounting={"balance":"1807","liabilities":"1030","surplus":"777"} |
| pass | E second failed payable call adds to the surplus | leader=ERROR: only the builder balance=1862 accounting={"balance":"1862","liabilities":"1030","surplus":"832"} |
| pass | E value attached to a non-payable method is also accounted for | leader=ERROR: exit_code 1 balance=1985 accounting={"balance":"1985","liabilities":"1030","surplus":"955"} |
| pass | E surplus cannot be reclaimed while the job is open | ERROR: the job is not closed |
| pass | E reclaim straight after closing is refused as too early | ERROR: too early: wait for pending refunds and payouts to land |
| pass | E both cancelled: stage money refunded, credits and stray value remain | status=CANCELLED balance=985 (credits 30 + stray 955) |
| pass | E reclaim is refused for anyone but the payer | ERROR: only the payer |
| pass | E payer reclaims exactly the stray value; credits untouched | leader=SUCCESS: 955 balance=30 accounting={"balance":"30","liabilities":"30","surplus":"0"} |
| pass | E a second reclaim finds nothing | ERROR: no unaccounted value |
| pass | E builder withdraws credits; contract ends at exactly 0 | balance=0 |

### F. A stuck SETTLING stage: the retry path

After the retry delay anyone re-emits the finalized payout. The original message and the retry both arrive; the builder is paid exactly once and the books balance. The last row shows what the original message did.

Contract: [`0xdB3FB1334B6AaDEd90E14F39f3266540c10F6849`](https://explorer-studio.genlayer.com/address/0xdB3FB1334B6AaDEd90E14F39f3266540c10F6849)

| Result | Check | Figures |
|---|---|---|
| pass | F retry: the panel passes the shot; the stage is SETTLING | took 40s stage=SETTLING settle_at=1791737390 attempt1={"stage_met": "yes", "code_visible": "yes", "same_site": "off", "site_aligned": true, "paid": true, "attempt": 1} |
| pass | F retry: anyone calls recover_settlement on a SETTLING stage (age 33s) | SUCCESS: tpayout retried |
| pass | F retry: builder paid exactly once (only the remaining 20 credits stay; nothing more leaves) | stage=PAID job=DONE balance=20 then 20 (1000 stage + 30 credits - 10 fee - 1000 payout = 20) |
| pass | F retry: recovery on a paid stage is refused | ERROR: stage is not settling |
| pass | F retry: accounting identity holds at the end | {"balance":"20","liabilities":"20","surplus":"0"} |
| info | F retry: the original finalized payout message and what it did | submit FINALIZED; original message(s): FINALIZED SUCCESS |

### G. Direct settlement past the force delay, with a late original payout

Called while the stage was still SETTLING and past the force delay, `recover_settlement` settles it directly and releases the lock. The original finalized message arrives afterwards: the last row shows it was **refused with "stage is not settling for this attempt"** and paid nothing. The builder is paid exactly once.

Contract: [`0xdb9b1Bb6C55428787D9EaBB152a6d424002065A5`](https://explorer-studio.genlayer.com/address/0xdb9b1Bb6C55428787D9EaBB152a6d424002065A5)

| Result | Check | Figures |
|---|---|---|
| pass | F force: the panel passes the shot; the stage is SETTLING | took 55s stage=SETTLING settle_at=1791737705 attempt1={"stage_met": "yes", "code_visible": "yes", "same_site": "off", "site_aligned": true, "paid": true, "attempt": 1} |
| pass | F force: anyone calls recover_settlement on a SETTLING stage (age 48s) | SUCCESS: settled directly |
| pass | F force: builder paid exactly once (only the remaining 20 credits stay; nothing more leaves) | stage=PAID job=DONE balance=20 then 20 (1000 stage + 30 credits - 10 fee - 1000 payout = 20) |
| pass | F force: recovery on a paid stage is refused | ERROR: stage is not settling |
| pass | F force: accounting identity holds at the end | {"balance":"20","liabilities":"20","surplus":"0"} |
| info | F force: the original finalized payout message and what it did | submit FINALIZED; original message(s): FINALIZED ERROR (stage is not settling for this attempt) |

### H. An intentionally failed finalized payout, then forced recovery

The payer of a test job switches the fault injector on (`dev_set_fault`; production jobs refuse it): `finalize_stage` now refuses to pay. The original finalized payout **fails on purpose** and the stage stays SETTLING with its lock set; a retry is emitted and also fails; nothing is paid. Past the force delay `recover_settlement` settles the stage directly even though the payout keeps failing, and the fault is switched off at the same moment. The delayed retried message then arrives and pays nothing. The builder is paid once, the books balance, and every real transaction finalized with GenVM SUCCESS.

Contract: [`0xf2a66A7E1841C3BA3ea1847585591aC40d7CfE2f`](https://explorer-studio.genlayer.com/address/0xf2a66A7E1841C3BA3ea1847585591aC40d7CfE2f)

| Result | Check | Figures |
|---|---|---|
| pass | H the payer switches the fault injector on (test job only) | dev_fault=true dev_mode=true |
| pass | H a production job has no fault injector | ERROR: only test jobs have a fault injector |
| pass | H the panel passes the shot; the stage is SETTLING | took 42s stage=SETTLING settle_at=1791740707 |
| pass | H retry: recover_settlement re-emits the finalized payout | age~32s -> SUCCESS: tpayout retried |
| pass | H the original finalized payout FAILED on purpose and the stage is still SETTLING | original message: ACCEPTED ERROR (injected test fault: the payout is refused); stage=SETTLING; lock=true |
| pass | H nothing was paid while the payout kept failing | contract balance 1020 (1000 stage + 20 credits left) |
| pass | H forced recovery: past the force delay the stage is settled directly, even though the payout keeps failing | age~71s -> SUCCESS: settled directly; stage=PAID job=DONE lock=false |
| pass | H nothing pays twice: any delayed retried payout fails, and the builder was paid once | retried message: FINALIZED ERROR (injected test fault: the payout is refused); builder paid once: contract balance 20 then 20 (1000 stage + 30 credits - 10 fee - 1000 payout = 20) |
| pass | H accounting identity holds at the end | {"balance":"20","liabilities":"20","surplus":"0"} |
| pass | H submit transaction reached FINALIZED with GenVM SUCCESS | 0x96d49166e002ec60e609462580e7d347a25198c3d72b0781639492f01d88d096 |
| pass | H retry transaction reached FINALIZED with GenVM SUCCESS | 0x79d5aad83550ee5a7614accdacd93bff62fb1ae66602381a8796e29db5cddbe5 |
| pass | H forced recovery transaction reached FINALIZED with GenVM SUCCESS | 0x9c5c2f95f4751e547bc7b0cfb1dcaabb44bfed46f556613a732ee34a6e97be8c |

