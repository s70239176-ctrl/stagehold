# Stagehold web app (GenLayer Studionet)

Two mobile pages on top of `contracts/stagehold.py`: **/payer** (create the job, fund a stage with an anchor photo, issue a code) and **/builder** (register this browser, add attempt credits, request or unlock a code, take a live camera frame, submit). The builder sees three results, never the model's explanation: stage complete, code visible, same site (shown as "not checked yet" while alignment is off).

> **WEB MODE has no capture authenticity.** A browser cannot prove a photo came from a live camera, so a gallery photo or a generated image cannot be told apart from a live frame. Every web job is created with `software_keys`, the snapshot says `capture_attested: false`, the builder's capture card shows a notice, the job panel shows a "Capture not verified" badge, and every page footer says so. Studionet GEN has no market value. The attested Android app is paused on the roadmap as a **mainnet gate**.

## Design

Graphite and warm white with one blue accent (`#6bb6d8`), Geist and Geist Mono, a visible 12-column grid, sharp rectangles and thin borders. The landing page (`app/page.tsx`, `components/landing.tsx`, `components/Plate.tsx`) is a set of editorial bands: method (scroll-driven), project schedule, evidence, independent panel, escrow, limits. Its drawings, figures and the 3 of 3 panel are original illustrations labelled as samples, not data from a real project or the chain; there is no stock photography. The payer and builder consoles keep their logic and are restyled through the same tokens in `app/globals.css`. Motion respects `prefers-reduced-motion`.

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

## Live-camera checks (web only, client side)

Before a frame is kept, the page watches the stream for about a second (`web/lib/liveness.ts`). It refuses cameras whose name says they are software (OBS, ManyCam, virtual cameras) and feeds whose frames do not change, which is what a still image or a stuck loop looks like. Frames come only from the live stream, never from a file picker. These checks raise the effort of faking a capture; they do not authenticate the camera, the contract never sees them, and a virtual camera that adds noise or a renamed device still passes. Verified with unit tests and in the page with a frozen and a changing stand-in stream (frozen refused, changing accepted); not with real hardware.

## Not verified

- A real phone camera, real handwritten codes, and real photographs. The browser pane has no camera, so every browser test used a stand-in camera stream installed in the page context.
- Wallets other than the one the maintainer tried. Wallet connection was verified with a mock wallet that signs like one (a job deployed through `eth_sendTransaction` recorded the wallet as payer) and then used by the maintainer with a real browser wallet; the GenLayer Snap is not requested. Other browsers, desktop layout and accessibility checks are untested.
- Anything with real value.
