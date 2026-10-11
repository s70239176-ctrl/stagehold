"""Builds the realistic photograph tests: genuine construction-site photographs, some with the code lettered on the work
in a handwriting-style font (with jitter, blur and wear), some without, some darkened or cropped.

Each case says which stage is asked about, which code the validators are told to look for, and what a person
looking at the photograph would expect. The expectations are the author's reading of the pictures, set before
the validators are asked.     python calibration/build_photo_cases.py
"""
import io, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT + "/contracts/live")
from frames import chalk  # noqa: E402
from PIL import Image, ImageEnhance  # noqa: E402

OUT = ROOT + "/calibration/photos"
os.makedirs(OUT, exist_ok=True)

def find(prefix):
    for d in ("web2", "web", "sites"):
        for f in os.listdir(ROOT + "/fixtures/" + d):
            if f.startswith(prefix) and f.endswith(".jpg"):
                return ROOT + "/fixtures/%s/%s" % (d, f)
    raise KeyError(prefix)

def letter(img, words, spots, size, color=(245, 245, 235)):
    for word, (fx, fy) in zip(words.split(" "), spots):
        img = chalk(img, word, (round(fx * img.size[0]), round(fy * img.size[1])), round(size * img.size[0]), color=color)
    return img

def encode(img):
    im = img.convert("RGB")
    k = 1280 / max(im.size)
    if k < 1:
        im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    q = 80
    while True:
        b = io.BytesIO(); im.save(b, format="JPEG", quality=q); d = b.getvalue()
        if len(d) <= 150 * 1024:
            return d
        q -= 5 if q > 40 else 0
        if q <= 40:
            im = im.resize((round(im.size[0] * .88), round(im.size[1] * .88)), Image.LANCZOS); q = 70

MUD = ("w2_11_", [(0, 0)], 0)  # placeholder, lettering for the mud house uses the pixel coordinates below
def mud_house(code):
    img = Image.open(find("w2_11_")).convert("RGB")
    if code:
        words = code.split(" ")
        for word, y in zip(words, [1030, 1125]):
            img = chalk(img, word, (832, y), 74)
    return img

CASES = []
def case(cid, title, stage, code_asked, expect_stage, expect_code, img):
    open("%s/%s.jpg" % (OUT, cid), "wb").write(encode(img))
    CASES.append({"id": cid, "title": title, "stage": stage, "code_asked": code_asked, "expect_stage": expect_stage, "expect_code": expect_code})

CODE = "TREE BLUE"
case("P01", "Mud house with iron-sheet roof, right code on the wall", "roof", CODE, "yes", "yes", mud_house(CODE))
case("P02", "Brick house with a complete roof covering, right code on the brick gable", "roof", CODE, "yes", "yes",
     letter(Image.open(find("w2_12_")).convert("RGB"), CODE, [(0.43, 0.36), (0.43, 0.45)], 0.05))
case("P03", "Brick wall with no roof at all, right code on the wall", "roof", CODE, "no", "yes",
     letter(Image.open(find("w2_09_")).convert("RGB"), CODE, [(0.36, 0.26), (0.36, 0.34)], 0.11))
case("P04", "A town street from above, right code on a building", "roof", CODE, "no", "yes",
     letter(Image.open(find("w2_14_")).convert("RGB"), CODE, [(0.30, 0.62), (0.30, 0.71)], 0.06))
case("P05", "Mud-walled compound with no roof, right code on a wall", "roof", CODE, "no", "yes",
     letter(Image.open(find("w2_10_")).convert("RGB"), CODE, [(0.12, 0.32), (0.12, 0.41)], 0.05))
case("P06", "Mud house with roof, a WRONG code on the wall", "roof", CODE, "yes", "no", mud_house("MOON FISH"))
case("P07", "Mud house with roof, no code anywhere", "roof", CODE, "yes", "no", mud_house(None))
dark = ImageEnhance.Brightness(mud_house(CODE)).enhance(0.10)
case("P08", "Mud house with roof, right code, but the photograph is nearly black", "roof", CODE, "unclear", "unclear", dark)
m = mud_house(CODE)
case("P09", "Right code visible but the roof is cropped out of the frame", "roof", CODE, "no", "yes",
     m.crop((0, round(m.size[1] * 0.50), m.size[0], m.size[1])))
hs = Image.open(find("s11_")).convert("RGB")
case("P10", "Finished office building, glazing in every opening, right code on the white wall", "openings", CODE, "yes", "yes",
     letter(hs, CODE, [(0.14, 0.355), (0.14, 0.405)], 0.045, color=(25, 30, 45)))  # dark marker on a white wall
case("P11", "Brick wall whose window openings are empty holes, right code on the wall", "openings", CODE, "no", "yes",
     letter(Image.open(find("w2_09_")).convert("RGB"), CODE, [(0.36, 0.26), (0.36, 0.34)], 0.11))
json.dump(CASES, open(OUT + "/cases.json", "w"), indent=1)
print(len(CASES), "cases")
