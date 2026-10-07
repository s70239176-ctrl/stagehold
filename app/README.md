# Stagehold capture app (Android) and phone test

> **PAUSED.** The web version comes first (`web/`). This Android app is on the roadmap as a mainnet gate:
> real value only moves in jobs that require an attested key. Everything below is kept so the work resumes
> where it stopped. The contract still supports attested keys (`register_device`); web jobs use
> `register_software_key` and are visibly unattested.

**Status: the Kotlin app in `app/android/` is a DRAFT. It has never been compiled or run.** There is no Android toolchain on the machine this was written on. Expect to fix compile errors on the first build. Everything under `app/tools/` is tested (see below).

## What the app does, and does not

It does the one thing no web page can: **sign a photo inside the phone's secure hardware**.

1. **Create device key** — makes a P-256 key inside the phone's secure hardware (StrongBox if present, otherwise the TEE), bound to one job by the attestation challenge `sha256(contract_lower + ":" + builder_lower)`. It exports the attested certificate chain as `device.json`.
2. **Signed shot** — takes a picture, re-encodes it to a JPEG of at most 150 KB plus a grayscale PNG thumbnail of at most 30 KB (from the same capture), and signs `stagehold.v1|<contract>|<stage>|<code>|<deadline>|<sha256 jpeg>|<sha256 thumb>` (SHA256withECDSA). It exports `shot.json`.
3. **Anchor** — the payer's anchor thumbnail as a PNG (no signature needed).

It does **not** talk to the chain. Files are shared from private storage (no gallery, no storage permission). Submitting is done by `app/tools/submit_package.mjs`, which keeps wallet code out of the phone.

## What the key proves, and what it cannot

- Proves: the key lives in secure hardware on a device in a locked, verified-boot state, running an app with the expected package and signing certificate.
- Does **not** prove the pixels came from the camera sensor. A rooted or hooked phone, or a camera pointed at a screen or print, is still possible. The contract states no defense against generated images beyond this.
- An emulator or a phone with an unlocked bootloader fails the contract's checks by design.

## Phone test, step by step

Requirements: an Android phone (API 28 or newer) with a locked bootloader, a USB cable or Wi-Fi debugging, and Android Studio on the computer.

1. **Open `app/android/` in Android Studio** and let it sync (it creates the Gradle wrapper). Build. Fix any compile errors, then run it on the phone.
2. **Deploy a dev job** (needs a clear photo of the wall as the anchor; the default anchor is a test image):
   `node app/tools/deploy_job.mjs --anchor path\to\anchor.png --code "DUCK MOON"`
   It prints the contract address, builder address, code and deadline. Throwaway keys are saved to `app/tools/.testkeys.json`.
   *(Optional: take the anchor with app button 3 and share `anchor.png` to the computer first.)*
3. **In the app**, enter the contract, builder, stage, code and deadline. Tap **1** and share `device.json` to the computer.
4. **Check it offline first:**
   `python app/tools/check_package.py device device.json --contract <contract> --builder <builder>`
   It prints what the phone attested (levels, boot state, package, signing digest) and whether `register_device` would accept it. If it says REJECT, read the reason; do not submit.
5. **Register:** `node app/tools/submit_package.mjs --throwaway register device.json`
6. **Write the code on the real work** (chalk or marker, on the wall itself, not over plants), tap **2** and share `shot.json`.
7. **Check:** `python app/tools/check_package.py shot shot.json --device device.json`
8. **Submit:** `node app/tools/submit_package.mjs --throwaway submit shot.json`, then watch `node app/tools/submit_package.mjs --throwaway status <contract>`. A pass shows the stage settling, then paid after finality. Payment is visible as the contract's balance falling, not as a credit to the builder account (this Studionet does not credit ordinary accounts).

For a job that locks the app (not dev mode), deploy with `--lock-app <package> <signing-digest-hex>`; step 4 prints the digest the installed build actually has.

## What is tested here

- `check_package.py` accepts a real Google sample chain as of its own date and rejects it for a wrong challenge or today's expired date; it accepts a good shot package and rejects five deliberately bad ones (bad signature, signed for another code, oversize, not a JPEG, wrong key).
- The contract paths the app output feeds into have run live on Studionet (see `docs/TRD.md`).

## What is not tested

- The Android app itself (compilation, key attestation on a real phone, CameraX capture, sharing).
- Whether a real phone's chain anchors to one of the two Google roots the contract trusts.
- Real handwritten codes on real walls, and the real-photo judge gate.
- Alignment (still off) with a real anchor and real shots.
