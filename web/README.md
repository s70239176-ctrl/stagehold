# Stagehold web app (GenLayer Studionet)

Two mobile pages on top of `contracts/stagehold.py`: **/payer** (create the job, fund a stage with an anchor photo, issue a code) and **/builder** (register this browser, add attempt credits, request or unlock a code, take a live camera frame, submit). The builder sees three results, never the model's explanation: stage complete, code visible, same site (shown as "not checked yet" while alignment is off).

> **WEB MODE has no capture authenticity.** A browser cannot prove a photo came from a live camera, so a gallery photo or a generated image cannot be told apart from a live frame. Every web job is created with `software_keys`, the snapshot says `capture_attested: false`, the builder's capture card shows a notice, the job panel shows a "Capture not verified" badge, and every page footer says so. Studionet GEN has no market value. The attested Android app is paused on the roadmap as a **mainnet gate**.

## Run

```
cd web
npm install                # once
npm run sync-contract      # copies contracts/stagehold.py to public/ (rerun after any contract change)
npm run dev                # http://localhost:3100  (use `npx next dev -p <port>` if 3100 is taken)
npm test                   # crypto, signature and word-list tests
npm run typecheck && npm run build
```

Amounts are entered and shown in GEN (18 decimals). Accounts are throwaway keys made in the browser and kept in localStorage (Studionet is gasless). A browser wallet (MetaMask or any EIP-1193 wallet) can be connected instead from the account bar; it adds and switches to Studionet (chain 61999) and signs each transaction. The GenLayer Snap is not requested. The signing key is a non-extractable WebCrypto P-256 key kept in IndexedDB.

## What was verified

- `typecheck`, `build` and 12 unit tests pass (the DER signature conversion is checked against Node's verifier, the shot message and the word list against the contract, and GEN parsing and formatting round-trip exactly to 18 decimals).
- The interface was redesigned (landing page, payer and builder consoles, shared design system) and a full job was run through the new pages in GEN amounts: 0.5 GEN funded, a code issued, a key registered, 0.1 GEN of credits added, a frame signed and submitted, the panel accepted it, and the job completed with escrow back to 0 GEN. The layout was checked down to a 296 px viewport with no horizontal overflow.
- **End to end in a browser, on Studionet (Oct 2026):** the payer page deployed a job, funded the roof stage with an uploaded anchor (19 KB thumbnail stored on-chain) and issued the code; the builder page registered a browser-made key, added credits, took a frame, signed it and submitted; the panel answered yes / yes; the stage went to `PAID` and the job to `DONE`. The browser pane has no camera, so a stand-in camera stream was installed in the page context for that test (no app code was changed for it).

## Also verified through the pages (test jobs with short windows)

A payer-page checkbox creates a clearly labelled **test job** (the contract's `dev_mode`) with a short fallback window and a short expiry; every page shows a "test job: short windows" tag for it. With those:

- **Silent payer:** the builder requested a code, the "Unlock fallback code" button stayed disabled until the 40-second window passed and enabled right after, the fallback code ("BEAN BONE") appeared, a frame with that code was signed and submitted, the panel answered yes / yes, and the job went to `PAID` / `DONE`. "Withdraw my unused credits" then returned the leftover credits.
- **Expire:** the "Expire the job" button was hidden before the deadline and appeared after it; clicking it moved the job to `EXPIRED` and the stage to "0 held" (refunded).
- **Cancel:** the payer cancelling alone left the job `ACTIVE` with 1000 held; after the builder cancelled too it went to `CANCELLED` and "0 held".

Not clicked individually: the builder page's expire button (same contract call as the payer page's).

## Not verified

- A real phone camera, real handwritten codes, and real photos (the judge gate). The browser pane has no camera, so every browser test used a stand-in camera stream installed in the page context.
- A real MetaMask: wallet routing was verified with a mock wallet that signs like one (a job deployed through `eth_sendTransaction` recorded the wallet as payer) and the connect flow with unit tests and a mock in the page. Real extension prompts, the Snap, and Studionet GEN balances in a wallet were not tried. Other browsers, desktop layout and accessibility checks are also untested.
- Anything with real value.
