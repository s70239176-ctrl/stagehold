"""Builds a stateless probe contract that asks the validator panel the same-site question about two images,
using exactly the prompt and parser that the real contract embeds (study/prompt.py)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "study", "prompt.py"), encoding="utf-8").read().split('"""', 2)[2]
hdr = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }\nfrom genlayer import *\nimport base64\nimport json\n'
body = '''

class Probe(gl.Contract):
    last: str

    def __init__(self):
        self.last = ""

    @gl.public.write
    def compare(self, anchor_b64: str, frame_b64: str) -> str:
        anchor = base64.b64decode(anchor_b64)
        frame = base64.b64decode(frame_b64)
        prompt = build_site_prompt()

        def leader_fn():
            raw = gl.nondet.exec_prompt(prompt, images=[anchor, frame], response_format="json")
            return parse_site(raw)

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            return leader_fn() == leader_res.calldata

        verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.last = json.dumps({"same_site": verdict})
        return self.last

    @gl.public.view
    def get_last(self) -> str:
        return self.last
'''
os.makedirs(os.path.join(ROOT, "calibration"), exist_ok=True)
open(os.path.join(ROOT, "calibration", "site_probe.py"), "w", encoding="utf-8").write(hdr + src + body)
print("ok")
