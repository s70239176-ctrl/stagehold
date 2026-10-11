# Realistic photograph tests

Eleven genuine construction-site photographs put through the real validators on Studionet with the exact prompt and parser the contract embeds (`study/prompt.py`, through a stateless probe, `calibration/judge_probe.py`). For each, the stage asked about and the code the validators were told to look for are given, together with what a person looking at the photograph would expect. **The expectations were written down before the validators were asked** (`calibration/build_photo_cases.py`). Agreement is reported as it came out; nothing was tuned afterwards.

**What is real and what is simulated.** The photographs are genuine (Wikimedia Commons, credits below). The code on the wall is **simulated lettering**: a handwriting-style font with jitter, blur and wear drawn onto the photograph. It is not a human hand on a real wall; photographs of true handwriting have not been run yet. Darkening and cropping are applied in software.

| Case | Photograph and what was done to it | Stage asked | Expected (stage / code) | Validators said | Agreement | Votes |
|---|---|---|---|---|---|---|
| P01 | Mud house with iron-sheet roof, right code on the wall | roof | yes / yes | yes / yes | yes | {"idle": 2, "agree": 3} |
| P02 | Brick house with a complete roof covering, right code on the brick gable | roof | yes / yes | yes / yes | yes | {"agree": 3, "idle": 1, "disagree": 1} |
| P03 | Brick wall with no roof at all, right code on the wall | roof | no / yes | no / yes | yes | {"agree": 3, "idle": 2} |
| P04 | A town street from above, right code on a building | roof | no / yes | no / yes | yes | {"agree": 3, "disagree": 2} |
| P05 | Mud-walled compound with no roof, right code on a wall | roof | no / yes | no / yes | yes | {"agree": 3, "idle": 2} |
| P06 | Mud house with roof, a WRONG code on the wall | roof | yes / no | yes / no | yes | {"agree": 3, "idle": 1, "disagree": 1} |
| P07 | Mud house with roof, no code anywhere | roof | yes / no | yes / no | yes | {"idle": 1, "agree": 3, "disagree": 1} |
| P08 | Mud house with roof, right code, but the photograph is nearly black | roof | unclear / unclear | unclear / unclear | yes | {"agree": 3, "idle": 2} |
| P09 | Right code visible but the roof is cropped out of the frame | roof | no / yes | unclear / no | **no** | {"idle": 1, "agree": 3, "disagree": 1} |
| P10 | Finished office building, glazing in every opening, right code on the white wall | openings | yes / yes | yes / yes | yes | {"agree": 3, "idle": 2} |
| P11 | Brick wall whose window openings are empty holes, right code on the wall | openings | no / yes | no / yes | yes | {"agree": 3, "disagree": 1, "idle": 1} |

**10 of 11 cases matched the expectation on both questions.**

Reading the table:

- A wrong code, no code, a nearly black frame and a frame with the roof cropped out must never pay. Check the corresponding rows: a pass needs both answers `yes`.
- Where the validators and the author's reading differ, the row says so; a disagreement on a borderline photograph (an unfinished building under a roof, for example) is information about the stage wording, not a failure of the contract, which fails closed on `no`, `unclear` and malformed answers.
- Each row is one asked question. Panel votes (for example 3 agree, 2 idle) are the transaction's consensus record; every transaction hash is in `calibration/results/photo_results.json`.

The same photographs also run through the full product (deposit, fund, code, signed frame, panel, payout) in [EVIDENCE.md](EVIDENCE.md), and the site check has its own calibration in [SITE_VERIFICATION.md](SITE_VERIFICATION.md).

## Photograph sources

| Case | Photograph | Author | Licence |
|---|---|---|---|
| P01 | Mud House with Iron Sheet Roof.jpg | Nabunje Leticia | CC BY-SA 4.0 |
| P02 | Paa la nyumba Eyasi.jpg | Masele Czeus25 | CC BY-SA 4.0 |
| P03 | House Building.jpg | Munu-Muti | CC BY-SA 4.0 |
| P04 | Ardhi house as seen from the roof of Guru Nanak.jpg | David Bett | CC BY-SA 3.0 |
| P05 | A compound mud house under construction in Ghana.jpg | Hasslaebetch | CC BY-SA 4.0 |
| P06 | Mud House with Iron Sheet Roof.jpg | Nabunje Leticia | CC BY-SA 4.0 |
| P07 | Mud House with Iron Sheet Roof.jpg | Nabunje Leticia | CC BY-SA 4.0 |
| P08 | Mud House with Iron Sheet Roof.jpg | Nabunje Leticia | CC BY-SA 4.0 |
| P09 | Mud House with Iron Sheet Roof.jpg | Nabunje Leticia | CC BY-SA 4.0 |
| P10 | Highland Colour Coaters Extension (under construction) 2 - geograph.org.uk - 2419306.jpg | Texas Radio and The Big Beat | CC BY-SA 2.0 |
| P11 | House Building.jpg | Munu-Muti | CC BY-SA 4.0 |

The photographs are not stored in this repository; fetch them from the Commons pages in the `ATTRIBUTION.csv` files.

## Reproduce

```bash
python calibration/build_photo_cases.py
python calibration/build_judge_probe.py
node calibration/run_judge_probe.mjs      # asks the validators on Studionet
python calibration/report_photos.py
```

