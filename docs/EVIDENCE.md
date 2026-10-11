# Stagehold: end-to-end evidence on Studionet

Recorded 2026-10-11 by `evidence/run.mjs` against the deployed frontend **https://stagehold-cr.vercel.app**, in a headless browser, with throwaway accounts. Every transaction below is real and can be opened on the [Studionet explorer](https://explorer-studio.genlayer.com). Payer and builder are made known to Studionet with `sim_fundAccount` (5 and 1 GEN), so every debit and credit is read in the accounts themselves as well as in the contract.

## What was and was not real

| | |
|---|---|
| Frontend | The deployed site, driven like a user: every button click and form field |
| Contract, validators, GenVM, consensus, payouts, refunds | Real, on Studionet. Validators judged the frames; the votes and GenVM results are in `evidence/results/tx/` |
| Photographs | Genuine construction-site photographs from Wikimedia Commons (credits in `fixtures/web2/ATTRIBUTION.csv` and `fixtures/sites/ATTRIBUTION.csv`): a mud house with an iron-sheet roof (the stage flows), and for the site flow the Highland Colour Coaters extension as a steel frame (the anchor) and finished (the later photograph of the same site), plus a different site (a colonial brick house). All pass through the site's own camera and signing code |
| Codes on the wall | **Simulated lettering**: a handwriting-style font with jitter, blur and wear drawn onto the photograph (a dark marker on the white wall of the finished building). It is not a human hand writing on a real wall |
| Camera | A canvas stream of that picture installed as the browser's camera, because a headless browser has no camera |
| Money | Studionet GEN, which has no market value |

True handwritten codes on a photographed wall have not been tried. To run the same flows on your own photographs: `USER_SCENES=/folder node evidence/run.mjs pass site` with JPEGs named after the codes (see `evidence/README.md`). Eleven photographs are also put through the real validators in [PHOTO_TESTS.md](PHOTO_TESTS.md), and the site check is calibrated in [SITE_VERIFICATION.md](SITE_VERIFICATION.md).

## pass: Real-photo flow: wrong code is refused (fee burned), right code passes, builder paid at finality

Job contract: [`0xE1a39029cB484DDb3360bD944BE5a50e28314382`](https://explorer-studio.genlayer.com/address/0xE1a39029cB484DDb3360bD944BE5a50e28314382), payer `0x6743DB02aa2C644d885912AF9FcD2E6FD228eaeF`, builder `0x514320806E80af47F33ed03356F64B3913CdC30a`

| Result | Check | Figures |
|---|---|---|
| pass | job deployed through the frontend | contract=0xE1a39029cB484DDb3360bD944BE5a50e28314382 dev_mode=false capture_attested=false |
| pass | the payer and builder accounts are known to Studionet and funded (payer 5 GEN, builder 1 GEN) | payer account 5 GEN, builder account 1 GEN |
| pass | funding debits the payer's account by exactly the stage amount | account 5 GEN -> 4.5 GEN (expected 4.5 GEN) |
| pass | payer funds 0.5 GEN: escrow holds it | contract balance 0.5 GEN stage funded 0.5 GEN |
| pass | payer issues the code | code=TREE BLUE |
| pass | buying credits debits the builder's account by exactly the credits | account 1 GEN -> 0.9 GEN (expected 0.9 GEN) |
| pass | builder registers a key and buys 0.1 GEN of attempt credits | balance 0.6 GEN keys=1 credits=0.1 GEN |
| pass | the refused attempt's fee is burned: the burn address is credited exactly the fee | account 38.638 GEN -> 38.648 GEN (expected 38.648 GEN) |
| pass | wrong code on the wall: the panel refuses, nothing is paid, the fee is burned | verdict={"stage_met":"yes","code_visible":"no","same_site":"yes","site_aligned":true,"paid":false,"attempt":1} stage=OPEN credits=0.09 GEN contract balance 0.59 GEN |
| pass | right code on the wall: the panel passes the stage; payout waits for finality | verdict={"stage_met":"yes","code_visible":"yes","same_site":"yes","site_aligned":true,"paid":true,"attempt":2} stage=SETTLING |
| pass | at finality the builder's ACCOUNT is credited the stage amount, exactly once | account 0.9 GEN -> 1.4 GEN (expected 1.4 GEN) |
| pass | finality: the contract pays the builder the stage amount, exactly once | job=DONE stage=PAID contract balance 0.08 GEN then 0.08 GEN (0.1 credits - 2 fees = 0.08 GEN) |
| pass | books balance: balance = liabilities, no surplus | {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"} |
| pass | the frontend shows the result and the completed job | builder page text contains the verdict and completion notice |
| pass | all 8 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 contract self-calls triggered (the finalized payouts) reached FINALIZED | SUCCESS |
| pass | 3 outbound value transfers (payouts, refunds, fee burns) finalized as plain sends with no GenVM error | FINALIZED no GenVM run, FINALIZED no GenVM run, FINALIZED no GenVM run; the recipients' account balances above show each one arriving |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x96c8757f…3e3e4c`](https://explorer-studio.genlayer.com/tx/0x96c8757f5708edbef67c221821099ca52c2843ca476e8304ca449c0aae3e3e4c) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| deposit+fund | [`0x7f97dc18…320b9a`](https://explorer-studio.genlayer.com/tx/0x7f97dc189b6240495afa90dba3d70781d6c1c37eddc6af243b89a13787320b9a) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x0e9d3345…1e6aea`](https://explorer-studio.genlayer.com/tx/0x0e9d33450376a6f27268306dc0e4e3916f368f2169bb88263046a6e7de1e6aea) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| issue_code | [`0x18bf0798…1e4b49`](https://explorer-studio.genlayer.com/tx/0x18bf07989ce001e67a0913df885e81241a6379bea883546652f162f3501e4b49) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0xed7e1614…41aef7`](https://explorer-studio.genlayer.com/tx/0xed7e16145ce131b5365834c7d20d0b65884553b31979fc3abf781e0e1141aef7) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0xdf89782a…477918`](https://explorer-studio.genlayer.com/tx/0xdf89782a9d37883c5780268dc920e7207e4389a063591b35bfea93ff43477918) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| submit (wrong code) | [`0xd4383e8f…d7a214`](https://explorer-studio.genlayer.com/tx/0xd4383e8f9cfde56b6f26eaa155c4f31c4ba9671bb1a89176b48f4580d6d7a214) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) | {"stage_met": "yes", "code_visible": "no", "same_site": "yes", "site_aligned": true, "paid": false, "attempt": |
| submit (right code) | [`0x7f806018…0ee53c`](https://explorer-studio.genlayer.com/tx/0x7f806018f6148801e0b4e4470961c51f6114392b09ca0b3121be1747eb0ee53c) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) | {"stage_met": "yes", "code_visible": "yes", "same_site": "yes", "site_aligned": true, "paid": true, "attempt": |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| submit (wrong code) | transfer of 10000000000000000 wei | [`0xf8ea4b06…8713a5`](https://explorer-studio.genlayer.com/tx/0xf8ea4b06b534fd860755a76bef4bd70682f6164a743083e5792b2018d48713a5) | FINALIZED |  |  |
| submit (right code) | transfer of 10000000000000000 wei | [`0x8dcd4dea…f8bab4`](https://explorer-studio.genlayer.com/tx/0x8dcd4dead803519de7503856290999aa82ae0e8ca354abc1849af29491f8bab4) | FINALIZED |  |  |
| submit (right code) | contract call (finalize_stage) | [`0x54f407e7…2ab727`](https://explorer-studio.genlayer.com/tx/0x54f407e7b1b4124ed16b34647f72ec56a1084d08d654be8260b862f8292ab727) | FINALIZED | SUCCESS |  |
| submit (right code) | transfer of 500000000000000000 wei | [`0x5d6b2117…78f786`](https://explorer-studio.genlayer.com/tx/0x5d6b21171219937de54c52ee7e3898f58197dac181abbaf57d9515d05578f786) | FINALIZED |  |  |

Final state: job `DONE`, contract balance 80000000000000000 wei, accounting {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"}.

## cancel: Cancellation needs both parties and refunds the payer; stray funds from a failed transaction are reclaimable

Job contract: [`0xA17FE74CF5a02AE08168032655e35624622D51C1`](https://explorer-studio.genlayer.com/address/0xA17FE74CF5a02AE08168032655e35624622D51C1), payer `0xFC843C9EBa8Fb9cD83B961c663b3339C304EE865`, builder `0x57819DFf66428e28ccC5150E636228b45BBcb8B2`

| Result | Check | Figures |
|---|---|---|
| pass | the payer and builder accounts are known to Studionet and funded (payer 5 GEN, builder 1 GEN) | payer account 5 GEN, builder account 1 GEN |
| pass | setup: 0.5 GEN in escrow, 0.05 GEN of credits | contract balance 0.55 GEN |
| pass | the payer's account was debited the 0.5 GEN | account 5 GEN -> 4.5 GEN (expected 4.5 GEN) |
| pass | the builder's account was debited the 0.05 GEN of credits | account 1 GEN -> 0.95 GEN (expected 0.95 GEN) |
| pass | the builder's account was debited the stray 0.007 GEN | account 0.95 GEN -> 0.943 GEN (expected 0.943 GEN) |
| pass | a failed payable transaction keeps its value, and the contract accounts for it as surplus | contract balance 0.557 GEN surplus 0.007 GEN |
| pass | payer cancelling alone refunds nothing | status=ACTIVE contract balance 0.557 GEN |
| pass | builder cancels too: the job is CANCELLED and the unpaid stage is refunded | status=CANCELLED contract balance 0.057 GEN (credits 0.05 + stray 0.007; the 0.5 GEN left for the payer) |
| pass | the refund reaches the payer's ACCOUNT: the whole 0.5 GEN is back | account 4.5 GEN -> 5 GEN (expected 5 GEN) |
| pass | the frontend shows the stray funds to the payer | notice with the exact amount and a Reclaim button |
| pass | payer reclaims exactly the stray 0.007 GEN; the builder's credits are untouched | contract balance 0.05 GEN surplus 0 |
| pass | the reclaimed stray value reaches the payer's ACCOUNT (0.5 refund + 0.007) | account 5 GEN -> 5.007 GEN (expected 5.007 GEN) |
| pass | builder withdraws the unused credits: the contract ends at exactly 0 | contract balance 0 GEN |
| pass | the withdrawn credits reach the builder's ACCOUNT (only the stray 0.007 GEN is missing) | account 0.943 GEN -> 0.993 GEN (expected 0.993 GEN) |
| pass | all 9 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 3 outbound value transfers (payouts, refunds, fee burns) finalized as plain sends with no GenVM error | FINALIZED no GenVM run, FINALIZED no GenVM run, FINALIZED no GenVM run; the recipients' account balances above show each one arriving |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x746001ee…d84171`](https://explorer-studio.genlayer.com/tx/0x746001eed75b9984c5f9836cbee8cc50b6849db8049c0dccbacaa3a26cd84171) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| deposit+fund | [`0xceed0b5f…d6fd49`](https://explorer-studio.genlayer.com/tx/0xceed0b5f912bc07f816eb600c345411d66b33482ff92c3158b5537abf4d6fd49) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x791a26e6…3ee3ae`](https://explorer-studio.genlayer.com/tx/0x791a26e621d9297f3bdd6d199d0a266fa563e9d8032586bfde2b6114e83ee3ae) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| register+credits | [`0x88805bca…21b25b`](https://explorer-studio.genlayer.com/tx/0x88805bca9a7f2a917db9ebb4af2be67360e9677cb754c5bc7efcbd905c21b25b) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0xa6f75217…4f6a36`](https://explorer-studio.genlayer.com/tx/0xa6f75217d81961e07f855eb967679a640bc32928067b91b4b9885759a74f6a36) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| stray value: builder sends 0.007 GEN to payer-only deposit() | [`0xc344cd20…24c9df`](https://explorer-studio.genlayer.com/tx/0xc344cd2046f943362e4ee687e87f33a6c7db0bc940c45fed9662af96fe24c9df) | FINALIZED MAJORITY_AGREE | ERROR | 5 (agree×3, idle×2) |  |
| payer cancel | [`0x3e102ab2…9f86bc`](https://explorer-studio.genlayer.com/tx/0x3e102ab20b268f50ecbb63ceea0381f7e9dcca93469a34c68cca3ec8db9f86bc) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| builder cancel | [`0xf85d57c4…88aff9`](https://explorer-studio.genlayer.com/tx/0xf85d57c44f8058b60dd73437594104a0238381ad5c42157adad383462e88aff9) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| reclaim_surplus | [`0xb057d372…b6c2b4`](https://explorer-studio.genlayer.com/tx/0xb057d3724c474d4176ba688b84ddf3510fa079d3782229a23141f5350db6c2b4) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| withdraw_credits | [`0x7e50c4ce…85e9bb`](https://explorer-studio.genlayer.com/tx/0x7e50c4cef2c5abd11019ddfbe7541bf82e25fea2c03f3fcb4c091d261585e9bb) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| builder cancel | transfer of 500000000000000000 wei | [`0x565870a8…7fe42e`](https://explorer-studio.genlayer.com/tx/0x565870a8265efda97138b4120efb28023e14d95e58967092889025da217fe42e) | FINALIZED |  |  |
| reclaim_surplus | transfer of 7000000000000000 wei | [`0xbd2fe187…f10b70`](https://explorer-studio.genlayer.com/tx/0xbd2fe1876f5b09d21924f4aa8327adc87d32cb21eff6e1b3ff51f32e5af10b70) | FINALIZED |  |  |
| withdraw_credits | transfer of 50000000000000000 wei | [`0x9b91451c…f51251`](https://explorer-studio.genlayer.com/tx/0x9b91451c9bc8f1368ffee7326219efc42f34c2c85dd4cb53725ce3bc4bf51251) | FINALIZED |  |  |

Final state: job `CANCELLED`, contract balance 0 wei, accounting {"balance":"0","liabilities":"0","surplus":"0"}.

## expire: A job past its deadline can be expired by the payer, who is refunded

Job contract: [`0x59D883610C219e68b55d6577118ab2664B090b8a`](https://explorer-studio.genlayer.com/address/0x59D883610C219e68b55d6577118ab2664B090b8a), payer `0x3919A6c7F2CF169b2395F8Bf05353126e9c425F6`, builder `0xE00e7F4fd445C4b62c2eB15021f5A7e8f88516C9`

| Result | Check | Figures |
|---|---|---|
| pass | the payer and builder accounts are known to Studionet and funded (payer 5 GEN, builder 1 GEN) | payer account 5 GEN, builder account 1 GEN |
| pass | funded: 0.5 GEN in escrow | expires_at=1791757336 |
| pass | the payer's account was debited the 0.5 GEN | account 5 GEN -> 4.5 GEN (expected 4.5 GEN) |
| pass | before the deadline the frontend does not offer Expire | button present=false |
| pass | after the deadline the payer expires the job: status EXPIRED, the full 0.5 GEN leaves the contract | status=EXPIRED contract balance 0 GEN |
| pass | the refund reaches the payer's ACCOUNT: the whole 0.5 GEN is back | account 4.5 GEN -> 5 GEN (expected 5 GEN) |
| pass | all 4 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 outbound value transfers (payouts, refunds, fee burns) finalized as plain sends with no GenVM error | FINALIZED no GenVM run; the recipients' account balances above show each one arriving |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x6acaeeac…6bb573`](https://explorer-studio.genlayer.com/tx/0x6acaeeac6e6a589514f8fa66178495b6c1df51584f67d79038e6729bae6bb573) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x96795a87…75ffd8`](https://explorer-studio.genlayer.com/tx/0x96795a87cd23b06af1b9148228bb6ca45e079ffd875d066a54e54a8d5975ffd8) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0xe43f778c…de6d4f`](https://explorer-studio.genlayer.com/tx/0xe43f778cbbf325ad553ca1b74d8921904c500a4b770c66e907e27b8eebde6d4f) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| expire | [`0xc5e4568d…b55337`](https://explorer-studio.genlayer.com/tx/0xc5e4568dfae16447002df2d8f4d931639f7dd108f8524c76f64c7c65e2b55337) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| expire | transfer of 500000000000000000 wei | [`0x322ec30f…f34394`](https://explorer-studio.genlayer.com/tx/0x322ec30fc9d5debec1fc2f0788ab5bd85e265803f4893fc0fc35566250f34394) | FINALIZED |  |  |

Final state: job `EXPIRED`, contract balance 0 wei, accounting {"balance":"0","liabilities":"0","surplus":"0"}.

## recover: Real-photo flow on a test job: wrong code, right code, payout, and a payout recovery click

Job contract: [`0x0b932E605E1CA27a10cc98fBc4B5b3d4eceDB6F0`](https://explorer-studio.genlayer.com/address/0x0b932E605E1CA27a10cc98fBc4B5b3d4eceDB6F0), payer `0x82AD7EacD1D7eDB683bfCA69c5010f2a07a76A88`, builder `0xF1cc2662F0c4AF1f7925Fd0837Dfb5792E4f7149`

| Result | Check | Figures |
|---|---|---|
| pass | job deployed through the frontend | contract=0x0b932E605E1CA27a10cc98fBc4B5b3d4eceDB6F0 dev_mode=true capture_attested=false |
| pass | the payer and builder accounts are known to Studionet and funded (payer 5 GEN, builder 1 GEN) | payer account 5 GEN, builder account 1 GEN |
| pass | funding debits the payer's account by exactly the stage amount | account 5 GEN -> 4.5 GEN (expected 4.5 GEN) |
| pass | payer funds 0.5 GEN: escrow holds it | contract balance 0.5 GEN stage funded 0.5 GEN |
| pass | payer issues the code | code=TREE BLUE |
| pass | buying credits debits the builder's account by exactly the credits | account 1 GEN -> 0.9 GEN (expected 0.9 GEN) |
| pass | builder registers a key and buys 0.1 GEN of attempt credits | balance 0.6 GEN keys=1 credits=0.1 GEN |
| pass | the refused attempt's fee is burned: the burn address is credited exactly the fee | account 38.658 GEN -> 38.668 GEN (expected 38.668 GEN) |
| pass | wrong code on the wall: the panel refuses, nothing is paid, the fee is burned | verdict={"stage_met":"yes","code_visible":"no","same_site":"yes","site_aligned":true,"paid":false,"attempt":1} stage=OPEN credits=0.09 GEN contract balance 0.59 GEN |
| pass | right code on the wall: the panel passes the stage; payout waits for finality | verdict={"stage_met":"yes","code_visible":"yes","same_site":"yes","site_aligned":true,"paid":true,"attempt":2} stage=SETTLING |
| pass | frontend offers 'Payment is late: recover it' while the stage is SETTLING, and it was clicked | retry of the finalized payout sent through the frontend |
| pass | at finality the builder's ACCOUNT is credited the stage amount, exactly once | account 0.9 GEN -> 1.4 GEN (expected 1.4 GEN) |
| pass | finality: the contract pays the builder the stage amount, exactly once | job=DONE stage=PAID contract balance 0.08 GEN then 0.08 GEN (0.1 credits - 2 fees = 0.08 GEN) |
| pass | books balance: balance = liabilities, no surplus | {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"} |
| pass | the frontend shows the result and the completed job | builder page text contains the verdict and completion notice |
| pass | all 8 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 contract self-calls triggered (the finalized payouts) reached FINALIZED | SUCCESS |
| pass | 3 outbound value transfers (payouts, refunds, fee burns) finalized as plain sends with no GenVM error | FINALIZED no GenVM run, FINALIZED no GenVM run, FINALIZED no GenVM run; the recipients' account balances above show each one arriving |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0xc0812871…10293e`](https://explorer-studio.genlayer.com/tx/0xc08128716d2258477bf4a65fda0de3ad0411ffe211288b13a01864fd3710293e) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x70025aa7…128973`](https://explorer-studio.genlayer.com/tx/0x70025aa7e71df3b4085be5957df6591b745b56e3dc930bf796678bec06128973) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| deposit+fund | [`0x39d13cba…42613e`](https://explorer-studio.genlayer.com/tx/0x39d13cba080013318d7a030af5671bf88939f5075ef0b45c97f20b190742613e) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| issue_code | [`0x7e0d2524…97ca5c`](https://explorer-studio.genlayer.com/tx/0x7e0d25240853bc5be34ef91af6b29149e30dd3847999dc2dc9d1aace2d97ca5c) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×4, idle×1) |  |
| register+credits | [`0x3435d8fa…5e07df`](https://explorer-studio.genlayer.com/tx/0x3435d8fa3f2fe7863a4fe17254bc14cc769a1eeaed6fdaa99621602a745e07df) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| register+credits | [`0xc9ef9789…7ec69c`](https://explorer-studio.genlayer.com/tx/0xc9ef97890f3a242e468d104f2668301d8e81fd502637faf139072ff2907ec69c) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| submit (wrong code) | [`0x2fcc1d16…364803`](https://explorer-studio.genlayer.com/tx/0x2fcc1d16f0d4e52172b85ce9fd5d5c243588b26f07f0cfd78572a298ba364803) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, disagree×1, idle×1) | {"stage_met": "yes", "code_visible": "no", "same_site": "yes", "site_aligned": true, "paid": false, "attempt": |
| submit (right code) | [`0x9bf615e3…fbe116`](https://explorer-studio.genlayer.com/tx/0x9bf615e33317bc4769105045cf92a4d977dbcdced922aadfecd95bfe63fbe116) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) | {"stage_met": "yes", "code_visible": "yes", "same_site": "yes", "site_aligned": true, "paid": true, "attempt": |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| submit (wrong code) | transfer of 10000000000000000 wei | [`0xce72a4cf…366b5a`](https://explorer-studio.genlayer.com/tx/0xce72a4cff8eb83e8c638e5caf7308599b2702245fbce2d709b77a33b8c366b5a) | FINALIZED |  |  |
| submit (right code) | transfer of 10000000000000000 wei | [`0x0b515253…a9f7ed`](https://explorer-studio.genlayer.com/tx/0x0b51525338aa5f1ab4cb7f55411251405b93dc353a130d8cec164f8bc9a9f7ed) | FINALIZED |  |  |
| submit (right code) | contract call (finalize_stage) | [`0x9df035fa…cc84b9`](https://explorer-studio.genlayer.com/tx/0x9df035fa363dd04f1700580de6402d5897e388e2b35be40acdbee747e0cc84b9) | FINALIZED | SUCCESS |  |
| submit (right code) | transfer of 500000000000000000 wei | [`0x61b95de0…374a38`](https://explorer-studio.genlayer.com/tx/0x61b95de021fcbc2f41f3e23dae0204e3852d31092b9029ff3feba81761374a38) | FINALIZED |  |  |

Final state: job `DONE`, contract balance 80000000000000000 wei, accounting {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"}.

## fallback: The payer never issues a code: after the window the builder unlocks a fallback code and is still paid

Job contract: [`0x83FeF930F4E5d7A830D4Dd4A6D9E2B25F659BFa7`](https://explorer-studio.genlayer.com/address/0x83FeF930F4E5d7A830D4Dd4A6D9E2B25F659BFa7), payer `0x3932223AAB21a552Fcc645a21646144e631D3365`, builder `0x2Baf1B2A2D061BE4691829fCA99638BEA4E68D11`

| Result | Check | Figures |
|---|---|---|
| pass | the payer and builder accounts are known to Studionet and funded (payer 5 GEN, builder 1 GEN) | payer account 5 GEN, builder account 1 GEN |
| pass | builder requests a code; the payer stays silent | request_at=1791759219 |
| pass | the fallback button is disabled before the payer window passes | disabled=true |
| pass | after the window the builder unlocks a fallback code | code=FAN DOOR |
| pass | the shot with the fallback code is judged | verdict={"stage_met":"yes","code_visible":"yes","same_site":"yes","site_aligned":true,"paid":true,"attempt":1} |
| pass | the builder's ACCOUNT is credited the stage amount although the payer never acted | account 0.9 GEN -> 1.4 GEN (expected 1.4 GEN) |
| pass | builder is paid although the payer never acted | job=DONE contract balance 0.09 GEN (credits left 0.09 GEN) |
| pass | all 8 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 contract self-calls triggered (the finalized payouts) reached FINALIZED | SUCCESS |
| pass | 2 outbound value transfers (payouts, refunds, fee burns) finalized as plain sends with no GenVM error | FINALIZED no GenVM run, FINALIZED no GenVM run; the recipients' account balances above show each one arriving |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x2910af5d…670304`](https://explorer-studio.genlayer.com/tx/0x2910af5d43e4abd3d7d8506a34ffbbe308924026b5935a7b3d75cfa525670304) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| deposit+fund | [`0x8f3e323b…381649`](https://explorer-studio.genlayer.com/tx/0x8f3e323b879994654d339e26dbcbf86451064ecdb3cd304af508c70456381649) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| deposit+fund | [`0x99bc34ff…c6348a`](https://explorer-studio.genlayer.com/tx/0x99bc34ff54004a164addfd82dd4427ddabb362bddc190d07cf0de37c0ec6348a) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×4, idle×1) |  |
| register+credits | [`0xb0f0a851…d187e9`](https://explorer-studio.genlayer.com/tx/0xb0f0a851d03753a226df6764c2c8056ae35b526b38017f2f8c8c3d547bd187e9) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| register+credits | [`0xb2650bd7…f8244e`](https://explorer-studio.genlayer.com/tx/0xb2650bd748c78bdcfd14c1b631ec251408da83db20633ff30ab9d20ca8f8244e) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| request_code | [`0xd967d908…396e17`](https://explorer-studio.genlayer.com/tx/0xd967d908c8f00caf7f5b8eeabb7264b80f4a3177b445550cd2957e6be0396e17) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| trigger_fallback_code | [`0x027efcd6…ed02b9`](https://explorer-studio.genlayer.com/tx/0x027efcd67a133efdb6efa171a9e7c724db3f5aab7584388101cf84c36ced02b9) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| submit (fallback code) | [`0x9e1020ed…492e6c`](https://explorer-studio.genlayer.com/tx/0x9e1020ed8e821916df8173242ce818682a7436ac7eb4c1585c4dc09f45492e6c) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) | {"stage_met": "yes", "code_visible": "yes", "same_site": "yes", "site_aligned": true, "paid": true, "attempt": |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| submit (fallback code) | transfer of 10000000000000000 wei | [`0xa6473876…94f2ac`](https://explorer-studio.genlayer.com/tx/0xa64738763f0ee6fb9ebd673cd558ac2bc9880e81ce4a9a9f024237166f94f2ac) | FINALIZED |  |  |
| submit (fallback code) | contract call (finalize_stage) | [`0x332feadb…a02c71`](https://explorer-studio.genlayer.com/tx/0x332feadb7b916ffb6c4eb98a8e03066b0a05d71fba0cf84d4fd519cf42a02c71) | FINALIZED | SUCCESS |  |
| submit (fallback code) | transfer of 500000000000000000 wei | [`0xf0b577f4…5290e6`](https://explorer-studio.genlayer.com/tx/0xf0b577f4590f89055a0ac0d81e872743576a6fd81b8fb70cd5aa4b1ff45290e6) | FINALIZED |  |  |

Final state: job `DONE`, contract balance 90000000000000000 wei, accounting {"balance":"90000000000000000","liabilities":"90000000000000000","surplus":"0"}.

## site: Site check: a later photograph of the same site passes; a photograph of a different site is refused by the validators

Job contract: [`0xadF3e0C0AD4B59baEbB770471eC66586862ea17b`](https://explorer-studio.genlayer.com/address/0xadF3e0C0AD4B59baEbB770471eC66586862ea17b), payer `0xd0174058Db94f292Fa6e548832d07b90dAd1B46D`, builder `0xb5Aae5167bF2896C90B7aDe294024422F1d91a38`

| Result | Check | Figures |
|---|---|---|
| pass | the job asks the validators to compare every photograph with the anchor (site check on) | site_check=true alignment_enforced=false |
| pass | the payer and builder accounts are known to Studionet and funded (payer 5 GEN, builder 1 GEN) | payer account 5 GEN, builder account 1 GEN |
| pass | payer funds the openings stage with the steel-frame photograph as the anchor | anchor_kind=jpeg stage=openings funded 0.5 GEN |
| pass | a photograph of a different site, with the right code on its wall: refused for the site, nothing paid, fee burned | verdict={"stage_met":"yes","code_visible":"yes","same_site":"no","site_aligned":true,"paid":false,"attempt":1} stage=OPEN contract balance 0.59 GEN |
| pass | a later photograph of the same site (finished building, same spot): the panel says same site and passes the stage | verdict={"stage_met":"yes","code_visible":"yes","same_site":"yes","site_aligned":true,"paid":true,"attempt":2} stage=SETTLING |
| pass | the builder's ACCOUNT is credited the stage amount, exactly once | account 0.9 GEN -> 1.4 GEN (expected 1.4 GEN) |
| pass | finality: the builder is paid exactly once; books balance | job=DONE contract balance 0.08 GEN accounting={"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"} |
| pass | the frontend shows the site result and the site-check badge | result card has a 'Same site as the anchor' row; the job panel says 'Site check on' |
| pass | all 8 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 contract self-calls triggered (the finalized payouts) reached FINALIZED | SUCCESS |
| pass | 3 outbound value transfers (payouts, refunds, fee burns) finalized as plain sends with no GenVM error | FINALIZED no GenVM run, FINALIZED no GenVM run, FINALIZED no GenVM run; the recipients' account balances above show each one arriving |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x5cf4cef6…53ef9e`](https://explorer-studio.genlayer.com/tx/0x5cf4cef63be946fb021b8428d03257438350606e7a0c49b0e93b5dc96553ef9e) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0xba7bcc15…2bca31`](https://explorer-studio.genlayer.com/tx/0xba7bcc15463bedd53c0b15a3bc67b7cef53fcefb42cb8dd85072cc23d82bca31) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| deposit+fund | [`0x1bb2066a…7887cf`](https://explorer-studio.genlayer.com/tx/0x1bb2066a86d0411f97263174460e5d17db1b7f3211ae85c76b0843bb167887cf) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| issue_code | [`0x7e4ede20…be7042`](https://explorer-studio.genlayer.com/tx/0x7e4ede20c9f50899b7bf89686a1efad68515d392d1eedc5b91642092ebbe7042) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| register+credits | [`0xb323322d…6449a4`](https://explorer-studio.genlayer.com/tx/0xb323322dd5de0690c2ccf53b50c8dd2a488bb558fff52c62f81f124d586449a4) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0x72f8c53e…fbcfe7`](https://explorer-studio.genlayer.com/tx/0x72f8c53e259c6096f48007f37f6c089616b714017388b98f4cb0eeeedafbcfe7) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| submit (different site) | [`0x5c9d406c…5fb643`](https://explorer-studio.genlayer.com/tx/0x5c9d406c3c8974af8bf60a8b9457e3553b1235a999ed2ea89f30d1cecf5fb643) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, disagree×2) | {"stage_met": "yes", "code_visible": "yes", "same_site": "no", "site_aligned": true, "paid": false, "attempt": |
| submit (same site) | [`0xb0e917d8…281de8`](https://explorer-studio.genlayer.com/tx/0xb0e917d8492f950682b4a056af2443c44628633837ad49a08d7555f1ee281de8) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×1, agree×3, disagree×1) | {"stage_met": "yes", "code_visible": "yes", "same_site": "yes", "site_aligned": true, "paid": true, "attempt": |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| submit (different site) | transfer of 10000000000000000 wei | [`0xef387333…dbff07`](https://explorer-studio.genlayer.com/tx/0xef387333b86173c45135aedce24e238494c982d4583f311b1fa61255badbff07) | FINALIZED |  |  |
| submit (same site) | transfer of 10000000000000000 wei | [`0xa3f4c116…7f2bed`](https://explorer-studio.genlayer.com/tx/0xa3f4c1162f498d6b2b45450172e5779dc7c65792cac76639f82840a61c7f2bed) | FINALIZED |  |  |
| submit (same site) | contract call (finalize_stage) | [`0x9fdcd2bd…9312af`](https://explorer-studio.genlayer.com/tx/0x9fdcd2bdc0d534a2a1d29bf9e0b5d002bb79c10ac4881899423ee7930c9312af) | FINALIZED | SUCCESS |  |
| submit (same site) | transfer of 500000000000000000 wei | [`0x50968dd5…84bac4`](https://explorer-studio.genlayer.com/tx/0x50968dd524805243fe7bedc70a6b6205fd8e217ff47cba5273343b318084bac4) | FINALIZED |  |  |

Final state: job `DONE`, contract balance 80000000000000000 wei, accounting {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"}.

## disclosure: A job created without the site check says so on every page, and the result row reads 'Not checked yet'

Job contract: [`0xE26C1fe2Ec98AdFa872fddf1B8b44532d7B6164b`](https://explorer-studio.genlayer.com/address/0xE26C1fe2Ec98AdFa872fddf1B8b44532d7B6164b), payer `0xAa2D85c3fa7b8F424Ee0c7Fd9B05701EE747e50E`, builder `0xFc20954dE2A521E1005F2C31AB56F97b134b158B`

| Result | Check | Figures |
|---|---|---|
| pass | the job was created with the site check off | site_check=false alignment_enforced=false |
| pass | the payer page says the site is not checked | job panel badge 'Site not checked' |
| pass | the builder page says the site is not checked | job panel badge 'Site not checked' on the builder page too |
| pass | all 1 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x017f3c11…1b44e9`](https://explorer-studio.genlayer.com/tx/0x017f3c1153f29bc21155ac7bd10e2961f65e645f46d79ac62491df38a11b44e9) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |

Final state: job `CREATED`, contract balance 0 wei, accounting {"balance":"0","liabilities":"0","surplus":"0"}.

## Notes on the transaction tables

- **Validators (votes):** each transaction was decided by five validators. `agree` is a vote for the leader's result; `idle` is a validator that did not vote in that round, which the protocol tolerates when a majority agrees. A judged `submit` shows the verdict the panel agreed on in the Output column.
- **Status:** `ACCEPTED` is a decision inside the appeal window; `FINALIZED` is final. Payouts fire only after finality.
- **Hashes:** each link opens the transaction in the explorer; the full record of each (consensus data, GenVM result) is in `evidence/results/tx/<hash>.json`.
- The money checks read both the contract's balance and the payer's, builder's and burn address's account balances after each step, against the expected figure.
- **Value transfers** (payouts, refunds, fee burns, reclaims) are plain sends: each is its own transaction of type SEND, finalizes with no GenVM run and no error, and lands only when the transaction that emitted it is FINALIZED. The account checks above show each arriving. (The first version used `emit_transfer`, which ended in a GenVM error and never credited ordinary accounts; see [evidence/transfer_recipients.md](evidence/transfer_recipients.md).)
- **Every transaction made through the frontend, and every contract call it triggered, reached FINALIZED with GenVM SUCCESS**; the harness waits for that and records a check per flow.

The contract-level tests of the thumbnail check, settlement recovery and failed payable transactions are in [evidence/live_hardening.md](evidence/live_hardening.md).

## Summary

84 checks passed, 0 failed, 0 informational.
