"""Small image helpers for the live Studionet scripts: a size-capped JPEG encoder and a chalk-text drawer."""

import io
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

MAX_BYTES = 150 * 1024


def font(size, bold=False):
    for name in ("segoepr.ttf", "ariblk.ttf" if bold else "arial.ttf", "arial.ttf"):
        path = os.path.join("C:\\Windows\\Fonts", name)
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def chalk(img, text, center, size, color=(245, 245, 235), angle=-3):
    """Draw hand-written-looking text directly on the work, with jitter, blur and some wear."""
    img = img.convert("RGBA")
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(size)
    rnd = random.Random(5)
    box = d.textbbox((0, 0), text, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    x0, y0 = center[0] - w // 2, center[1] - h // 2
    for _ in range(2):
        d.text((x0 + rnd.randint(-1, 1), y0 + rnd.randint(-1, 1)), text, font=f, fill=color + (225,))
    layer = layer.rotate(angle, center=center, resample=Image.BICUBIC)
    layer = layer.filter(ImageFilter.GaussianBlur(0.9))
    # wear: knock random speckles out of the paint
    px = layer.load()
    for _ in range(int(w * h * 0.04)):
        x, y = rnd.randint(0, img.size[0] - 1), rnd.randint(0, img.size[1] - 1)
        r, g, b, a = px[x, y]
        if a:
            px[x, y] = (r, g, b, int(a * 0.35))
    return Image.alpha_composite(img, layer).convert("RGB")


def prepare_frame(path):
    from PIL import Image

    img = Image.open(path).convert("RGB")
    long_edge = max(img.size)
    if long_edge > 1280:
        scale = 1280 / long_edge
        img = img.resize((round(img.size[0] * scale), round(img.size[1] * scale)), Image.LANCZOS)
    # Guarantee the size cap, as the real app must: lower the quality first, then shrink the image.
    quality = 80
    while True:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        data = buf.getvalue()
        if len(data) <= MAX_BYTES:
            return data
        if quality > 40:
            quality -= 5
        else:
            img = img.resize((round(img.size[0] * 0.88), round(img.size[1] * 0.88)), Image.LANCZOS)
            quality = 70


def block_thumb(jpeg_bytes):
    """The thumbnail the web client builds from the frame it submits: the decoded luma averaged in 8x8
    blocks (edge pixels repeated), as a grayscale PNG. The contract checks it against the JPEG itself."""
    import numpy as np

    g = np.asarray(Image.open(io.BytesIO(jpeg_bytes)).convert("L"), dtype=np.float32)
    h, w = g.shape
    rows, cols = (h + 7) // 8, (w + 7) // 8
    pad = np.pad(g, ((0, rows * 8 - h), (0, cols * 8 - w)), mode="edge")
    small = pad.reshape(rows, 8, cols, 8).mean(axis=(1, 3))
    buf = io.BytesIO()
    Image.fromarray(np.round(small).astype(np.uint8), "L").save(buf, format="PNG", optimize=True)
    return buf.getvalue()
