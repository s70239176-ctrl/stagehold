# study/

`prompt.py` holds the stage wording and the judging prompt that the contract sends to the validators, plus the strict parser for their JSON answer (`stage_met` and `code_visible`, each `yes`, `no` or `unclear`; anything else counts as `unclear`).

It is the single source for the contract: `python contracts/build.py` embeds it into `contracts/stagehold.py`, and `tests/test_pure.py` checks that the two prompts are identical. Change the wording here, rebuild, and re-test on Studionet.
