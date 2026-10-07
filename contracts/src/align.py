def _gray(png, side):
    import io
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(png))
    img.load()
    img = img.convert("L").resize((side, side), Image.BILINEAR)
    return np.asarray(img, dtype=np.int32)


def _edges(a):
    import numpy as np

    gx = np.abs(a[:-1, 1:] - a[:-1, :-1])
    gy = np.abs(a[1:, :-1] - a[:-1, :-1])
    e = gx + gy
    flat = np.sort(e.ravel())
    thr = int(flat[int(len(flat) * 0.8)])
    return e > thr


def alignment_permille(anchor_png, shot_png, side=64, max_shift=6):
    """Integer-only structural overlap of edge maps, best over small shifts. 0..1000.

    Deterministic by construction (integer arithmetic, fixed resize). UNCALIBRATED: the
    threshold must be set from real honest and dishonest frames before it is enforced.
    """
    import numpy as np

    a = _edges(_gray(anchor_png, side))
    b = _edges(_gray(shot_png, side))
    n = a.shape[0]
    best = 0
    for dy in range(-max_shift, max_shift + 1):
        for dx in range(-max_shift, max_shift + 1):
            ay0, ay1 = max(0, dy), min(n, n + dy)
            ax0, ax1 = max(0, dx), min(n, n + dx)
            aa = a[ay0:ay1, ax0:ax1]
            bb = b[ay0 - dy:ay1 - dy, ax0 - dx:ax1 - dx]
            inter = int(np.logical_and(aa, bb).sum())
            union = int(np.logical_or(aa, bb).sum())
            if union > 0:
                score = inter * 1000 // union
                if score > best:
                    best = score
    return best
