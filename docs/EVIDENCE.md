# Stagehold: end-to-end evidence on Studionet

Recorded 2026-10-11 by `evidence/run.mjs` against the deployed frontend **https://stagehold-cr.vercel.app**, in a headless browser, with throwaway accounts. Every transaction below is real and can be opened on the [Studionet explorer](https://explorer-studio.genlayer.com). The money checks compare the contract's own balance with the expected figure after each step, because this network does not credit ordinary accounts.

## What was and was not real

| | |
|---|---|
| Frontend | The deployed site, driven like a user: every button click and form field |
| Contract, validators, GenVM, consensus, payouts, refunds | Real, on Studionet. Validators judged the frames; the votes and GenVM results are in `evidence/results/tx/` |
| Photograph | A real construction-site photograph (Wikimedia Commons, CC BY-SA 4.0; credits in `fixtures/web2/ATTRIBUTION.csv`) |
| Codes on the wall | **Simulated lettering**: a handwriting-style font with jitter, blur and wear drawn onto the photograph. It is not a human hand writing on a real wall |
| Camera | A canvas stream of that picture installed as the browser's camera, because a headless browser has no camera |
| Money | Studionet GEN, which has no market value |

True handwritten codes on a photographed wall have not been tried. To run the same flows on your own photographs: `USER_SCENES=/folder node evidence/run.mjs pass` with JPEGs named after the codes (see `evidence/README.md`).

## pass: Real-photo flow: wrong code is refused (fee burned), right code passes, builder paid at finality

Job contract: [`0xFd14458AE0fD0CAd05d6020a2fcd81EDe293D75B`](https://explorer-studio.genlayer.com/address/0xFd14458AE0fD0CAd05d6020a2fcd81EDe293D75B), payer `0xE01f34EC912177F10fA41bbfc9815e8bB76F9A18`, builder `0xeFbB2a09CDCE4387D30C5ADDb4fB7EC832c7aC88`

| Result | Check | Figures |
|---|---|---|
| pass | job deployed through the frontend | contract=0xFd14458AE0fD0CAd05d6020a2fcd81EDe293D75B dev_mode=false capture_attested=false |
| pass | payer funds 0.5 GEN: escrow holds it | contract balance 0.5 GEN stage funded 0.5 GEN |
| pass | payer issues the code | code=TREE BLUE |
| pass | builder registers a key and buys 0.1 GEN of attempt credits | balance 0.6 GEN keys=1 credits=0.1 GEN |
| pass | wrong code on the wall: the panel refuses, nothing is paid, the fee is burned | verdict={"stage_met":"yes","code_visible":"no","site_aligned":true,"paid":false,"attempt":1} stage=OPEN credits=0.09 GEN contract balance 0.59 GEN |
| pass | right code on the wall: the panel passes the stage; payout waits for finality | verdict={"stage_met":"yes","code_visible":"yes","site_aligned":true,"paid":true,"attempt":2} stage=SETTLING |
| pass | finality: the contract pays the builder the stage amount, exactly once | job=DONE stage=PAID contract balance 0.08 GEN then 0.08 GEN (0.1 credits - 2 fees = 0.08 GEN) |
| pass | books balance: balance = liabilities, no surplus | {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"} |
| pass | the frontend shows the result and the completed job | builder page text contains the verdict and completion notice |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x88eb3887…d9a177`](https://explorer-studio.genlayer.com/tx/0x88eb3887b54df1a13e9c94296e6d782f52b652cb76533591792a357885d9a177) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x06d814c1…83dadf`](https://explorer-studio.genlayer.com/tx/0x06d814c10c3de7d3efd3d6f9ea54097129f3770ea3ca61b2186c9092bb83dadf) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| deposit+fund | [`0xd93544bc…77351e`](https://explorer-studio.genlayer.com/tx/0xd93544bce6a8952b2c7fd3c57558fb2d7a70706eb433fae144ec732bf177351e) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| issue_code | [`0xd69d2d3e…641eed`](https://explorer-studio.genlayer.com/tx/0xd69d2d3e9d07cca96fa6e5ffca213142331a7717143026b7b22d07ad61641eed) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×1, agree×4) |  |
| register+credits | [`0x9ae4fed4…7c20ba`](https://explorer-studio.genlayer.com/tx/0x9ae4fed4b04f4733feb006d7d87c436c31f2b9774cf53524781520d9157c20ba) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| register+credits | [`0x28c5287d…0c1bb2`](https://explorer-studio.genlayer.com/tx/0x28c5287d174804bc32877ecc7e2bc7cfd102df31a5d8b53051f28498ff0c1bb2) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| submit (wrong code) | [`0xb59fa909…4fa24d`](https://explorer-studio.genlayer.com/tx/0xb59fa909d1e4675d5428ac0cf03d84ca76c532d3e3e84b5f8c1a80cdca4fa24d) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) | {"stage_met": "yes", "code_visible": "no", "site_aligned": true, "paid": false, "attempt": 1} |
| submit (right code) | [`0x34191478…a90ddd`](https://explorer-studio.genlayer.com/tx/0x34191478f00e0128c4a971c135fb4ce09d8e1a7ed3a1daa47909edb435a90ddd) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) | {"stage_met": "yes", "code_visible": "yes", "site_aligned": true, "paid": true, "attempt": 2} |

Final state: job `DONE`, contract balance 80000000000000000 wei, accounting {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"}.

## recover: Real-photo flow on a test job: wrong code, right code, payout, and a payout recovery click

Job contract: [`0xEA40f54C78B487e6eb9A9dce06Dea5c6A892E155`](https://explorer-studio.genlayer.com/address/0xEA40f54C78B487e6eb9A9dce06Dea5c6A892E155), payer `0x8e57460DcB0F5f5C5c26b79f03Ad995a6B72359F`, builder `0x25b6F771f779147872d65A51D81feD351fbeaB9D`

| Result | Check | Figures |
|---|---|---|
| pass | job deployed through the frontend | contract=0xEA40f54C78B487e6eb9A9dce06Dea5c6A892E155 dev_mode=true capture_attested=false |
| pass | payer funds 0.5 GEN: escrow holds it | contract balance 0.5 GEN stage funded 0.5 GEN |
| pass | payer issues the code | code=TREE BLUE |
| pass | builder registers a key and buys 0.1 GEN of attempt credits | balance 0.6 GEN keys=1 credits=0.1 GEN |
| pass | wrong code on the wall: the panel refuses, nothing is paid, the fee is burned | verdict={"stage_met":"yes","code_visible":"no","site_aligned":true,"paid":false,"attempt":1} stage=OPEN credits=0.09 GEN contract balance 0.59 GEN |
| pass | right code on the wall: the panel passes the stage; payout waits for finality | verdict={"stage_met":"yes","code_visible":"yes","site_aligned":true,"paid":true,"attempt":2} stage=SETTLING |
| pass | frontend offers 'Payment is late: recover it' while the stage is SETTLING, and it was clicked | retry of the finalized payout sent through the frontend |
| pass | finality: the contract pays the builder the stage amount, exactly once | job=DONE stage=PAID contract balance 0.08 GEN then 0.08 GEN (0.1 credits - 2 fees = 0.08 GEN) |
| pass | books balance: balance = liabilities, no surplus | {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"} |
| pass | the frontend shows the result and the completed job | builder page text contains the verdict and completion notice |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x20f12d67…9146af`](https://explorer-studio.genlayer.com/tx/0x20f12d678d43d5d75f90c7dea30efef18546a2232544a5b85aea617b299146af) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x20490625…c7a65c`](https://explorer-studio.genlayer.com/tx/0x20490625469c93884688ae177bf758c18ddbdfc0261e7e64a104f96dd0c7a65c) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| deposit+fund | [`0xa0137094…ea242b`](https://explorer-studio.genlayer.com/tx/0xa0137094505b5a0512509c9f05a439c666c28f55365678bebc7e3af114ea242b) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×1, agree×4) |  |
| issue_code | [`0xe2b807ae…582f0b`](https://explorer-studio.genlayer.com/tx/0xe2b807ae7ae9448c67ecb149174d032e17f192bc554f8060e6888d0f60582f0b) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0x507821b3…f0588d`](https://explorer-studio.genlayer.com/tx/0x507821b30a7f3b220dd40e4fc20761cacacf3f6c608d4f5754b6cfd47cf0588d) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| register+credits | [`0x4a1db66e…12500f`](https://explorer-studio.genlayer.com/tx/0x4a1db66eccbac43b96155ffe4bd033a46071eadb5445d42d938aae5e6812500f) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| submit (wrong code) | [`0x06fce9e4…246eb1`](https://explorer-studio.genlayer.com/tx/0x06fce9e4a088dbf058b95a75723a933e5d17e3c715b274b1e2fa03f1be246eb1) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) | {"stage_met": "yes", "code_visible": "no", "site_aligned": true, "paid": false, "attempt": 1} |
| submit (right code) | [`0x22ede540…815969`](https://explorer-studio.genlayer.com/tx/0x22ede540a091ad4aaf012afca15a3559463e1279d7a536db2e3b5245f1815969) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) | {"stage_met": "yes", "code_visible": "yes", "site_aligned": true, "paid": true, "attempt": 2} |

Final state: job `DONE`, contract balance 80000000000000000 wei, accounting {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"}.

## cancel: Cancellation needs both parties and refunds the payer; stray funds from a failed transaction are reclaimable

Job contract: [`0x65cD542C7337bc274AB8145d183a7e09C0722120`](https://explorer-studio.genlayer.com/address/0x65cD542C7337bc274AB8145d183a7e09C0722120), payer `0xc4336B802629Fd3c0399d8C102c4B81f0E99F5bE`, builder `0x82B6dcD173D556f8B9C09B0284B90e289c761d00`

| Result | Check | Figures |
|---|---|---|
| pass | setup: 0.5 GEN in escrow, 0.05 GEN of credits | contract balance 0.55 GEN |
| pass | a failed payable transaction keeps its value, and the contract accounts for it as surplus | contract balance 0.557 GEN surplus 0.007 GEN |
| pass | payer cancelling alone refunds nothing | status=ACTIVE contract balance 0.557 GEN |
| pass | builder cancels too: the job is CANCELLED and the unpaid stage is refunded | status=CANCELLED contract balance 0.057 GEN (credits 0.05 + stray 0.007; the 0.5 GEN left for the payer) |
| pass | the frontend shows the stray funds to the payer | notice with the exact amount and a Reclaim button |
| pass | payer reclaims exactly the stray 0.007 GEN; the builder's credits are untouched | contract balance 0.05 GEN surplus 0 |
| pass | builder withdraws the unused credits: the contract ends at exactly 0 | contract balance 0 GEN |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0xf30df860…dacad0`](https://explorer-studio.genlayer.com/tx/0xf30df860f7a27a61e2109a5ffa3c477c9c43841a6142c5cb49e4e413ccdacad0) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| deposit+fund | [`0x780e61aa…8a2313`](https://explorer-studio.genlayer.com/tx/0x780e61aa0298900e2be0516cf2a611ab0c432d79170c4baf7b2296a66c8a2313) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0xbcad9259…6b07c1`](https://explorer-studio.genlayer.com/tx/0xbcad92594c415905ceaab409fb2ce4cd10359a545afc6b302a86f486936b07c1) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0x1f701f4c…123717`](https://explorer-studio.genlayer.com/tx/0x1f701f4c776a35f84322cd265755c202f2408720d64c7e0e2172f93cab123717) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0xc886441f…d3b56c`](https://explorer-studio.genlayer.com/tx/0xc886441fb0a240eb8c94ed35c52d582ce2cf0cfb02348828e218616f8cd3b56c) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| stray value: builder sends 0.007 GEN to payer-only deposit() | [`0x6c67cbe5…058dca`](https://explorer-studio.genlayer.com/tx/0x6c67cbe5dee8b47b07ee5effa65130b9422fec2f5242d63a4899417b0a058dca) | ACCEPTED MAJORITY_AGREE | ERROR | 5 (agree×3, idle×2) |  |
| payer cancel | [`0x6f8d6f2f…9ba543`](https://explorer-studio.genlayer.com/tx/0x6f8d6f2faf7b4d91f73a68cc5cb54a084f1f8207ef6cf24278e09fdd709ba543) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| builder cancel | [`0xd49989e9…e75ebd`](https://explorer-studio.genlayer.com/tx/0xd49989e9c30d36ee2e098914f6f13ecb4fd64ac1ba7cb4e211c1a1a85fe75ebd) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| reclaim_surplus | [`0x354b12e8…4b28fc`](https://explorer-studio.genlayer.com/tx/0x354b12e8f18c8421855c0391aca7806d542a77ea97d5b702326197d25d4b28fc) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| withdraw_credits | [`0x1801ab3b…0e9cfe`](https://explorer-studio.genlayer.com/tx/0x1801ab3bb34f066cf0f70292e5ab7e863f061203112e2166552c00a9d80e9cfe) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |

Final state: job `CANCELLED`, contract balance 0 wei, accounting {"balance":"0","liabilities":"0","surplus":"0"}.

## expire: A job past its deadline can be expired by the payer, who is refunded

Job contract: [`0x825C822C484a64f102f573FfabEb29620174113D`](https://explorer-studio.genlayer.com/address/0x825C822C484a64f102f573FfabEb29620174113D), payer `0xfCF99d7FC7B848632aa8C3dAA8Deece966197b91`, builder `0xdC66859e1B3BB7B3A54131e6b39601C63b0F8aAE`

| Result | Check | Figures |
|---|---|---|
| pass | funded: 0.5 GEN in escrow | expires_at=1791685551 |
| pass | before the deadline the frontend does not offer Expire | button present=false |
| pass | after the deadline the payer expires the job: status EXPIRED, the full 0.5 GEN leaves the contract | status=EXPIRED contract balance 0 GEN |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x1c2489fb…4e08cb`](https://explorer-studio.genlayer.com/tx/0x1c2489fbfa08cfd169d4bd40ccc9b12d58d0b8f5d9956429f9dd3a87fe4e08cb) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0xf93ce9ec…1d70d2`](https://explorer-studio.genlayer.com/tx/0xf93ce9ecdf140ab491b26bb05fefcda3bca76c5b739af5bdf5279165081d70d2) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×4, idle×1) |  |
| deposit+fund | [`0xd8c6170b…a15f5d`](https://explorer-studio.genlayer.com/tx/0xd8c6170b464625353add4a561d68d07659adf58850e1768f2c0670323da15f5d) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| expire | [`0x6c00cbbe…af78ca`](https://explorer-studio.genlayer.com/tx/0x6c00cbbe119512c323e07f5bdbf5cdca84ed124c7bb928c3232b792d3aaf78ca) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×1, agree×4) |  |

Final state: job `EXPIRED`, contract balance 0 wei, accounting {"balance":"0","liabilities":"0","surplus":"0"}.

## fallback: The payer never issues a code: after the window the builder unlocks a fallback code and is still paid

Job contract: [`0x9b552eb6CDe841Fe1A4F969E932d1Fa4023695A2`](https://explorer-studio.genlayer.com/address/0x9b552eb6CDe841Fe1A4F969E932d1Fa4023695A2), payer `0x440B5Eec2B98b9ceF24365AfCf5551786167e794`, builder `0xBB73bF8665d30c81fa297E8FeF0F0c79C32BD3d6`

| Result | Check | Figures |
|---|---|---|
| pass | builder requests a code; the payer stays silent | request_at=1791685845 |
| pass | the fallback button is disabled before the payer window passes | disabled=true |
| pass | after the window the builder unlocks a fallback code | code=BOX BAG |
| pass | the shot with the fallback code is judged | verdict={"stage_met":"yes","code_visible":"yes","site_aligned":true,"paid":true,"attempt":1} |
| pass | builder is paid although the payer never acted | job=DONE contract balance 0.09 GEN (credits left 0.09 GEN) |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0xf758a744…4d8c83`](https://explorer-studio.genlayer.com/tx/0xf758a74440f009f908971e18a79a4ed831065d19075d6d25a9f14c2ee94d8c83) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x6cb24f4c…14b852`](https://explorer-studio.genlayer.com/tx/0x6cb24f4c98db3631f8762a16fcbc4072e1404773b51f4e7421e5cb80d614b852) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x95d7b44c…6552ad`](https://explorer-studio.genlayer.com/tx/0x95d7b44c83a07ced6eee2255904fc736adbdce69401c29adbe4ef150a96552ad) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| register+credits | [`0x17a235a4…b9de71`](https://explorer-studio.genlayer.com/tx/0x17a235a47df6bff9b3fe6388087060daf591dd15f0fbc51c3ac0b1c99cb9de71) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| register+credits | [`0xd7a281b0…e45954`](https://explorer-studio.genlayer.com/tx/0xd7a281b0d500c76f641c8479a74ee254214fae24323d05d77b4505cc4ee45954) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×1, agree×4) |  |
| request_code | [`0x4cf78684…f24248`](https://explorer-studio.genlayer.com/tx/0x4cf7868446b8a7c72cf92f2dba36dbdd1820450df74138c5721b14e55cf24248) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| trigger_fallback_code | [`0x9e749480…c04107`](https://explorer-studio.genlayer.com/tx/0x9e749480f46269e76fe66b417455b56ca09578426951f28012b9f2e43ec04107) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| submit (fallback code) | [`0x20a91853…d786ea`](https://explorer-studio.genlayer.com/tx/0x20a918530a021b43f53083b74337273b615b85cac3ce54a8865f93e2d6d786ea) | ACCEPTED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) | {"stage_met": "yes", "code_visible": "yes", "site_aligned": true, "paid": true, "attempt": 1} |

Final state: job `DONE`, contract balance 90000000000000000 wei, accounting {"balance":"90000000000000000","liabilities":"90000000000000000","surplus":"0"}.

## Notes on the transaction tables

- **Validators (votes):** each transaction was decided by five validators. `agree` is a vote for the leader's result; `idle` is a validator that did not vote in that round, which the protocol tolerates when a majority agrees. A judged `submit` shows the verdict the panel agreed on in the Output column.
- **Status:** `ACCEPTED` is a decision inside the appeal window; `FINALIZED` is final. Payouts fire only after finality.
- **Hashes:** each link opens the transaction in the explorer; the full record of each (consensus data, GenVM result) is in `evidence/results/tx/<hash>.json`.
- The money checks compare the contract's own balance with the expected figure, because Studionet does not credit ordinary accounts.

The contract-level tests of the thumbnail check, settlement recovery and failed payable transactions are in [evidence/live_hardening.md](evidence/live_hardening.md).

## Summary

34 checks passed, 0 failed, 0 informational.
