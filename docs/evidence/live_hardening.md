# Live hardening tests on Studionet

`contracts/live/live_hardening.mjs` drives the **final** contract directly with throwaway keys on test (`dev_mode`) jobs, whose recovery delays are short (payout retry after 10 s, direct settlement after 45 s, surplus claim 30 s after closing). Amounts are in the test's own units (a fee of 10, credits of 30, a stage of 1000). Payouts and refunds are checked against the contract's own balance, because Studionet does not credit ordinary accounts.


Every transaction that matters reaches FINALIZED with GenVM SUCCESS; a transaction that is *expected* to fail (a refused call, the injected payout fault) is reported as such. Outbound transfers are plain sends: they finalize with no GenVM run and no error, and [live_accounts.log](live_accounts.log) and [transfer_recipients.md](transfer_recipients.md) show them arriving in the recipients' accounts. In path H the panel was slow on this run, so the pass was seen after the retry window and the retry step was skipped (path F covers the retry).

### D. The alignment thumbnail must be a small copy of the judged frame

A correctly signed shot with a thumbnail of the wrong size, and one with a thumbnail of a different scene, are refused before the panel is called; credits, attempts and balance are unchanged. The honest frame with its own thumbnail reaches the panel.

Contract: [`0x74aCcE5f393a68420e467705Cb556dDd8D7e4B07`](https://explorer-studio.genlayer.com/address/0x74aCcE5f393a68420e467705Cb556dDd8D7e4B07)

| Result | Check | Figures |
|---|---|---|
| pass | D thumbnail of the wrong size is refused | ERROR: thumbnail size does not match the frame |
| pass | D thumbnail of a different picture is refused | ERROR: thumbnail does not match the frame |
| pass | D refused shots change nothing: credits, attempts and balance | credits 50->50 attempts=0 balance 1050->1050 |
| pass | D honest frame and its own thumbnail reach the panel | took 73s attempt1={"stage_met": "yes", "code_visible": "yes", "same_site": "off", "site_aligned": true, "paid": true, "attempt": 1} leader=SUCCESS: {"stage_met": "yes", "code_visible": "yes", "same_site": "off", "site |

### E. Value from failed payable transactions

Value sent to a payer-only payable method by the builder, to a builder-only one by a stranger, and to a non-payable method stays in the contract after the transaction errors. The contract reports the amount as surplus; the payer cannot reclaim it while the job is open or straight after closing, a stranger can never, and the payer reclaims exactly the surplus afterwards. Credits are untouched and the contract ends at exactly 0.

Contract: [`0x916F808439006a466787C621a2cde67128b10562`](https://explorer-studio.genlayer.com/address/0x916F808439006a466787C621a2cde67128b10562)

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

Contract: [`0x2f72fabb0f3651FfE5F946Fb7c670d1f3FA5a6b5`](https://explorer-studio.genlayer.com/address/0x2f72fabb0f3651FfE5F946Fb7c670d1f3FA5a6b5)

| Result | Check | Figures |
|---|---|---|
| pass | F retry: the panel passes the shot; the stage is SETTLING | took 40s stage=SETTLING settle_at=1791761767 attempt1={"stage_met": "yes", "code_visible": "yes", "same_site": "off", "site_aligned": true, "paid": true, "attempt": 1} |
| pass | F retry: anyone calls recover_settlement on a SETTLING stage (age 33s) | SUCCESS: tpayout retried |
| pass | F retry: builder paid exactly once (only the remaining 20 credits stay; nothing more leaves) | stage=PAID job=DONE balance=20 then 20 (1000 stage + 30 credits - 10 fee - 1000 payout = 20) |
| pass | F retry: recovery on a paid stage is refused | ERROR: stage is not settling |
| pass | F retry: accounting identity holds at the end | {"balance":"20","liabilities":"20","surplus":"0"} |
| info | F retry: the original finalized payout message and what it did | submit FINALIZED; original message(s): FINALIZED SUCCESS |

### G. Direct settlement past the force delay, with a late original payout

Called while the stage was still SETTLING and past the force delay, `recover_settlement` settles it directly and releases the lock. The original finalized message arrives afterwards: the last row shows it was **refused with "stage is not settling for this attempt"** and paid nothing. The builder is paid exactly once.

Contract: [`0xc9124b91dfC63D50c4b238f465F7AEE9C6fd18cE`](https://explorer-studio.genlayer.com/address/0xc9124b91dfC63D50c4b238f465F7AEE9C6fd18cE)

| Result | Check | Figures |
|---|---|---|
| pass | F force: the panel passes the shot; the stage is SETTLING | took 79s stage=SETTLING settle_at=1791762073 attempt1={"stage_met": "yes", "code_visible": "yes", "same_site": "off", "site_aligned": true, "paid": true, "attempt": 1} |
| pass | F force: anyone calls recover_settlement on a SETTLING stage (age 73s) | SUCCESS: settled directly |
| pass | F force: builder paid exactly once (only the remaining 20 credits stay; nothing more leaves) | stage=PAID job=DONE balance=20 then 20 (1000 stage + 30 credits - 10 fee - 1000 payout = 20) |
| pass | F force: recovery on a paid stage is refused | ERROR: stage is not settling |
| pass | F force: accounting identity holds at the end | {"balance":"20","liabilities":"20","surplus":"0"} |
| info | F force: the original finalized payout message and what it did | submit FINALIZED; original message(s): FINALIZED ERROR (stage is not settling for this attempt) |

### H. An intentionally failed finalized payout, then forced recovery

The payer of a test job switches the fault injector on (`dev_set_fault`; production jobs refuse it): `finalize_stage` now refuses to pay. The original finalized payout **fails on purpose** and the stage stays SETTLING with its lock set; a retry is emitted and also fails; nothing is paid. Past the force delay `recover_settlement` settles the stage directly even though the payout keeps failing, and the fault is switched off at the same moment. The delayed retried message then arrives and pays nothing. The builder is paid once, the books balance, and every real transaction finalized with GenVM SUCCESS.

Contract: [`0xCD8954f3599496dba06Bc8C5EA27DC5E3582606B`](https://explorer-studio.genlayer.com/address/0xCD8954f3599496dba06Bc8C5EA27DC5E3582606B)

| Result | Check | Figures |
|---|---|---|
| pass | H the payer switches the fault injector on (test job only) | dev_fault=true dev_mode=true |
| pass | H a production job has no fault injector | ERROR: only test jobs have a fault injector |
| pass | H the panel passes the shot; the stage is SETTLING | took 77s stage=SETTLING settle_at=1791762477 |
| info | H no retry in this run: the panel took long, so the pass was seen at age 69s, past the retry window | the retry path is exercised by path F; this run goes straight to the original payout's failure and the forced recovery |
| pass | H the original finalized payout FAILED on purpose and the stage is still SETTLING | original message: ACCEPTED ERROR (injected test fault: the payout is refused); stage=SETTLING; lock=true |
| pass | H nothing was paid while the payout kept failing | contract balance 1020 (1000 stage + 20 credits left) |
| pass | H forced recovery: past the force delay the stage is settled directly, even though the payout keeps failing | age~107s -> SUCCESS: settled directly; stage=PAID job=DONE lock=false |
| pass | H nothing pays twice: any delayed retried payout fails, and the builder was paid once | retried message: none in this run; builder paid once: contract balance 20 then 20 (1000 stage + 30 credits - 10 fee - 1000 payout = 20) |
| pass | H accounting identity holds at the end | {"balance":"20","liabilities":"20","surplus":"0"} |
| pass | H submit transaction reached FINALIZED with GenVM SUCCESS | 0xae2f5e24aca0f5413403a370170468eea122379867f1b061a5020a7024161c15 |
| pass | H forced recovery transaction reached FINALIZED with GenVM SUCCESS | 0x7a9ebd22abd4874decc12aa7149533515722c51fc1d1471728162c17cbe86ccb |

