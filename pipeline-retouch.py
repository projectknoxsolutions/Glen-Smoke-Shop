"""
The second compliance pass on the photographs.

Background — worth reading before changing anything here.

The owner's rule is: no prices on the site, anywhere. The first pass
(safe_crops.py) treated that as a framing problem: keep the shelf rail out of
frame, because the rail is where the hand-written tags live. That was true and
insufficient. A four-way visual audit of every shipped photograph at native
resolution found prices in twenty-six of twenty-eight frames, because this shop
does not price at the rail — it prices on the merchandise. Bright green
hand-written stickers sit on individual grinders, lighter rails, vape boxes and
cigar bundles, and several product cartons carry the price printed on the
packaging itself ("an ONLY-something starburst printed into the artwork" on a ZOUR display, "a printed multi-buy price" and "99¢" on Swisher
panels, "a printed price" on a VIVAZEN counter unit).

No crop fixes that. So this pass does three things instead of one:

  crop    trim an edge when every offender is on an edge
  patch   inpaint a rectangle when the offender is in the middle of the subject
  drop    when neither works, the photograph does not ship

The working line is legibility. A green rectangle a visitor cannot read is not
an advertised price; a legible "a printed price" is. Every `patch` below is a region I
looked at, magnified, and could read. Illegible sticker blobs are left alone —
removing all of them would mean retouching several hundred small regions across
the set and would leave the photographs looking scrubbed.

Two things are absolute and are removed regardless of legibility, because the
rule is about the thing being present, not about reading it:

  * nitrous product and branding (the nitrous charger brand, the nitrous brand on the exclusion list) — the owner's
    exclusion list
  * identifiable faces of staff or customers

One health claim is also removed: a counter display reading "MOOD LIFT + ENERGY
+ FOCUS" behind the botanical shelf. That is an effect claim on a kratom
product, which is the one thing a retailer in this category must never publish.

Coordinates are FRACTIONS of the source frame, applied before any resize, so
they survive a change of output width. `crop` is (left, top, right, bottom) to
KEEP. `patch` rectangles are (left, top, right, bottom) to inpaint, expressed
in the coordinates of the frame AFTER `crop` is applied — that is what you can
measure off a preview, and measuring off a preview is how these were found.

Usage:
    python3 pipeline/retouch.py --preview <slug>   # write /tmp/retouch/<slug>.jpg
    python3 pipeline/retouch.py                     # export everything
"""
import argparse
import json
import os
import subprocess
import sys

import cv2
import numpy as np

ROOT = "/home/claude/gss"
SPEC = os.path.join(ROOT, "pipeline", "retouch.json")
OUT = os.path.join(ROOT, "site", "public", "img")
PREVIEW = "/tmp/retouch"

# Where each source family lives, and what the site expects back from it.
FAMILY = {
    # The 6 Aug shoot: exported as <name>-960 / <name>-1600, jpg + avif.
    # `fullres` is on the path because IMG_6181 — the home page's Grinders tile,
    # which currently points at files that do not exist — is a 9 Aug frame that
    # was never given a shoot1-shaped derivative set.
    "shoot1": {"src": [os.path.join(ROOT, "assets", "master"), os.path.join(ROOT, "fullres")],
               "widths": [960, 1600], "formats": ["jpg", "avif"]},
    # The 9 Aug shoot: exported as <slug>-640/1100/1700 avif+webp, plus 1100 jpg.
    #
    # TWO source directories, in priority order, and this is not cosmetic.
    # Ten frames in this shoot were shot portrait with EXIF orientation 6, and
    # the first extraction pass wrote them out rotated 90 degrees. `fullres/`
    # still holds those sideways originals; `fullres2/` holds the six that were
    # re-extracted upright (see commit "Six photos were shipping sideways").
    # Every frame in `fullres/` measures 2600x1950, so a sideways one looks
    # exactly like a landscape one to anything that only reads dimensions —
    # which is how they shipped rotated the first time, and how two of the
    # agents measuring crop boxes for this pass measured them against a rotated
    # frame. Preferring fullres2 makes the mistake unrepeatable rather than
    # merely fixed.
    "shoot2": {"src": [os.path.join(ROOT, "fullres2"), os.path.join(ROOT, "fullres")],
               "widths": [640, 1100, 1700],
               "formats": ["avif", "webp"], "jpg_at": 1100},
}


def source_for(fam, name):
    """First directory in the family's search path that actually has the file."""
    dirs = FAMILY[fam]["src"]
    if isinstance(dirs, str):
        dirs = [dirs]
    for d in dirs:
        p = os.path.join(d, name + ".jpg")
        if os.path.exists(p):
            return p
    sys.exit(f"no source for {name} in {dirs}")


def load(path=None):
    with open(path or SPEC) as f:
        return json.load(f)


def rect(shape, box):
    h, w = shape[:2]
    l, t, r, b = box
    return (max(0, int(w * l)), max(0, int(h * t)),
            min(w, int(w * r)), min(h, int(h * b)))


def apply_ops(img, entry):
    """crop -> patch -> trim.

    `crop` is the framing the site already ships (for the 9 Aug set it is
    copied from shoot2.json, unchanged). `patch` and `trim` are both expressed
    in the coordinates of THAT frame, which is the frame the audit measured and
    the frame a preview shows. Trimming last is what makes those two coordinate
    systems the same one: if the trim ran first, every patch fraction would
    have to be re-derived by hand each time an edge moved, and it would be
    re-derived wrong.
    """
    if entry.get("crop"):
        l, t, r, b = rect(img.shape, entry["crop"])
        img = img[t:b, l:r]

    patches = entry.get("patch") or []
    if patches:
        mask = np.zeros(img.shape[:2], np.uint8)
        for p in patches:
            l, t, r, b = rect(img.shape, p)
            # A couple of pixels of margin: cv2.inpaint samples from the mask
            # boundary, and a mask cut exactly at the sticker edge samples the
            # sticker's own anti-aliased fringe and smears green outward.
            cv2.rectangle(mask, (max(0, l - 3), max(0, t - 3)),
                          (min(img.shape[1], r + 3), min(img.shape[0], b + 3)), 255, -1)
        img = cv2.inpaint(img, mask, 5, cv2.INPAINT_TELEA)

    # `soften` instead of `patch` where the sticker sits on printed artwork.
    #
    # TELEA reconstructs by pushing colour inward from the mask boundary along
    # isophotes. Over a flat red lighter rail that is invisible. Over a RAW
    # logo it produces a radial bowtie — a bright X straight through the
    # wordmark — which is far more conspicuous than the price it removed, and
    # unmistakably retouching. A feathered blur reads instead as a smudge on
    # the display glass, which is what these were shot through. It destroys the
    # digits, which is the whole requirement, and it does not invent structure.
    softs = entry.get("soften") or []
    if softs:
        out = img.astype(np.float32)
        for p in softs:
            l, t, r, b = rect(img.shape, p)
            w, h = r - l, b - t
            if w < 2 or h < 2:
                continue
            # Median colour of a ring just outside the sticker — the surface the
            # sticker is stuck to. Blurring alone left a bright green blob:
            # softer than TELEA's bowtie, and just as obviously a removed price.
            # What has to go is the sticker's COLOUR as much as its digits.
            pad = max(3, int(round(min(w, h) * 0.8)))
            oy0, oy1 = max(0, t - pad), min(img.shape[0], b + pad)
            ox0, ox1 = max(0, l - pad), min(img.shape[1], r + pad)
            ring = img[oy0:oy1, ox0:ox1].reshape(-1, 3)
            inner = img[t:b, l:r].reshape(-1, 3)
            n_ring = len(ring) - len(inner)
            if n_ring < 12:
                continue
            med = np.median(ring, axis=0).astype(np.float32)

            # Keep a trace of the surface's own texture at low contrast so the
            # result reads as glare on the display glass rather than a decal.
            reg = cv2.GaussianBlur(img[t:b, l:r].astype(np.float32), (0, 0),
                                   max(1.0, min(w, h) / 3.5))
            reg = med + (reg - reg.mean(axis=(0, 1))) * 0.22

            m = np.zeros((h, w), np.float32)
            cv2.rectangle(m, (0, 0), (w - 1, h - 1), 1.0, -1)
            k = int(max(1, round(min(w, h) * 0.45)) * 2 + 1)
            m = cv2.GaussianBlur(m, (k, k), 0)[..., None]
            out[t:b, l:r] = out[t:b, l:r] * (1 - m) + reg * m
        img = np.clip(out, 0, 255).astype(np.uint8)

    if entry.get("trim"):
        l, t, r, b = rect(img.shape, entry["trim"])
        img = img[t:b, l:r]
    return img


def export(name, img, fam):
    cfg = FAMILY[fam]
    h, w = img.shape[:2]
    written = []
    for tw in cfg["widths"]:
        # The FILENAME always uses the rung, the PIXELS are clamped to what the
        # crop actually has. Skipping a rung the image cannot fill was the
        # obvious reading — never upscale — but it silently leaves the previous
        # export's file on disk under that name, so a frame given a tighter crop
        # goes on serving its OLD, uncropped self at every width it outgrew.
        # (The first version of this clamp put the real width in the filename
        # instead, which wrote papers-case-843.avif and left the stale
        # papers-case-1700.avif sitting right beside it. Same bug, wearing a
        # hat.) An overstated srcset descriptor costs a little sharpness on a
        # wide screen; a stale file costs the compliance fix.
        aw = min(tw, w)
        r = cv2.resize(img, (aw, max(1, int(round(h * aw / w)))), interpolation=cv2.INTER_AREA)
        for fmt in cfg["formats"]:
            p = os.path.join(OUT, f"{name}-{tw}.{fmt}")
            if fmt == "jpg":
                cv2.imwrite(p, r, [cv2.IMWRITE_JPEG_QUALITY, 87, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
            elif fmt == "avif":
                cv2.imwrite(p, r, [cv2.IMWRITE_AVIF_QUALITY, 62])
            elif fmt == "webp":
                cv2.imwrite(p, r, [cv2.IMWRITE_WEBP_QUALITY, 82])
            written.append(os.path.basename(p))
        if cfg.get("jpg_at") == tw:
            p = os.path.join(OUT, f"{name}-{tw}.jpg")
            cv2.imwrite(p, r, [cv2.IMWRITE_JPEG_QUALITY, 84, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
            written.append(os.path.basename(p))
    return written


def run(only=None, preview=False, spec_path=None):
    spec = load(spec_path)
    os.makedirs(PREVIEW, exist_ok=True)
    n = 0
    for name, entry in spec["images"].items():
        if only and name != only:
            continue
        if entry.get("action") == "drop":
            print(f"{name:24} DROP  {entry.get('why', '')}")
            continue
        fam = entry["family"]
        src = source_for(fam, entry["src"])
        img = cv2.imread(src)
        if img is None:
            sys.exit(f"missing source {src}")
        out = apply_ops(img, entry)
        h, w = out.shape[:2]
        if preview:
            pw = 1200
            p = cv2.resize(out, (pw, max(1, int(out.shape[0] * pw / out.shape[1]))),
                           interpolation=cv2.INTER_AREA)
            path = os.path.join(PREVIEW, f"{name}.jpg")
            cv2.imwrite(path, p, [cv2.IMWRITE_JPEG_QUALITY, 92])
            print(f"{name:24} {w}x{h}  ratio {w / h:.2f}  -> {path}")
        else:
            files = export(name, out, fam)
            print(f"{name:24} {w}x{h}  ratio {w / h:.2f}  {len(files)} files")
        n += 1
    print(f"\n{n} image(s) processed.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", nargs="?", const="__all__", default=None)
    ap.add_argument("--spec", default=None, help="alternate spec file, for working on a subset")
    a = ap.parse_args()
    if a.preview:
        run(only=None if a.preview == "__all__" else a.preview, preview=True, spec_path=a.spec)
    else:
        run(spec_path=a.spec)
