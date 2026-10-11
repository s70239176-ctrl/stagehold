"""Pure-Python reader for the DC (brightness-per-8x8-block) image of a baseline JPEG.

The GenVM runtime has no JPEG codec, so the contract cannot decode a frame. It does not need to: the
DC coefficient of every luma block is the block's average brightness, which gives a one-eighth-size
grayscale picture of the frame. That is enough to check that the alignment thumbnail the builder
sends really is a small copy of the JPEG that the panel judges. Deterministic, no randomness.

Accepts baseline (SOF0/SOF1) sequential Huffman JPEGs with one or three components, any sampling
factors, optional restart intervals. Anything else raises ValueError.
"""


def _u16(b, i):
    return (b[i] << 8) | b[i + 1]


def _build_huffman(counts, symbols):
    """Canonical Huffman table: an 8-bit lookahead for short codes and the spec's slow path for the rest."""
    lut = [None] * 256
    mincode = [0] * 18
    maxcode = [-1] * 18
    valptr = [0] * 18
    code = 0
    k = 0
    for ln in range(1, 17):
        valptr[ln] = k
        mincode[ln] = code
        for _ in range(counts[ln - 1]):
            if ln <= 8:
                base = code << (8 - ln)
                for fill in range(1 << (8 - ln)):
                    lut[base + fill] = (ln, symbols[k])
            code += 1
            k += 1
        maxcode[ln] = code - 1 if counts[ln - 1] else -1
        code <<= 1
    return lut, mincode, maxcode, valptr, symbols


def parse_jpeg_dc(data):
    """Returns (width, height, luma) where luma is a list of rows of 0..255 block averages,
    ceil(height/8) rows of ceil(width/8) values."""
    n = len(data)
    if n < 4 or data[0] != 0xFF or data[1] != 0xD8:
        raise ValueError("not a JPEG")
    i = 2
    qdc = {}
    huff = {}
    frame = None
    restart = 0
    scan = None
    while i < n:
        if data[i] != 0xFF:
            raise ValueError("bad marker")
        while i < n and data[i] == 0xFF:
            i += 1
        m = data[i]
        i += 1
        if m == 0xD9:
            raise ValueError("no scan before end of image")
        if m == 0x01 or 0xD0 <= m <= 0xD7:
            continue
        ln = _u16(data, i)
        seg = data[i + 2:i + ln]
        i += ln
        if m == 0xDB:
            p = 0
            while p < len(seg):
                pq, tq = seg[p] >> 4, seg[p] & 15
                if pq == 0:
                    qdc[tq] = seg[p + 1]
                    p += 65
                else:
                    qdc[tq] = _u16(seg, p + 1)
                    p += 129
        elif m in (0xC0, 0xC1):
            if seg[0] != 8:
                raise ValueError("only 8-bit JPEG")
            height, width, nf = _u16(seg, 1), _u16(seg, 3), seg[5]
            if nf not in (1, 3) or width < 1 or height < 1:
                raise ValueError("unsupported components")
            comps = []
            for c in range(nf):
                cid, hv, tq = seg[6 + 3 * c], seg[7 + 3 * c], seg[8 + 3 * c]
                comps.append((cid, hv >> 4, hv & 15, tq))
            frame = (width, height, comps)
        elif 0xC2 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
            raise ValueError("only baseline JPEG is supported")
        elif m == 0xC4:
            p = 0
            while p < len(seg):
                tc, th = seg[p] >> 4, seg[p] & 15
                counts = list(seg[p + 1:p + 17])
                total = sum(counts)
                huff[(tc, th)] = _build_huffman(counts, list(seg[p + 17:p + 17 + total]))
                p += 17 + total
        elif m == 0xDD:
            restart = _u16(seg, 0)
        elif m == 0xDA:
            if frame is None:
                raise ValueError("scan before frame")
            ns = seg[0]
            sel = []
            for c in range(ns):
                sel.append((seg[1 + 2 * c], seg[2 + 2 * c] >> 4, seg[2 + 2 * c] & 15))
            if ns != len(frame[2]):
                raise ValueError("multiple scans are not supported")
            scan = (sel, i)
            break
    if scan is None or frame is None:
        raise ValueError("no scan")
    width, height, comps = frame
    sel, start = scan
    for (cid, td, ta), (fid, _, _, _) in zip(sel, comps):
        if cid != fid:
            raise ValueError("scan component order")
    # entropy-coded data: from `start` to the next marker that is neither a stuffed zero nor RSTn
    j = start
    segments = []
    seg_start = start
    while j < n - 1:
        if data[j] == 0xFF:
            nx = data[j + 1]
            if nx == 0x00 or nx == 0xFF:
                j += 2 if nx == 0 else 1
                continue
            if 0xD0 <= nx <= 0xD7:
                segments.append(data[seg_start:j])
                j += 2
                seg_start = j
                continue
            break
        j += 1
    segments.append(data[seg_start:j])
    segments = [s.replace(b"\xff\x00", b"\xff") + b"\x00\x00\x00\x00\x00" for s in segments]

    if len(comps) == 1:
        hmax = vmax = 1
        mcu_w = mcu_h = 8
        bw_mcu = bh_mcu = 1
        ncols = (width + 7) // 8
        nrows = (height + 7) // 8
        h0, v0 = 1, 1
    else:
        h0, v0 = comps[0][1], comps[0][2]
        hmax = max(c[1] for c in comps)
        vmax = max(c[2] for c in comps)
        if h0 != hmax or v0 != vmax or h0 < 1 or v0 < 1:
            raise ValueError("unsupported sampling")
        ncols = (width + 8 * hmax - 1) // (8 * hmax)
        nrows = (height + 8 * vmax - 1) // (8 * vmax)
    gw = ncols * h0
    gh = nrows * v0
    grid = [[0] * gw for _ in range(gh)]
    q0 = qdc.get(comps[0][3], 1)

    tables = []
    for (cid, td, ta) in sel:
        tables.append((huff[(0, td)], huff[(1, ta)]))
    layout = []
    for idx, (cid, h, v, tq) in enumerate(comps):
        if len(comps) == 1:
            h = v = 1
        layout.append((h, v))

    mcus_total = ncols * nrows
    mcu = 0
    seg_i = 0
    while mcu < mcus_total:
        if seg_i >= len(segments):
            raise ValueError("entropy data ended early")
        buf = segments[seg_i]
        blen = len(buf)
        seg_i += 1
        count = restart if restart else mcus_total
        pos = 0
        acc = 0
        nbits = 0
        preds = [0] * len(comps)
        done = 0
        while done < count and mcu < mcus_total:
            my, mx = divmod(mcu, ncols)
            for ci in range(len(comps)):
                (dlut, dmin, dmax, dptr, dsyms), (alut, amin, amax, aptr, asyms) = tables[ci]
                hh, vv = layout[ci]
                for by in range(vv):
                    for bx in range(hh):
                        # ---- DC
                        while nbits < 16:
                            if pos + 4 > blen:
                                raise ValueError("entropy data truncated")
                            acc = ((acc & ((1 << nbits) - 1)) << 32) | int.from_bytes(buf[pos:pos + 4], "big")
                            nbits += 32
                            pos += 4
                        e = dlut[(acc >> (nbits - 8)) & 0xFF]
                        if e is not None:
                            nbits -= e[0]
                            s = e[1]
                        else:
                            ln = 9
                            code = (acc >> (nbits - 9)) & 0x1FF
                            while ln <= 16 and (dmax[ln] < 0 or code > dmax[ln]):
                                ln += 1
                                code = (acc >> (nbits - ln)) & ((1 << ln) - 1) if ln <= 16 else 0
                            if ln > 16:
                                raise ValueError("bad DC code")
                            s = dsyms[dptr[ln] + code - dmin[ln]]
                            nbits -= ln
                        if s:
                            if s > 11:
                                raise ValueError("bad DC size")
                            while nbits < s:
                                if pos + 4 > blen:
                                    raise ValueError("entropy data truncated")
                                acc = ((acc & ((1 << nbits) - 1)) << 32) | int.from_bytes(buf[pos:pos + 4], "big")
                                nbits += 32
                                pos += 4
                            bits = (acc >> (nbits - s)) & ((1 << s) - 1)
                            nbits -= s
                            diff = bits if bits >= (1 << (s - 1)) else bits - (1 << s) + 1
                            preds[ci] += diff
                        if ci == 0:
                            grid[my * v0 + by][mx * h0 + bx] = preds[0]
                        # ---- AC (decoded and discarded: only DC is kept)
                        k = 1
                        while k < 64:
                            while nbits < 16:
                                if pos + 4 > blen:
                                    raise ValueError("entropy data truncated")
                                acc = ((acc & ((1 << nbits) - 1)) << 32) | int.from_bytes(buf[pos:pos + 4], "big")
                                nbits += 32
                                pos += 4
                            e = alut[(acc >> (nbits - 8)) & 0xFF]
                            if e is not None:
                                nbits -= e[0]
                                rs = e[1]
                            else:
                                ln = 9
                                code = (acc >> (nbits - 9)) & 0x1FF
                                while ln <= 16 and (amax[ln] < 0 or code > amax[ln]):
                                    ln += 1
                                    code = (acc >> (nbits - ln)) & ((1 << ln) - 1) if ln <= 16 else 0
                                if ln > 16:
                                    raise ValueError("bad AC code")
                                rs = asyms[aptr[ln] + code - amin[ln]]
                                nbits -= ln
                            sz = rs & 15
                            if sz == 0:
                                if rs == 0xF0:
                                    k += 16
                                    continue
                                break
                            k += (rs >> 4) + 1
                            while nbits < sz:
                                if pos + 4 > blen:
                                    raise ValueError("entropy data truncated")
                                acc = ((acc & ((1 << nbits) - 1)) << 32) | int.from_bytes(buf[pos:pos + 4], "big")
                                nbits += 32
                                pos += 4
                            nbits -= sz
            mcu += 1
            done += 1
    rows = (height + 7) // 8
    cols = (width + 7) // 8
    out = []
    for y in range(rows):
        row = grid[y]
        out.append([max(0, min(255, int(round(row[x] * q0 / 8.0 + 128)))) for x in range(cols)])
    return width, height, out


# The alignment thumbnail must be a small copy of the very frame the panel judges. The client builds it by
# averaging the decoded frame in 8x8 blocks, so it should match the frame's DC image to within a few grey
# levels; a thumbnail of some other picture is far away. Integer arithmetic only, so every validator agrees.
MAX_THUMB_MAD_X10 = 40


def thumb_matches(jpeg, thumb_png):
    """Returns (ok, reason, mean_abs_diff_x10)."""
    import io
    import numpy as np
    from PIL import Image

    try:
        w, h, luma = parse_jpeg_dc(jpeg)
    except ValueError as e:
        return False, "frame cannot be read: " + str(e), 0
    rows = len(luma)
    cols = len(luma[0])
    try:
        img = Image.open(io.BytesIO(thumb_png))
        img.load()
        g = img.convert("L")
    except Exception:  # noqa: BLE001
        return False, "thumbnail cannot be decoded", 0
    tw, th = g.size
    if abs(tw - cols) > 1 or abs(th - rows) > 1:
        return False, "thumbnail size does not match the frame", 0
    a = np.asarray(g, dtype=np.int32)
    b = np.array(luma, dtype=np.int32)
    r = min(a.shape[0], b.shape[0])
    c = min(a.shape[1], b.shape[1])
    a = a[:r, :c]
    b = b[:r, :c]
    mad10 = int(np.abs(a - b).sum() * 10 // a.size)
    if mad10 > MAX_THUMB_MAD_X10:
        return False, "thumbnail does not match the frame", mad10
    return True, "", mad10
