# Site verification: calibration on genuine photographs

Two mechanisms can tell whether a builder's photograph shows the payer's anchor site. Both were tested on the same **26 pairs of genuine photographs**: 12 pairs of the same construction site and 14 pairs of unrelated sites, 5 of them deliberately look-alike (two different houses under construction, two different roof-truss sites, and so on). The photographs are real; none is generated or edited. Sources and licences are listed at the end.

## What was tested

1. **Deterministic alignment** (`contracts/src/align.py`, present since the first version): an integer edge-overlap score between the anchor and the frame's thumbnail, best over small shifts. It needs a threshold, and `align_min_permille = 0` switched it off.
2. **Panel same-site question** (new): the validators are shown the anchor and the frame and answer `same_site` with `yes`, `no` or `unclear` (`study/prompt.py`, `build_site_prompt`). The frame passes the site check only on `yes`; `no`, `unclear` and any malformed answer refuse it.

Matching pairs are labelled by what a builder could actually do: **same spot** (similar viewpoint, different stage or time; 9 pairs) and **other angle** (same site, a different viewpoint; 3 pairs). Labels were set by looking at the photographs before any score was computed.

## Result 1: the deterministic alignment cannot be calibrated

| | Pairs | Lowest | Median | Highest |
|---|---|---|---|---|
| Same site | 12 | 133 | 180 | 214 |
| Unrelated | 14 | 122 | 158 | 234 |

The ranges overlap almost completely. The chance that a matching pair scores above an unrelated one (AUC) is **0.57**, where 0.50 is a coin flip. The best single threshold (185) accepts 50% of the matching pairs and still accepts 21% of the unrelated ones. A photograph is never pixel-aligned with an earlier one of the same site: the stage changes the scene, and a hand-held camera moves. Only a fixed camera would separate the two, and no threshold works for people. **The mechanism stays off, and the contract no longer relies on it.** (It is still available through `align_min_permille` for jobs that use a fixed camera; it has not been calibrated for any other use.)

## Result 2: the panel's same-site question separates them

Run on Studionet through a probe contract that uses exactly the prompt and parser the real contract embeds, with real validators. Every pair was asked twice, in two separate runs.

| | Pairs | yes | unclear | no |
|---|---|---|---|---|
| Same site, run 1 | 12 | 10 | 1 | 1 |
| Same site, run 2 | 12 | 8 | 3 | 1 |
| Unrelated, run 1 | 14 | 0 | 1 | 13 |
| Unrelated, run 2 | 14 | 0 | 1 | 13 |

- **False accepts: 0 of 28** unrelated answers were `yes` (a frame from a different site would have been accepted). With this few pairs that supports "rare", not "never": 0 of 28 leaves a plausible true rate up to about 10% (rule of three, 3/28).
- **Same site accepted: 18 of 24** answers (75%); same spot 15 of 18. A same-site frame that gets `no` or `unclear` is refused and the builder may shoot again from the anchor's spot; the failure is a delay, not a loss.
- Hard look-alike negatives (two different houses under construction and similar): see the table.

### Every pair

| Pair | What it is | Class | Edge-overlap score | Panel run 1 | Panel run 2 |
|---|---|---|---|---|---|
| M1 | Highland Colour Coaters extension, steel frame then finished (same spot) | M spot | 211 | yes | yes |
| M2 | Site 33W, October 2010 then January 2011 (same vantage) | M spot | 190 | yes | yes |
| M3 | Liversedge cemetery field, June 2021, two shots | M spot | 138 | yes | unclear |
| M4 | Liversedge cemetery field, March then June 2021 | M spot | 166 | yes | yes |
| M5 | Liversedge cemetery field, November 2020 then March 2021 | M spot | 200 | yes | yes |
| M6 | Cowes Esplanade, the blue container, May then August 2010 | M spot | 170 | yes | yes |
| M7 | Cowes Esplanade, piling rig and church, May 2010 | M spot | 214 | yes | yes |
| M8 | Cowes Esplanade, hoarding in 2010 then the frame in 2011 (other angle) | M angle | 195 | yes | yes |
| M9 | Fanshawe Road, the gate then the scaffolded houses (other angle) | M angle | 161 | yes | unclear |
| M10 | Two photographs of the same house under construction (Ted) | M spot | 136 | unclear | unclear |
| M11 | Two photographs of the same residential site (Maina Pat Mbae) | M spot | 133 | yes | yes |
| M12 | Liversedge cemetery, cleared land then field (other angle) | M angle | 194 | no | no |
| U1 | Highland building vs Site 33W | U | 170 | no | no |
| U2 | Liversedge field vs Cowes container | U | 156 | no | no |
| U3 | Highland finished building vs Cowes frame | U | 199 | no | no |
| U4 | Liversedge field vs Fanshawe houses | U | 142 | no | no |
| U5 | Liversedge field vs Cowes piling rig | U | 150 | no | no |
| U6 | Site 33W vs Fanshawe gate | U | 175 | no | no |
| U7 | Liversedge pond field vs Cowes container | U | 157 | no | no |
| U8 | Cowes piling rig vs Site 33W | U | 160 | no | no |
| U9 | Liversedge field vs Site 33W | U | 181 | no | no |
| U10 | Two different houses under construction | U hard | 150 | unclear | unclear |
| U11 | Two different houses under construction (Kwameghana) | U hard | 234 | no | no |
| U12 | Roof trusses at two different sites | U hard | 234 | no | no |
| U13 | Two different roofed houses | U hard | 122 | no | no |
| U14 | Scaffolded houses at two different sites | U hard | 151 | no | no |

The panel's own votes (for example 3 agree, 2 idle) are in `calibration/results/panel_results_run1.json` and `_run2.json`, with every transaction hash.

## What this does and does not establish

- It is a small set (26 pairs, 5 repeat-photographed sites plus local fixtures), asked twice. It is a calibration, not a guarantee.
- The validators' models are chosen by the network for each transaction. Different panels can answer differently; the contract fails closed on any answer other than `yes`.
- The anchor and the frame are both public. A builder who obtains a genuine photograph of the real site (or an edited copy of the anchor) and letters the code on it is not stopped by this check. The site check stops a photograph of the wrong place; it does not prove the photograph is live (that is the capture limitation in [TRUST_MODEL.md](TRUST_MODEL.md)).
- The check judges surroundings, not the stage; the stage question is separate and both must be `yes`.
- Hand-held repeat photographs of one site from very different angles and stages are the hard case (M12 here). The anchor hint in the payer page asks the payer to photograph from where the builder will stand.

## What the frontend says

- A job with the check on shows **Site check on** on every page, and each result card has a *Same site as the anchor* row with the panel's answer.
- A job created without it (an option under *Advanced* on the payer page) shows **Site not checked** on every page, and the result row reads *Not checked yet*. Jobs made before this change show the same.

## Reproduce

```bash
python calibration/make_pairs.py            # builds the pairs from fixtures/
python calibration/align_calibration.py     # deterministic scores, AUC
python calibration/build_site_probe.py      # the probe contract (study/prompt.py wording)
node calibration/run_site_probe.mjs calibration/results/panel_results_run1.json   # asks the validators, on Studionet
python calibration/report.py                # this file
```

## Photograph sources

All are on Wikimedia Commons under the licence shown; authors and links are in `fixtures/sites/ATTRIBUTION.csv`, `fixtures/web/ATTRIBUTION.csv` and `fixtures/web2/ATTRIBUTION.csv`. The photographs are not stored in this repository.

| Pair | Anchor | Frame |
|---|---|---|
| M1 | Highland Colour Coaters Extension (under constru (Texas Radio and The Big Beat, CC BY-SA 2.0) | Highland Colour Coaters Extension (under constru (Texas Radio and The Big Beat, CC BY-SA 2.0) |
| M2 | Progress on Site 33W (5141797618).jpg (Atomic Taco from Seattle, WA, USA, CC BY-SA 2.0) | Progress on Site 33W (5353959580).jpg (Atomic Taco from Seattle, WA, USA, CC BY-SA 2.0) |
| M3 | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) |
| M4 | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) |
| M5 | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) |
| M6 | Cowes Esplanade development building works in Ma (Editor5807, CC BY 3.0) | Cowes Esplanade development building works.JPG (Arriva436, CC BY 3.0) |
| M7 | Cowes Esplanade development building works in Ma (Editor5807, CC BY 3.0) | Cowes Esplanade development building works in Ma (Editor5807, CC BY 3.0) |
| M8 | Cowes Esplanade development building works 2.JPG (Arriva436, CC BY 3.0) | Cowes Esplanade development building works in Fe (Editor5807, CC BY 3.0) |
| M9 | Fanshawe Road, new houses taking shape - geograp (John Sutton, CC BY-SA 2.0) | Fanshawe Road, new houses taking shape - geograp (John Sutton, CC BY-SA 2.0) |
| M10 | House under construction (3799169525).jpg (Ted, CC BY-SA 2.0) | House under construction (3799173499).jpg (Ted, CC BY-SA 2.0) |
| M11 | Men at work in a residential house construction  (Maina Pat Mbae, CC BY-SA 4.0) | Masions working at residential house constructio (Maina Pat Mbae, CC BY-SA 4.0) |
| M12 | Land being prepared for the Liversedge Cemetery  (habiloid, CC BY-SA 2.0) | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) |
| U1 | Highland Colour Coaters Extension (under constru (Texas Radio and The Big Beat, CC BY-SA 2.0) | Progress on Site 33W (5141797618).jpg (Atomic Taco from Seattle, WA, USA, CC BY-SA 2.0) |
| U2 | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) | Cowes Esplanade development building works in Ma (Editor5807, CC BY 3.0) |
| U3 | Highland Colour Coaters Extension (under constru (Texas Radio and The Big Beat, CC BY-SA 2.0) | Cowes Esplanade development building works in Fe (Editor5807, CC BY 3.0) |
| U4 | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) | Fanshawe Road, new houses taking shape - geograp (John Sutton, CC BY-SA 2.0) |
| U5 | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) | Cowes Esplanade development building works in Ma (Editor5807, CC BY 3.0) |
| U6 | Progress on Site 33W (5353959580).jpg (Atomic Taco from Seattle, WA, USA, CC BY-SA 2.0) | Fanshawe Road, new houses taking shape - geograp (John Sutton, CC BY-SA 2.0) |
| U7 | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) | Cowes Esplanade development building works.JPG (Arriva436, CC BY 3.0) |
| U8 | Cowes Esplanade development building works in Ma (Editor5807, CC BY 3.0) | Progress on Site 33W (5141797618).jpg (Atomic Taco from Seattle, WA, USA, CC BY-SA 2.0) |
| U9 | Liversedge Cemetery extension under construction (habiloid, CC BY-SA 2.0) | Progress on Site 33W (5353959580).jpg (Atomic Taco from Seattle, WA, USA, CC BY-SA 2.0) |
| U10 | House under construction (3799169525).jpg (Ted, CC BY-SA 2.0) | Men at work in a residential house construction  (Maina Pat Mbae, CC BY-SA 4.0) |
| U11 | Modern house under construction.jpg (Kwameghana, CC BY-SA 4.0) | House under construction in the North.jpg (Kwameghana, CC BY-SA 4.0) |
| U12 | Roof truss delivery - geograph.org.uk - 3828329. (Michael Trolove, CC BY-SA 2.0) | Roof trusses on Helix House - geograph.org.uk -  (John Sutton, CC BY-SA 2.0) |
| U13 | Mud House with Iron Sheet Roof.jpg (Nabunje Leticia, CC BY-SA 4.0) | Paa la nyumba Eyasi.jpg (Masele Czeus25, CC BY-SA 4.0) |
| U14 | Fanshawe Road, new houses taking shape - geograp (John Sutton, CC BY-SA 2.0) | Flat House under construction.jpg (Tamdra, CC BY-SA 4.0) |
