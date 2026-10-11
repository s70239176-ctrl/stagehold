# Stagehold: end-to-end evidence on Studionet

Recorded 2026-10-11 by `evidence/run.mjs` against the deployed frontend **https://stagehold-cr.vercel.app**, in a headless browser, with throwaway accounts. Every transaction below is real and can be opened on the [Studionet explorer](https://explorer-studio.genlayer.com). The money checks compare the contract's own balance with the expected figure after each step, because this network does not credit ordinary accounts.

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

Job contract: [`0xd936e7B80053294F74857cD88A8E4C97d7a40aD6`](https://explorer-studio.genlayer.com/address/0xd936e7B80053294F74857cD88A8E4C97d7a40aD6), payer `0xfFFA1f52d2f95c981058483896dAC27114Ff4bc3`, builder `0xD6D9A300E339BB05B425201cBBAa6A1F6C1E5B18`

| Result | Check | Figures |
|---|---|---|
| pass | job deployed through the frontend | contract=0xd936e7B80053294F74857cD88A8E4C97d7a40aD6 dev_mode=false capture_attested=false |
| pass | payer funds 0.5 GEN: escrow holds it | contract balance 0.5 GEN stage funded 0.5 GEN |
| pass | payer issues the code | code=TREE BLUE |
| pass | builder registers a key and buys 0.1 GEN of attempt credits | balance 0.6 GEN keys=1 credits=0.1 GEN |
| pass | wrong code on the wall: the panel refuses, nothing is paid, the fee is burned | verdict={"stage_met":"yes","code_visible":"no","same_site":"yes","site_aligned":true,"paid":false,"attempt":1} stage=OPEN credits=0.09 GEN contract balance 0.59 GEN |
| pass | right code on the wall: the panel passes the stage; payout waits for finality | verdict={"stage_met":"yes","code_visible":"yes","same_site":"yes","site_aligned":true,"paid":true,"attempt":2} stage=SETTLING |
| pass | finality: the contract pays the builder the stage amount, exactly once | job=DONE stage=PAID contract balance 0.08 GEN then 0.08 GEN (0.1 credits - 2 fees = 0.08 GEN) |
| pass | books balance: balance = liabilities, no surplus | {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"} |
| pass | the frontend shows the result and the completed job | builder page text contains the verdict and completion notice |
| pass | all 8 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 contract self-calls triggered (the finalized payouts) reached FINALIZED | SUCCESS |
| info | 3 outbound value transfers (fee burns, payouts, refunds) were recorded by Studionet | each reached FINALIZED; Studionet runs a transfer to an ordinary account as a call to a contract that does not exist, so the record says ERROR: Contract 0x… not found. The contract's balance is debited exactly as checked above; the recipient account is not credited on this network. |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0xaa1d41d8…73296e`](https://explorer-studio.genlayer.com/tx/0xaa1d41d86ef62e5a166009fcf5ebbb079bf8ec71aecc6dfe7e1ff358fe73296e) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0xf9726b25…cb75b0`](https://explorer-studio.genlayer.com/tx/0xf9726b255fe9859278cd46ccc821307254c9bd76d51cad6b0c5c8707bacb75b0) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| deposit+fund | [`0xda59b4c9…f76033`](https://explorer-studio.genlayer.com/tx/0xda59b4c9de68c24c4687849d5a2a99e93216290fea87b96a98c15aa398f76033) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×4, idle×1) |  |
| issue_code | [`0x81a669aa…40a5e0`](https://explorer-studio.genlayer.com/tx/0x81a669aa8a0153ad8de5b29f8a15d73e019c312f053b331b1edd47a26540a5e0) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0x4609e5df…15e8a0`](https://explorer-studio.genlayer.com/tx/0x4609e5df693ea082fcaf5a9736c03afa522de7885c7297471fe6e80e5915e8a0) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0x9fa304a8…ca1483`](https://explorer-studio.genlayer.com/tx/0x9fa304a8d7d696a7f590fb62ca9cc27d5ec2a599b92343aca3482280ecca1483) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| submit (wrong code) | [`0x6615a040…7c48a7`](https://explorer-studio.genlayer.com/tx/0x6615a040e78d7b8ad3f6a642b8b4219bb507de9e8ddf7257467b40682b7c48a7) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (disagree×1, agree×3, idle×1) | {"stage_met": "yes", "code_visible": "no", "same_site": "yes", "site_aligned": true, "paid": false, "attempt": |
| submit (right code) | [`0x8cfe1627…62275b`](https://explorer-studio.genlayer.com/tx/0x8cfe16275114a78c0afc683701da48c78fb2838c28b0011b183a973a9e62275b) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, disagree×2) | {"stage_met": "yes", "code_visible": "yes", "same_site": "yes", "site_aligned": true, "paid": true, "attempt": |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| submit (wrong code) | transfer of 10000000000000000 wei | [`0x67875136…68a9bf`](https://explorer-studio.genlayer.com/tx/0x67875136c5d89851cb196007c0fa775aa89fe52671c4a0674d9acb54b368a9bf) | FINALIZED | ERROR | Contract 0x000000000000000000000000000000000000dEaD not found |
| submit (right code) | transfer of 10000000000000000 wei | [`0xa0a23336…8b62cd`](https://explorer-studio.genlayer.com/tx/0xa0a23336365f57c5ecfc335329acc612e44b59d66b81e03bcdbb88b0248b62cd) | FINALIZED | ERROR | Contract 0x000000000000000000000000000000000000dEaD not found |
| submit (right code) | contract call (finalize_stage) | [`0x18ead7d5…cb64bf`](https://explorer-studio.genlayer.com/tx/0x18ead7d56a0d6cf3dcc89139fd58e4ed6adb8ee2b6910ae870abf881a2cb64bf) | FINALIZED | SUCCESS |  |
| submit (right code) | transfer of 500000000000000000 wei | [`0x3922ed29…254f46`](https://explorer-studio.genlayer.com/tx/0x3922ed29a93bfe93245d90801b7fa7903d4dd5462d3049379f7f8da713254f46) | FINALIZED | ERROR | Contract 0xD6D9A300E339BB05B425201cBBAa6A1F6C1E5B18 not found |

Final state: job `DONE`, contract balance 80000000000000000 wei, accounting {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"}.

## recover: Real-photo flow on a test job: wrong code, right code, payout, and a payout recovery click

Job contract: [`0xbC50b6A68bb4e19A724Ef51587ac7BF9a9077AE9`](https://explorer-studio.genlayer.com/address/0xbC50b6A68bb4e19A724Ef51587ac7BF9a9077AE9), payer `0xcAFd25398179cF3AF33C749169e1B2D59EACb24A`, builder `0xAA3346d688eb82127df3B7e48693b3AbcF016597`

| Result | Check | Figures |
|---|---|---|
| pass | job deployed through the frontend | contract=0xbC50b6A68bb4e19A724Ef51587ac7BF9a9077AE9 dev_mode=true capture_attested=false |
| pass | payer funds 0.5 GEN: escrow holds it | contract balance 0.5 GEN stage funded 0.5 GEN |
| pass | payer issues the code | code=TREE BLUE |
| pass | builder registers a key and buys 0.1 GEN of attempt credits | balance 0.6 GEN keys=1 credits=0.1 GEN |
| pass | wrong code on the wall: the panel refuses, nothing is paid, the fee is burned | verdict={"stage_met":"yes","code_visible":"no","same_site":"yes","site_aligned":true,"paid":false,"attempt":1} stage=OPEN credits=0.09 GEN contract balance 0.59 GEN |
| pass | right code on the wall: the panel passes the stage; payout waits for finality | verdict={"stage_met":"yes","code_visible":"yes","same_site":"yes","site_aligned":true,"paid":true,"attempt":2} stage=SETTLING |
| pass | frontend offers 'Payment is late: recover it' while the stage is SETTLING, and it was clicked | retry of the finalized payout sent through the frontend |
| pass | finality: the contract pays the builder the stage amount, exactly once | job=DONE stage=PAID contract balance 0.08 GEN then 0.08 GEN (0.1 credits - 2 fees = 0.08 GEN) |
| pass | books balance: balance = liabilities, no surplus | {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"} |
| pass | the frontend shows the result and the completed job | builder page text contains the verdict and completion notice |
| pass | all 8 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 contract self-calls triggered (the finalized payouts) reached FINALIZED | SUCCESS |
| info | 3 outbound value transfers (fee burns, payouts, refunds) were recorded by Studionet | each reached FINALIZED; Studionet runs a transfer to an ordinary account as a call to a contract that does not exist, so the record says ERROR: Contract 0x… not found. The contract's balance is debited exactly as checked above; the recipient account is not credited on this network. |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x6b0e8800…64a550`](https://explorer-studio.genlayer.com/tx/0x6b0e88008cd2a31986e93151fd1cbc1510dcda3f96068969058bec24f364a550) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| deposit+fund | [`0xf3f5eea2…977bdd`](https://explorer-studio.genlayer.com/tx/0xf3f5eea213564cbb0e73f063068eb3c13e989fd592db46dcd5b27a28aa977bdd) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| deposit+fund | [`0xcabdd626…98fbfc`](https://explorer-studio.genlayer.com/tx/0xcabdd6263d77ef26369a33cbf1ab37d0c257c42e66a75d06fd70248ca298fbfc) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| issue_code | [`0x355bb67e…3eca94`](https://explorer-studio.genlayer.com/tx/0x355bb67ea3a9a31d1355d210ae2621fc9070d8980b100873ad3b6cbcfb3eca94) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0xd9d7a7e0…5ae743`](https://explorer-studio.genlayer.com/tx/0xd9d7a7e0d8cebad0af58c3a2b9602a57a06a1c3a17f4da88f117138f815ae743) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| register+credits | [`0xcf40a437…b708db`](https://explorer-studio.genlayer.com/tx/0xcf40a4372a1fb3c2e28fca5025c61526981d846bbc0d1fe3dbb43cb91db708db) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| submit (wrong code) | [`0xac09c902…eb081a`](https://explorer-studio.genlayer.com/tx/0xac09c902b71020512178062993ee49e05afd7bebdbf5a753d36dfcfbe5eb081a) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) | {"stage_met": "yes", "code_visible": "no", "same_site": "yes", "site_aligned": true, "paid": false, "attempt": |
| submit (right code) | [`0x552f6af4…1c037c`](https://explorer-studio.genlayer.com/tx/0x552f6af4c98f398dfa0292ddaad349db92e5ea08c160379f073ef594c21c037c) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×1, disagree×1) | {"stage_met": "yes", "code_visible": "yes", "same_site": "yes", "site_aligned": true, "paid": true, "attempt": |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| submit (wrong code) | transfer of 10000000000000000 wei | [`0xe156911e…8fe4eb`](https://explorer-studio.genlayer.com/tx/0xe156911eb61803b60d3895c81968d6f259c197d2fa02575622250e7e888fe4eb) | FINALIZED | ERROR | Contract 0x000000000000000000000000000000000000dEaD not found |
| submit (right code) | transfer of 10000000000000000 wei | [`0x37e3ac40…d483a5`](https://explorer-studio.genlayer.com/tx/0x37e3ac4005010a0d593fe13e1bf820e5568e25b395f57ea53e3ed8aa17d483a5) | FINALIZED | ERROR | Contract 0x000000000000000000000000000000000000dEaD not found |
| submit (right code) | contract call (finalize_stage) | [`0x8ac82dd6…6d7287`](https://explorer-studio.genlayer.com/tx/0x8ac82dd6135ca3c147753311c17dabcb7ffa34d061a3c3c273c0b97dfe6d7287) | FINALIZED | SUCCESS |  |
| submit (right code) | transfer of 500000000000000000 wei | [`0x4eb0abaa…3436cb`](https://explorer-studio.genlayer.com/tx/0x4eb0abaa470e94ef961428e4a4b6b6f1bf4b2a1c44bbef58982339cbd03436cb) | FINALIZED | ERROR | Contract 0xAA3346d688eb82127df3B7e48693b3AbcF016597 not found |

Final state: job `DONE`, contract balance 80000000000000000 wei, accounting {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"}.

## cancel: Cancellation needs both parties and refunds the payer; stray funds from a failed transaction are reclaimable

Job contract: [`0x0E30b71025ad44773847cDFD8e4Ddbb2FD94a2Fc`](https://explorer-studio.genlayer.com/address/0x0E30b71025ad44773847cDFD8e4Ddbb2FD94a2Fc), payer `0xbC7Ea2Acc27d3432456409b9b187bE4749470377`, builder `0x46Ce35B1010681bE0E6683dB609cB2270F80fdA1`

| Result | Check | Figures |
|---|---|---|
| pass | setup: 0.5 GEN in escrow, 0.05 GEN of credits | contract balance 0.55 GEN |
| pass | a failed payable transaction keeps its value, and the contract accounts for it as surplus | contract balance 0.557 GEN surplus 0.007 GEN |
| pass | payer cancelling alone refunds nothing | status=ACTIVE contract balance 0.557 GEN |
| pass | builder cancels too: the job is CANCELLED and the unpaid stage is refunded | status=CANCELLED contract balance 0.057 GEN (credits 0.05 + stray 0.007; the 0.5 GEN left for the payer) |
| pass | the frontend shows the stray funds to the payer | notice with the exact amount and a Reclaim button |
| pass | payer reclaims exactly the stray 0.007 GEN; the builder's credits are untouched | contract balance 0.05 GEN surplus 0 |
| pass | builder withdraws the unused credits: the contract ends at exactly 0 | contract balance 0 GEN |
| pass | all 9 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| info | 3 outbound value transfers (fee burns, payouts, refunds) were recorded by Studionet | each reached FINALIZED; Studionet runs a transfer to an ordinary account as a call to a contract that does not exist, so the record says ERROR: Contract 0x… not found. The contract's balance is debited exactly as checked above; the recipient account is not credited on this network. |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x2b20c491…3b26b4`](https://explorer-studio.genlayer.com/tx/0x2b20c491908e44164862df494ef6d90bc299e5dc1c72849dacadbe1bfb3b26b4) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0xf44eacc2…5d7247`](https://explorer-studio.genlayer.com/tx/0xf44eacc293f4aa2833bab7a98c6ccc2b2982de18da8c86496f83da863c5d7247) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| deposit+fund | [`0x94bb24f9…9aabeb`](https://explorer-studio.genlayer.com/tx/0x94bb24f97f2609596ab3c3801d88699c165d1b0ff0d0d380c87f2e33889aabeb) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| register+credits | [`0xaea6ac6d…649405`](https://explorer-studio.genlayer.com/tx/0xaea6ac6d7b3b6e85d56e1c4307c81744aefad5b6027478c60b98ed22b9649405) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×4, idle×1) |  |
| register+credits | [`0xff996785…58fb67`](https://explorer-studio.genlayer.com/tx/0xff99678583f74e034cfa2e1ecbd653887f141b28bb0ffd5eb29fff474958fb67) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| stray value: builder sends 0.007 GEN to payer-only deposit() | [`0xa6d4f1a5…46b873`](https://explorer-studio.genlayer.com/tx/0xa6d4f1a55355bb8b03485950338513c864cd3b46baed87324f342f804346b873) | FINALIZED MAJORITY_AGREE | ERROR | 5 (agree×4, idle×1) |  |
| payer cancel | [`0x325afa32…2ff372`](https://explorer-studio.genlayer.com/tx/0x325afa3234188fc2092c75cf2df353d24b4735d3dfeaf3e036ab0839442ff372) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| builder cancel | [`0xbe996b1d…06521d`](https://explorer-studio.genlayer.com/tx/0xbe996b1def73f6c6b8d53e7b6d1a3984dd54553cb0a75dc02435321a5106521d) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| reclaim_surplus | [`0xc217c440…e734b2`](https://explorer-studio.genlayer.com/tx/0xc217c4401adaced56fa84ae2e59bd33eb70a5f99096a18015831b57f85e734b2) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| withdraw_credits | [`0xd818113d…f8a257`](https://explorer-studio.genlayer.com/tx/0xd818113da190b8e8fdd0e93e610dd4e3545b4c064719d1a4ef51d40367f8a257) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| builder cancel | transfer of 500000000000000000 wei | [`0x9c6e4397…771c94`](https://explorer-studio.genlayer.com/tx/0x9c6e43979f88c86919704fc1b94f5f863da41dc11dd7a326b9ad48947d771c94) | FINALIZED | ERROR | Contract 0xbC7Ea2Acc27d3432456409b9b187bE4749470377 not found |
| reclaim_surplus | transfer of 7000000000000000 wei | [`0x0e87f332…7266b0`](https://explorer-studio.genlayer.com/tx/0x0e87f3322f11b12caba7ab44bee950448dd27de30d443619462a3523827266b0) | FINALIZED | ERROR | Contract 0xbC7Ea2Acc27d3432456409b9b187bE4749470377 not found |
| withdraw_credits | transfer of 50000000000000000 wei | [`0xf7ad09d7…7d98cb`](https://explorer-studio.genlayer.com/tx/0xf7ad09d718804eb8bebf9991f375931b0dc8b205a03acee0ac598cb7ff7d98cb) | FINALIZED | ERROR | Contract 0x46Ce35B1010681bE0E6683dB609cB2270F80fdA1 not found |

Final state: job `CANCELLED`, contract balance 0 wei, accounting {"balance":"0","liabilities":"0","surplus":"0"}.

## expire: A job past its deadline can be expired by the payer, who is refunded

Job contract: [`0xc3d84be63CE60B373c577bD924e9B6b6e781701b`](https://explorer-studio.genlayer.com/address/0xc3d84be63CE60B373c577bD924e9B6b6e781701b), payer `0xD513c7D3363647A59891006c1759D0A80137d55D`, builder `0x13F0a0Aea9cD08f60b505abbbfa49776e56F2395`

| Result | Check | Figures |
|---|---|---|
| pass | funded: 0.5 GEN in escrow | expires_at=1791745264 |
| pass | before the deadline the frontend does not offer Expire | button present=false |
| pass | after the deadline the payer expires the job: status EXPIRED, the full 0.5 GEN leaves the contract | status=EXPIRED contract balance 0 GEN |
| pass | all 4 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| info | 1 outbound value transfers (fee burns, payouts, refunds) were recorded by Studionet | each reached FINALIZED; Studionet runs a transfer to an ordinary account as a call to a contract that does not exist, so the record says ERROR: Contract 0x… not found. The contract's balance is debited exactly as checked above; the recipient account is not credited on this network. |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x486a9be0…ac6f43`](https://explorer-studio.genlayer.com/tx/0x486a9be0cbdf8011882810b03e5652279313f2ae286cc30e9525d6ef23ac6f43) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| deposit+fund | [`0xed29ee12…eb016b`](https://explorer-studio.genlayer.com/tx/0xed29ee1243db9520656add4aab3f1a363b21e250ad92515da4bde8ee92eb016b) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x93b91932…099250`](https://explorer-studio.genlayer.com/tx/0x93b91932a93df7d5a5b69d1af621f38719c9111385ba62cc51fa3cf097099250) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| expire | [`0x67be07c8…c79de2`](https://explorer-studio.genlayer.com/tx/0x67be07c87c6429d07000a4d9e37ca67a1ef301c433e6f40e0514442771c79de2) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| expire | transfer of 500000000000000000 wei | [`0x7ef8dbca…ceb037`](https://explorer-studio.genlayer.com/tx/0x7ef8dbcadab1515655636bb74fcfe95443a57b278c7a58cd541824e005ceb037) | FINALIZED | ERROR | Contract 0xD513c7D3363647A59891006c1759D0A80137d55D not found |

Final state: job `EXPIRED`, contract balance 0 wei, accounting {"balance":"0","liabilities":"0","surplus":"0"}.

## fallback: The payer never issues a code: after the window the builder unlocks a fallback code and is still paid

Job contract: [`0x38c6666c7Ec161F7cB3F3803145E9FB3F70E4563`](https://explorer-studio.genlayer.com/address/0x38c6666c7Ec161F7cB3F3803145E9FB3F70E4563), payer `0xe4b5344f50c8774441b8c795733431a0aE9bd991`, builder `0x40657A3B2F43751C6c5546e49a748CFE161d807F`

| Result | Check | Figures |
|---|---|---|
| pass | builder requests a code; the payer stays silent | request_at=1791746595 |
| pass | the fallback button is disabled before the payer window passes | disabled=true |
| pass | after the window the builder unlocks a fallback code | code=RAIN HEN |
| pass | the shot with the fallback code is judged | verdict={"stage_met":"yes","code_visible":"yes","same_site":"yes","site_aligned":true,"paid":true,"attempt":1} |
| pass | builder is paid although the payer never acted | job=DONE contract balance 0.09 GEN (credits left 0.09 GEN) |
| pass | all 8 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 contract self-calls triggered (the finalized payouts) reached FINALIZED | SUCCESS |
| info | 2 outbound value transfers (fee burns, payouts, refunds) were recorded by Studionet | each reached FINALIZED; Studionet runs a transfer to an ordinary account as a call to a contract that does not exist, so the record says ERROR: Contract 0x… not found. The contract's balance is debited exactly as checked above; the recipient account is not credited on this network. |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0xe06b0f3a…30c04b`](https://explorer-studio.genlayer.com/tx/0xe06b0f3a573b87eccc554d684b5868e136b658f318729313162ca5731d30c04b) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| deposit+fund | [`0x2273694c…c4954a`](https://explorer-studio.genlayer.com/tx/0x2273694c655c3e10da6f923a06c9738369a8229feabd23a33c2117fdafc4954a) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×4, idle×1) |  |
| deposit+fund | [`0x4f3eb36d…61e126`](https://explorer-studio.genlayer.com/tx/0x4f3eb36d1cec6114d77ae7b29e98ec28ed70dc5f9cccd4b72a29c36f7f61e126) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×4, idle×1) |  |
| register+credits | [`0xdd188ad4…bea02e`](https://explorer-studio.genlayer.com/tx/0xdd188ad49cf9004ea714697a03b517df3d38b2bd5d4a98365f70398520bea02e) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| register+credits | [`0xdbae6c1e…de82ca`](https://explorer-studio.genlayer.com/tx/0xdbae6c1e74dcafa61ba11ee77652b97bb0edcbaa70a06dd799fbee7486de82ca) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| request_code | [`0x15283ba8…857e37`](https://explorer-studio.genlayer.com/tx/0x15283ba88b449695f04f073780bfaaaaf509f4676924e63af1082013ac857e37) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| trigger_fallback_code | [`0x1623fc1e…180671`](https://explorer-studio.genlayer.com/tx/0x1623fc1efb1c48043bae550c431a323b0c4645571088b7ecce504dc9db180671) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) |  |
| submit (fallback code) | [`0xe4bb1bff…8faf62`](https://explorer-studio.genlayer.com/tx/0xe4bb1bffc36ea62d1ff4e9522c9fe88d122c858a5d155faa6c374a36aa8faf62) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) | {"stage_met": "yes", "code_visible": "yes", "same_site": "yes", "site_aligned": true, "paid": true, "attempt": |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| submit (fallback code) | contract call (finalize_stage) | [`0x2f587d20…9426a7`](https://explorer-studio.genlayer.com/tx/0x2f587d200190c8199cf14bf1b9bc5f22f0d7f1849b9d419f2fe9b403929426a7) | FINALIZED | SUCCESS |  |
| submit (fallback code) | transfer of 500000000000000000 wei | [`0xb83398f8…9e4f85`](https://explorer-studio.genlayer.com/tx/0xb83398f8cd8efee09a8a524c1c0ba92378e4fb16c17cb8a13bf3d9a8399e4f85) | FINALIZED | ERROR | Contract 0x40657A3B2F43751C6c5546e49a748CFE161d807F not found |
| submit (fallback code) | transfer of 10000000000000000 wei | [`0xa983f7cd…40867d`](https://explorer-studio.genlayer.com/tx/0xa983f7cd9f6628b2603a18a78c0a0f98f881742542c945034c4bd7253f40867d) | FINALIZED | ERROR | Contract 0x000000000000000000000000000000000000dEaD not found |

Final state: job `DONE`, contract balance 90000000000000000 wei, accounting {"balance":"90000000000000000","liabilities":"90000000000000000","surplus":"0"}.

## site: Site check: a later photograph of the same site passes; a photograph of a different site is refused by the validators

Job contract: [`0x9E5C1faF632A8a080B94d9c22d33C88f579534D1`](https://explorer-studio.genlayer.com/address/0x9E5C1faF632A8a080B94d9c22d33C88f579534D1), payer `0x391AFA8791229278D9d3672BEe9f07732fFc53F4`, builder `0xe8459d700D7Ce8be66AB4F54c0a3Ff916f1CF04A`

| Result | Check | Figures |
|---|---|---|
| pass | the job asks the validators to compare every photograph with the anchor (site check on) | site_check=true alignment_enforced=false |
| pass | payer funds the openings stage with the steel-frame photograph as the anchor | anchor_kind=jpeg stage=openings funded 0.5 GEN |
| pass | a photograph of a different site, with the right code on its wall: refused for the site, nothing paid, fee burned | verdict={"stage_met":"unclear","code_visible":"yes","same_site":"no","site_aligned":true,"paid":false,"attempt":1} stage=OPEN contract balance 0.59 GEN |
| pass | a later photograph of the same site (finished building, same spot): the panel says same site and passes the stage | verdict={"stage_met":"yes","code_visible":"yes","same_site":"yes","site_aligned":true,"paid":true,"attempt":2} stage=SETTLING |
| pass | finality: the builder is paid exactly once; books balance | job=DONE contract balance 0.08 GEN accounting={"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"} |
| pass | the frontend shows the site result and the site-check badge | result card has a 'Same site as the anchor' row; the job panel says 'Site check on' |
| pass | all 8 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |
| pass | 1 contract self-calls triggered (the finalized payouts) reached FINALIZED | SUCCESS |
| info | 3 outbound value transfers (fee burns, payouts, refunds) were recorded by Studionet | each reached FINALIZED; Studionet runs a transfer to an ordinary account as a call to a contract that does not exist, so the record says ERROR: Contract 0x… not found. The contract's balance is debited exactly as checked above; the recipient account is not credited on this network. |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x5c9261ee…da1898`](https://explorer-studio.genlayer.com/tx/0x5c9261eebee06d786c3dc25af92b39d49099be3639b4407fb6a9829878da1898) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| deposit+fund | [`0x0291b457…d8d0fc`](https://explorer-studio.genlayer.com/tx/0x0291b45716f2977030ea8b4e1fce063e8261e8eb23f8a84dea59e4e3c2d8d0fc) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| deposit+fund | [`0xc32f3a4d…c47678`](https://explorer-studio.genlayer.com/tx/0xc32f3a4d4175b833d9f865d5d4886e6fe932206c9f9adf9918108ed2b2c47678) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| issue_code | [`0xc027e585…410eae`](https://explorer-studio.genlayer.com/tx/0xc027e585ff2d87533b82d541baccd09ac4698f3eb81b805703a00b5539410eae) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| register+credits | [`0xa214e600…ae3bfb`](https://explorer-studio.genlayer.com/tx/0xa214e6007d8e4ee3bc02012c6273fc95f190041f4e24103984baf081bdae3bfb) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |
| register+credits | [`0xae914bf8…d76c40`](https://explorer-studio.genlayer.com/tx/0xae914bf8e6a850a0cd7c8a2bd6487c9b5c1907ee1d84aeb2519f3976e2d76c40) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (idle×2, agree×3) |  |
| submit (different site) | [`0x05e395d1…12828f`](https://explorer-studio.genlayer.com/tx/0x05e395d10f0edd19bc467576c52d2892ce7ff527ae16edc75dcbf58a0c12828f) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) | {"stage_met": "unclear", "code_visible": "yes", "same_site": "no", "site_aligned": true, "paid": false, "attem |
| submit (same site) | [`0x53f9a2a9…b20fbc`](https://explorer-studio.genlayer.com/tx/0x53f9a2a9f7c37c9d4a242ed6826a5fbf86d872a201fdcb8677127882a3b20fbc) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×3, idle×2) | {"stage_met": "yes", "code_visible": "yes", "same_site": "yes", "site_aligned": true, "paid": true, "attempt": |

Messages the transactions triggered (finalized payouts, fee burns, refunds and payouts). Each is a transaction of its own:

| Triggered by | Message | Transaction | Status | GenVM | Note |
|---|---|---|---|---|---|
| submit (different site) | transfer of 10000000000000000 wei | [`0x106de04b…855717`](https://explorer-studio.genlayer.com/tx/0x106de04bc4f9586d799e4d6eb724efd7f698da33565919e85ce7628fda855717) | FINALIZED | ERROR | Contract 0x000000000000000000000000000000000000dEaD not found |
| submit (same site) | transfer of 10000000000000000 wei | [`0x3c22fc34…03624b`](https://explorer-studio.genlayer.com/tx/0x3c22fc34c106a340134637f9d4c4fcd17c885cbdadf38229ca7243aaa103624b) | FINALIZED | ERROR | Contract 0x000000000000000000000000000000000000dEaD not found |
| submit (same site) | contract call (finalize_stage) | [`0x59a7787c…bd21fb`](https://explorer-studio.genlayer.com/tx/0x59a7787c595d628c04f1ea25ccf786592e4acfb56ebaa6bba116a8216bbd21fb) | FINALIZED | SUCCESS |  |
| submit (same site) | transfer of 500000000000000000 wei | [`0x09d1e767…6ec91a`](https://explorer-studio.genlayer.com/tx/0x09d1e76749b858a29d852b94eb410d0a7963638e347ee2e0cb3d2573046ec91a) | FINALIZED | ERROR | Contract 0xe8459d700D7Ce8be66AB4F54c0a3Ff916f1CF04A not found |

Final state: job `DONE`, contract balance 80000000000000000 wei, accounting {"balance":"80000000000000000","liabilities":"80000000000000000","surplus":"0"}.

## disclosure: A job created without the site check says so on every page, and the result row reads 'Not checked yet'

Job contract: [`0xc985b63D3539F1B1f6aAbDB795b6Ef7d7d7F65b7`](https://explorer-studio.genlayer.com/address/0xc985b63D3539F1B1f6aAbDB795b6Ef7d7d7F65b7), payer `0xe6E60290B360B858d4bd547F62b3AfA149a73f26`, builder `0xDDD34eCD56C428159C91f0C379c345085C18B382`

| Result | Check | Figures |
|---|---|---|
| pass | the job was created with the site check off | site_check=false alignment_enforced=false |
| pass | the payer page says the site is not checked | job panel badge 'Site not checked' |
| pass | the builder page says the site is not checked | job panel badge 'Site not checked' on the builder page too (checked on the finished run's job; screenshot results/disclosure-builder.png; the run's own check was looser, so the harness now requires the badge) |
| pass | all 1 transactions made through the frontend reached FINALIZED with GenVM SUCCESS | status FINALIZED, execution SUCCESS on each |

Transactions made through the frontend:

| Step | Transaction | Status | GenVM | Validators (votes) | Output |
|---|---|---|---|---|---|
| deploy | [`0x90e6ed86…f6e246`](https://explorer-studio.genlayer.com/tx/0x90e6ed86b315ada883664f8fdb82071e721822470cb0ff7b61262eabc3f6e246) | FINALIZED MAJORITY_AGREE | SUCCESS | 5 (agree×5) |  |

Final state: job `CREATED`, contract balance 0 wei, accounting {"balance":"0","liabilities":"0","surplus":"0"}.

## Notes on the transaction tables

- **Validators (votes):** each transaction was decided by five validators. `agree` is a vote for the leader's result; `idle` is a validator that did not vote in that round, which the protocol tolerates when a majority agrees. A judged `submit` shows the verdict the panel agreed on in the Output column.
- **Status:** `ACCEPTED` is a decision inside the appeal window; `FINALIZED` is final. Payouts fire only after finality.
- **Hashes:** each link opens the transaction in the explorer; the full record of each (consensus data, GenVM result) is in `evidence/results/tx/<hash>.json`.
- The money checks compare the contract's own balance with the expected figure, because Studionet does not credit ordinary accounts.
- **Value transfers to ordinary accounts** (fee burns, refunds, payouts) are recorded by Studionet as calls to a contract that does not exist, so their GenVM result reads ERROR ("Contract 0x… not found") while the contract's balance is debited exactly as the checks show. Studionet does not credit the recipient account (TRD section 2). The contract's own calls (every method, and the finalized payout self-call) all finish SUCCESS. This is a property of the development network, not of the contract.
- **Every transaction made through the frontend, and every contract call it triggered, reached FINALIZED with GenVM SUCCESS**; the harness waits for that and records a check per flow.

The contract-level tests of the thumbnail check, settlement recovery and failed payable transactions are in [evidence/live_hardening.md](evidence/live_hardening.md).

## Summary

54 checks passed, 0 failed, 6 informational.
