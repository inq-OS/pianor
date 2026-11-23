#!/usr/bin/env python3
"""The painter's catalogue of reference pictures (skill study-a-picture).

Pictures are studied locally and never committed. This script only
fingerprints them and keeps one JSON catalogue beside them.

    python3 -I refcat.py check FILE...                 seen before? (exact and near matches)
    python3 -I refcat.py look  FILE                    size, colours, pixel scale, main colours
    python3 -I refcat.py add   FILE --id ID --kind KIND --title TEXT
                               [--source TEXT] [--copy] [--note TEXT]
    python3 -I refcat.py note  ID TEXT                 add a line to an entry's "fed" list
    python3 -I refcat.py list  [--kind KIND]
    python3 -I refcat.py mark  OUT.png FILE@x,y,w,h=A[@x,y,w,h=B] FILE2@x,y,w,h=A ...
                               pictures side by side, boxes in each picture's own
                               pixels; one label = "the same thing?"; enlarged
                               crops of every box underneath
    python3 -I refcat.py pin   O9|x,y "WHAT" [--kind thing|camera|noticed]
                               [--bearing DEG] [--from ID]   place it on the Keri grid
    python3 -I refcat.py pins  [--cell O9]
    python3 -I refcat.py map   [OUT.png]                     the grid with every pin

The MI2 atlas (study-a-picture section 9):
    python3 -I refcat.py init                        make the empty library on a new machine
                               (folders, a README per shelf, an empty catalogue); never overwrites
    python3 -I refcat.py import DIR --shelf mi2-bg|mi2-screen|mi3-bg|mi3-inv [--source TEXT]
                               catalogue every picture in DIR in one go; a room the gauge
                               already measured gets its tags back from mi2-gauge.json
    python3 -I refcat.py tag   ID... --tags outdoor,night,sea [--remove] [--new]
    python3 -I refcat.py find  --tags outdoor,night [--without blurry] [--kind KIND] [--long]
                               a tag, a family (stones, plants, water, buildings, furniture, sky,
                               light, ground, boats, creatures) or a 1991 place (woodtick, library, cliff);
                               searches the catalogue and the Keri photo map
    python3 -I refcat.py find  --scene docks --tags stones [--placed]   the Keri photo map: photographs
                               that feed a scene, --shows a place (sauna), taken in --cell K7
    python3 -I refcat.py about [knoll|sauna]         a scene or a place of Keri on one page: where it is,
                               its code, its photographs, what was changed on purpose, its lore
    python3 -I refcat.py tags  [--md]                the whole tag set with counts
    python3 -I refcat.py rooms [--again]             1991 game screens inherit their room's tags
    python3 -I refcat.py crop  ID x,y,w,h --subject sea [--name ID] [--note TEXT]
                               a swatch: a box in the picture's art pixels
    python3 -I refcat.py swatches --subject sea [--ours FILE@x,y,w,h=LABEL] [--out PNG]
    python3 -I refcat.py sheet --tags mi2,outdoor [--without blurry]   contact sheets by id
    python3 -I refcat.py baseline                    measure MI2's rooms into mi2-gauge.json
    python3 -I refcat.py gauge FILE... --tags outdoor,night   how MI2 is it, trait by trait
    python3 -I refcat.py beside FILE --tags outdoor,night     ours over the 3 closest MI2 rooms
    python3 -I refcat.py calibrate FILE=SCORE[:tags]...       fit the gauge to the maintainer's dial

Fingerprints are taken from the decoded pixels, not the file bytes: the shared
folder rewrites a chunk inside every PNG, and uploads arrive under random names.
  pixel  sha256 of the RGBA pixels: equal means the very same picture
  dhash  64-bit difference hash of a 9x8 grey thumbnail: survives resizing,
         recompression and small crops; Hamming distance <= NEAR means
         "probably the same picture", up to LOOSE "worth a look"

Needs Pillow (in the cloud container); the gauge also needs numpy. Run with -I so nothing next to the
picture is imported.
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
from collections import Counter

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("refcat: needs Pillow (python3 -m pip install Pillow)")

_REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")
CATALOG = os.environ.get(
    "PAINTER_REFS", os.path.join(_REPO, "private", "painter", "references")
)
NEAR = 10
LOOSE = 18
KINDS = (
    "keri-photo",      # the reference photographs of the island or its life
    "game-1990s",      # a screenshot of an early 1990s adventure game
    "game-other",      # any other game
    "ours",            # a screenshot or render of Pianor itself
    "maintainer-sketch",    # a drawing or mark-up by the maintainer
    "nature-photo",    # a photograph of a plant, animal, rock... not of Keri
    "other",
)


def catalog_path():
    return os.path.join(CATALOG, "catalog.json")


def load():
    try:
        with open(catalog_path(), encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"schemaVersion": 1, "entries": []}


def save(cat):
    os.makedirs(CATALOG, exist_ok=True)
    tmp = catalog_path() + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cat, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, catalog_path())


def open_rgba(path):
    im = Image.open(path)
    im.load()
    return im.convert("RGBA")


def fingerprint(path):
    im = open_rgba(path)
    pixel = hashlib.sha256(
        f"{im.width}x{im.height}".encode() + im.tobytes()
    ).hexdigest()
    g = im.convert("L").resize((9, 8), Image.LANCZOS)
    px = list(g.tobytes())
    bits = 0
    for y in range(8):
        for x in range(8):
            bits = (bits << 1) | (px[y * 9 + x] > px[y * 9 + x + 1])
    return {
        "pixel": pixel,
        "dhash": f"{bits:016x}",
        "size": [im.width, im.height],
    }


def hamming(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def pixel_scale(im):
    """Largest n so that the picture is n x n blocks of one colour (a pixel-art
    screenshot shown enlarged: 320 x 200 at 1280 x 960 gives 4)."""
    w, h = im.size
    data = im.tobytes()
    stride = w * 4

    def same_block(n):
        if w % n or h % n:
            return False
        for y in range(0, h, max(1, h // 60)):
            row = data[y * stride:(y + 1) * stride]
            base = data[(y - y % n) * stride:(y - y % n + 1) * stride]
            if row != base:
                return False
            for x in range(0, w, n):
                cell = row[x * 4:(x + n) * 4]
                if cell != row[x * 4:x * 4 + 4] * n:
                    return False
        return True

    for n in (8, 6, 5, 4, 3, 2):
        if same_block(n):
            return n
    return 1


def look(path):
    im = open_rgba(path)
    scale = pixel_scale(im)
    small = im if scale == 1 else im.resize(
        (im.width // scale, im.height // scale), Image.NEAREST
    )
    raw = small.tobytes()
    colours = Counter(raw[i:i + 4] for i in range(0, len(raw), 4))
    total = small.width * small.height
    top = [
        {"rgb": "#%02x%02x%02x" % tuple(c[:3]), "share": round(n / total, 4)}
        for c, n in colours.most_common(16)
    ]
    return {
        "file": path,
        "size": [im.width, im.height],
        "pixelScale": scale,
        "artSize": [small.width, small.height],
        "colours": len(colours),
        "likelyPixelArt": scale > 1 or len(colours) <= 256,
        "top": top,
    }


def cmd_check(args):
    cat = load()
    out = []
    for path in args.files:
        fp = fingerprint(path)
        hits = []
        for e in cat["entries"]:
            if e["pixel"] == fp["pixel"]:
                hits.append({"id": e["id"], "match": "exact", "distance": 0})
                continue
            d = hamming(e["dhash"], fp["dhash"])
            if d <= LOOSE:
                hits.append({
                    "id": e["id"],
                    "match": "near" if d <= NEAR else "loose",
                    "distance": d,
                })
        hits.sort(key=lambda h: h["distance"])
        for h in hits:
            e = next(x for x in cat["entries"] if x["id"] == h["id"])
            h.update(title=e["title"], kind=e["kind"],
                     path=e["path"], fed=e.get("fed", []))
        out.append({"file": path, **fp, "seen": hits})
    print(json.dumps(out, indent=1, ensure_ascii=False))


def cmd_look(args):
    print(json.dumps(look(args.file), indent=1))


def cmd_add(args):
    if args.kind not in KINDS:
        sys.exit(f"refcat: kind must be one of {', '.join(KINDS)}")
    cat = load()
    if any(e["id"] == args.id for e in cat["entries"]):
        sys.exit(f"refcat: id {args.id} is taken")
    fp = fingerprint(args.file)
    same = [e["id"] for e in cat["entries"] if e["pixel"] == fp["pixel"]]
    if same:
        sys.exit(f"refcat: the very same picture is already {same[0]}")
    look_ = look(args.file)
    tags = check_tags(split_tags(args.tags), args.new)
    if "mi2" in tags and "mi3" in tags:
        sys.exit("refcat: a picture is mi2 or mi3, never both (the gauge measures MI2 alone)")
    if "mi2" in tags or (args.kind == "game-1990s" and "1991" in (args.source or "")):
        # The 1991 game is indexed VGA: at most 256 colours. The 2010 remake has
        # thousands, so it can never be filed as MI2 by mistake.
        if look_["colours"] > 256:
            sys.exit(f"refcat: {look_['colours']} colours: not the 1991 original "
                     "(the 2010 remake or a filtered copy). Not added.")
    path = os.path.abspath(args.file)
    if args.copy:
        ext = (Image.open(args.file).format or "png").lower()
        ext = "jpg" if ext == "jpeg" else ext
        dest_dir = os.path.join(CATALOG, args.kind)
        os.makedirs(dest_dir, exist_ok=True)
        dest = os.path.join(dest_dir, f"{args.id}.{ext}")
        shutil.copyfile(args.file, dest)
        path = dest
    entry = {
        "id": args.id,
        "kind": args.kind,
        "title": args.title,
        "source": args.source or "",
        "path": path,
        "pixel": fp["pixel"],
        "dhash": fp["dhash"],
        "size": fp["size"],
        "pixelScale": look_["pixelScale"],
        "colours": look_["colours"],
        "tags": tags,
        "fed": [args.note] if args.note else [],
    }
    cat["entries"].append(entry)
    save(cat)
    print(json.dumps(entry, indent=1, ensure_ascii=False))


def cmd_note(args):
    cat = load()
    for e in cat["entries"]:
        if e["id"] == args.id:
            if args.text not in e.setdefault("fed", []):
                e["fed"].append(args.text)
            save(cat)
            print(json.dumps(e, indent=1, ensure_ascii=False))
            return
    sys.exit(f"refcat: no entry {args.id}")


# --- Keri grid -------------------------------------------------------------
# Development only, never shown in the game. Built on the world model (d108):
# local metres, origin at the lighthouse, x east, y north. Cells of 25 m,
# columns A.. from the west, rows 1.. from the north, anchored to fixed edges
# so a cell name never moves when the model grows. The lighthouse sits in
# the middle of O9.
GRID_WEST, GRID_NORTH, GRID_CELL, GRID_COLS, GRID_ROWS = -362.5, 212.5, 25.0, 19, 15
WORLD = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     "..", "..", "..", "content", "world", "keri.json")


def col_name(i):
    return chr(ord("A") + i)


def to_cell(x, y):
    c = int((x - GRID_WEST) // GRID_CELL)
    r = int((GRID_NORTH - y) // GRID_CELL)
    if not (0 <= c < GRID_COLS and 0 <= r < GRID_ROWS):
        return "off-map"
    return f"{col_name(c)}{r + 1}"


def parse_where(text):
    """'O9' (centre of the cell) or 'x,y' in metres -> (x, y)."""
    text = text.strip()
    if "," in text:
        x, y = (float(v) for v in text.split(","))
        return x, y
    c = ord(text[0].upper()) - ord("A")
    r = int(text[1:]) - 1
    if not (0 <= c < GRID_COLS and 0 <= r < GRID_ROWS):
        sys.exit(f"refcat: no cell {text} (A1 to {col_name(GRID_COLS - 1)}{GRID_ROWS})")
    return GRID_WEST + (c + 0.5) * GRID_CELL, GRID_NORTH - (r + 0.5) * GRID_CELL


def cmd_pin(args):
    x, y = parse_where(args.where)
    cat = load()
    pins = cat.setdefault("pins", [])
    pid = args.id or f"p{len(pins) + 1}"
    if any(p["id"] == pid for p in pins):
        sys.exit(f"refcat: pin {pid} is taken")
    pin = {"id": pid, "kind": args.kind, "x": round(x, 1), "y": round(y, 1),
           "cell": to_cell(x, y), "what": args.what,
           "from": args.source or ""}
    if args.bearing is not None:
        pin["bearing"] = args.bearing
    cat["pins"].append(pin)
    save(cat)
    print(json.dumps(pin, ensure_ascii=False))


def cmd_pins(args):
    for p in load().get("pins", []):
        if args.cell and p["cell"] != args.cell.upper():
            continue
        b = f' looking {p["bearing"]}°' if "bearing" in p else ""
        print(f'{p["id"]:<6} {p["cell"]:<4} {p["kind"]:<8} {p["what"]}{b}  ({p["from"]})')


def cmd_map(args):
    from PIL import ImageDraw, ImageFont
    import math
    with open(WORLD, encoding="utf-8") as f:
        w = json.load(f)
    s = args.scale
    W, H = int(GRID_COLS * GRID_CELL * s), int(GRID_ROWS * GRID_CELL * s)
    pad = 28

    def P(x, y):
        return (pad + (x - GRID_WEST) * s, pad + (GRID_NORTH - y) * s)

    try:
        fnt = ImageFont.load_default(size=13)
        big = ImageFont.load_default(size=16)
    except TypeError:
        fnt = big = ImageFont.load_default()
    im = Image.new("RGB", (W + 2 * pad, H + 2 * pad), (34, 58, 86))
    d = ImageDraw.Draw(im)
    d.polygon([P(*p) for p in w["coast"]], fill=(150, 140, 118))
    d.polygon([P(*p) for p in w["grass"]], fill=(98, 128, 70))
    for p in w["paths"]:
        d.line([P(*q) for q in p["points"]], fill=(214, 200, 160),
               width=2 if p["kind"] == "footpath" else 3)
    for b in w["buildings"]:
        a = math.radians(b["angle"])
        ux, uy = math.cos(a) * b["long"] / 2, math.sin(a) * b["long"] / 2
        vx, vy = -math.sin(a) * b["short"] / 2, math.cos(a) * b["short"] / 2
        cx, cy = b["x"], b["y"]
        d.polygon([P(cx + ux + vx, cy + uy + vy), P(cx + ux - vx, cy + uy - vy),
                   P(cx - ux - vx, cy - uy - vy), P(cx - ux + vx, cy - uy + vy)],
                  fill=(176, 72, 52), outline=(40, 20, 16))
        d.text(P(cx, cy - b["short"] / 2 - 2), b["id"], fill=(255, 240, 220), font=fnt, anchor="mt")
    for l in w["landmarks"]:
        x, y = P(l["x"], l["y"])
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 255, 255))
        d.text((x + 5, y), l["id"], fill=(255, 255, 255), font=fnt, anchor="lm")
    x, y = P(0, 0)
    d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(255, 255, 255), outline=(0, 0, 0))
    d.text((x + 7, y), "lighthouse", fill=(255, 255, 255), font=fnt, anchor="lm")
    for name, sc in [(s_["id"], s_) for s_ in w.get("scenes", [])]:
        x, y = P(sc["x"], sc["y"])
        d.rectangle([x - 4, y - 4, x + 4, y + 4], outline=(255, 230, 90), width=2)
        d.text((x + 6, y), f"scene {name}", fill=(255, 230, 90), font=fnt, anchor="lm")
    # grid on top, faint
    for c in range(GRID_COLS + 1):
        X = pad + c * GRID_CELL * s
        d.line([(X, pad), (X, pad + H)], fill=(255, 255, 255) if c % 4 == 0 else (120, 140, 160), width=1)
        if c < GRID_COLS:
            for Y in (pad / 2, pad + H + pad / 2):
                d.text((X + GRID_CELL * s / 2, Y), col_name(c), fill=(255, 255, 255), font=big, anchor="mm")
    for r in range(GRID_ROWS + 1):
        Y = pad + r * GRID_CELL * s
        d.line([(pad, Y), (pad + W, Y)], fill=(255, 255, 255) if r % 4 == 0 else (120, 140, 160), width=1)
        if r < GRID_ROWS:
            for X in (pad / 2, pad + W + pad / 2):
                d.text((X, Y + GRID_CELL * s / 2), str(r + 1), fill=(255, 255, 255), font=big, anchor="mm")
    colours = {"camera": (90, 220, 255), "noticed": (255, 120, 230), "thing": (255, 210, 0)}
    for p in load().get("pins", []):
        x, y = P(p["x"], p["y"])
        c = colours.get(p["kind"], (255, 255, 255))
        if "bearing" in p:
            for half in (-25, 25):
                a = math.radians(p["bearing"] + half)
                d.line([(x, y), (x + math.sin(a) * 60, y - math.cos(a) * 60)], fill=c, width=2)
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=c, outline=(0, 0, 0))
        d.text((x + 6, y - 8), p["id"], fill=c, font=fnt)
    d.text((pad + 4, pad + 4), "Keri, 25 m cells, north up, dev only. Pins: camera (blue, with view), "
           "thing (yellow), noticed (pink)", fill=(255, 255, 255), font=fnt)
    out = args.out or os.path.join(CATALOG, "keri-grid.png")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    im.save(out)
    print(out)


MARK_COLOURS = [(255, 64, 64), (64, 200, 255), (255, 210, 0), (120, 255, 90),
                (255, 120, 230), (255, 150, 40)]


def parse_spec(spec):
    """FILE@x,y,w,h=A@x,y,w,h=B: boxes in the picture's own pixels, each with a label."""
    parts = spec.split("@")
    boxes = []
    for b in parts[1:]:
        coords, _, label = b.partition("=")
        x, y, w, h = (int(v) for v in coords.split(","))
        boxes.append(((x, y, w, h), label or str(len(boxes) + 1)))
    return parts[0], boxes


def cmd_mark(args):
    from PIL import ImageDraw, ImageFont

    def font(size):
        try:
            return ImageFont.load_default(size=size)
        except TypeError:  # Pillow < 10.1
            return ImageFont.load_default()

    H = args.height
    labels = []
    panels, crops = [], []
    for spec in args.specs:
        path, boxes = parse_spec(spec)
        im = open_rgba(path).convert("RGB")
        k = H / im.height
        panel = im.resize((max(1, round(im.width * k)), H), Image.LANCZOS)
        d = ImageDraw.Draw(panel)
        for (x, y, w, h), label in boxes:
            if label not in labels:
                labels.append(label)
            c = MARK_COLOURS[labels.index(label) % len(MARK_COLOURS)]
            r = [round(x * k), round(y * k), round((x + w) * k), round((y + h) * k)]
            for t in range(3):
                d.rectangle([r[0] - t, r[1] - t, r[2] + t, r[3] + t], outline=(0, 0, 0) if t == 2 else c)
            tx, ty = r[0], max(0, r[1] - 26)
            d.rectangle([tx, ty, tx + 14 * len(label) + 10, ty + 24], fill=c)
            d.text((tx + 5, ty + 2), label, fill=(0, 0, 0), font=font(20))
            crop = im.crop((x, y, x + w, y + h))
            ck = args.zoom_height / max(1, crop.height)
            crops.append((crop.resize((max(1, round(crop.width * ck)), args.zoom_height),
                                      Image.NEAREST if ck >= 2 else Image.LANCZOS), label, c))
        panels.append(panel)
    gap = 16
    top_w = sum(p.width for p in panels) + gap * (len(panels) + 1)
    crop_w = sum(c[0].width for c in crops) + gap * (len(crops) + 1)
    W = max(top_w, crop_w)
    sheet_h = gap + H + (gap + 30 + args.zoom_height if crops else 0) + gap
    sheet = Image.new("RGB", (W, sheet_h), (40, 34, 30))
    x = gap
    for p in panels:
        sheet.paste(p, (x, gap)); x += p.width + gap
    if crops:
        d = ImageDraw.Draw(sheet)
        x, y = gap, gap + H + gap
        for im, label, c in crops:
            d.rectangle([x, y, x + 14 * len(label) + 10, y + 24], fill=c)
            d.text((x + 5, y + 2), label, fill=(0, 0, 0), font=font(20))
            sheet.paste(im, (x, y + 30)); x += im.width + gap
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    sheet.save(args.out)
    print(args.out)


# --- The MI2 atlas: tags, swatches, gauge -----------------------------------
# The library of 1991 pictures lives in the catalogue like any other entry
# (kind game-1990s, tag mi2). Tags make like-with-like comparisons possible;
# swatches are rectangles of a picture filed by subject (coordinates only, the
# crop is drawn on demand); the gauge counts traits of a picture at its own
# pixel size and places them in MI2's range. The ranges (numbers only, no
# pictures) are kept in git beside the pattern book.

# One tag set for every picture (the 1991 game, the reference photographs of Keri, our own screens): what a
# picture shows, so that examples of a thing can be found whatever their source. Tags are kept narrow; the words
# people say ("stones", "plants", "buildings") are FAMILIES of them.
TAGS = {
    "setting": ("outdoor", "indoor", "map", "closeup", "cutscene", "title", "underwater", "aerial",
                "item"),  # item: one inventory object on its own (MI3's inventory)
    "hour": ("dawn", "day", "dusk", "night"),
    "subject": ("sky", "clouds", "moon", "stars",
                "sea", "water", "shore", "waterfall",
                "rock", "shingle", "cliff", "sand", "stone-wall", "grave",
                "grass", "foliage", "tree", "bush", "flowers", "moss", "jungle", "swamp",
                "path", "wood", "plaster", "roof",
                "building", "hut", "lighthouse", "tower", "town", "jetty", "bridge", "fence", "mast",
                "window", "door", "stairs", "sign",
                "ship", "boat", "wreck",
                "fire", "lamp", "furniture", "props",
                "figure", "bird", "animal", "interface", "text",
                # what an item is (MI3's inventory; any picture of such a thing may carry them)
                "mug", "bottle", "tool", "weapon", "treasure", "food", "paper", "book", "rope", "nautical"),
    # Places of the 1991 game, so that saying "Woodtick" or "the library" is enough (PLACES has what each is).
    "place": ("scabb", "woodtick", "bar", "kitchen", "inn", "cartographer", "woodsmith", "cemetery", "crypt",
              "voodoo", "beach", "bonfire", "peninsula", "dock", "dread-ship",
              "booty", "stans", "spitting", "antique-shop", "costume-shop", "mansion", "big-tree", "treehouse",
              "sunken-ship",
              "phatt", "library", "jail", "alley", "cottage",
              "fortress", "dinky", "tunnels", "melee", "carnival",
              # The Curse of Monkey Island (1997), by its sections
              "death-starfish", "plunder", "ship-combat", "blood", "monkey-island"),
    # mi3: The Curse of Monkey Island (1997, 640 x 480, 256 colours). Never in the gauge: that is MI2's alone.
    "source": ("mi2", "mi3", "keri", "ours"),
    "flag": ("blurry", "wide", "tall", "dark-frame", "screenshot"),
}
# What a place tag means, for `refcat.py tags`.
PLACES = {
    "scabb": "Scabb Island (Part I): every room on it, and its map",
    "woodtick": "Woodtick, Scabb's town of beached ships: plank walks, lamps, and its rooms",
    "bar": "the bar in Woodtick", "kitchen": "a kitchen (Woodtick's bar, the Booty mansion)",
    "inn": "the inn in Woodtick", "cartographer": "the map maker's cabin in Woodtick",
    "woodsmith": "the woodsmith's workshop in Woodtick",
    "cemetery": "Scabb's graveyard: the fence and gate, the hill of graves, the crypt",
    "crypt": "the crypt under the graveyard", "voodoo": "the voodoo house in the swamp",
    "beach": "a beach (Scabb's with the twisted tree, Phatt's under the cottage, Dinky's)",
    "bonfire": "the campfire of the opening, on Scabb's beach",
    "peninsula": "Scabb's peninsula with the jetty and the houseboat",
    "dock": "a jetty with a ship or a fisherman (Scabb's peninsula, Phatt's pier)",
    "dread-ship": "the houseboat, inside, moored and at sea",
    "booty": "Booty Island (Part II): every room on it, and its map",
    "stans": "the coffin shop on Booty", "spitting": "Booty's street with the flags",
    "antique-shop": "the antique shop on Booty", "costume-shop": "the costume shop on Booty",
    "mansion": "a governor's mansion (Booty's and Phatt's), outside and in",
    "big-tree": "the foot of Booty's big tree, with a small hut",
    "treehouse": "the huts up in Booty's big tree, and inside one",
    "sunken-ship": "the wreck on the sea bed off Booty",
    "phatt": "Phatt Island (Part II): every room on it, and its map",
    "library": "Phatt's library, with its card drawers", "jail": "Phatt's jail",
    "alley": "a back alley (Phatt's, and the night street at the end)",
    "cottage": "the cottage on the small island off Phatt, its beach, room and cellar",
    "fortress": "the fortress (Part III): the rock in a storm, and its fire-lit rooms",
    "dinky": "Dinky Island (Part IV): beach, jungle paths, the clearing",
    "tunnels": "the tunnels under Dinky: storerooms, a lift, bare rooms",
    "melee": "the night street at the end", "carnival": "the carnival at the end",
    "death-starfish": "MI3: LeChuck's ship and the opening at sea", "plunder": "MI3: Plunder Island, Puerto Pollo",
    "ship-combat": "MI3: the Sea Cucumber at sea and its fights", "blood": "MI3: Blood Island",
    "monkey-island": "MI3: Monkey Island and the end",
}
# The words people say, each a set of tags: a picture with any one of them matches. `=water` asks for the tag alone.
FAMILIES = {
    "stones": ("rock", "shingle", "cliff", "stone-wall", "grave"),
    "plants": ("grass", "foliage", "tree", "bush", "flowers", "moss", "jungle", "swamp"),
    "water": ("sea", "water", "shore", "waterfall", "underwater"),
    "buildings": ("building", "hut", "lighthouse", "tower", "town", "roof", "jetty", "bridge", "fence",
                  "plaster", "stone-wall", "window", "door", "stairs"),
    "furniture": ("furniture", "props"),
    "sky": ("sky", "clouds", "moon", "stars"),
    "light": ("fire", "lamp", "moon"),
    "ground": ("path", "sand", "shingle", "grass", "moss"),
    "boats": ("ship", "boat", "wreck"),
    "creatures": ("figure", "bird", "animal"),
    "items": ("item", "mug", "bottle", "tool", "weapon", "treasure", "food", "paper", "book", "rope", "nautical"),
}
ALIASES = {
    "stone": "stones", "rocks": "stones", "boulder": "rock", "boulders": "rock", "pebbles": "shingle",
    "plant": "plants", "vegetation": "plants", "trees": "tree", "bushes": "bush", "roses": "bush",
    "flower": "flowers", "leaves": "foliage",
    "road": "path", "roads": "path", "paths": "path", "track": "path",
    "house": "building", "houses": "buildings", "huts": "hut", "pier": "jetty", "wharf": "jetty",
    "docks": "dock", "graveyard": "cemetery", "campfire": "bonfire",
    "heat": "light", "lights": "light", "lamps": "lamp", "lantern": "lamp",
    "ships": "boats", "animals": "creatures", "birds": "bird", "people": "figure",
    "maps": "map", "interior": "indoor", "inside": "indoor", "outside": "outdoor", "evening": "dusk",
    "morning": "dawn", "tree-house": "treehouse", "sunken": "sunken-ship",
    "inventory": "item", "mugs": "mug", "tankard": "mug", "grog": "mug", "bottles": "bottle", "tools": "tool",
    "papers": "paper", "books": "book", "sea-items": "nautical", "curse": "mi3",
}
ALL_TAGS = {t for group in TAGS.values() for t in group}
GAUGE = os.environ.get(
    "PAINTER_GAUGE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..",
                 "projects", "painter", "vocabulary", "mi2-gauge.json"))
# Traits and how they are read; "hour" traits are compared only within the same hour.
TRAITS = {
    "colours": "colours in the picture",
    "tones_per_hue": "colours per hue family (the 6 fullest of 12)",
    "step_L": "median lightness step between unlike neighbours (L*)",
    "dither": "share of 2x2 checkerboards (two colours)",
    "lone": "share of pixels unlike all four neighbours (the grain of scanned paint)",
    "mark": "mean length of a run of one colour along a row, in 1/320 of the width",
    "dark": "share of pixels darker than L* 25",
    "spread_L": "lightness spread, 5th to 95th percentile (L*)",
    "saturation": "median saturation",
}


def entry_by_id(cat, eid):
    for e in cat["entries"]:
        if e["id"] == eid:
            return e
    sys.exit(f"refcat: no entry {eid}")


def check_tags(tags, allow_new=False):
    bad = [t for t in tags if t not in ALL_TAGS]
    if bad and not allow_new:
        groups = "; ".join(f"{k}: {' '.join(v)}" for k, v in TAGS.items())
        sys.exit(f"refcat: unknown tag {', '.join(bad)} (use --new to allow). Known: {groups}")
    return tags


def cmd_tag(args):
    cat = load()
    tags = check_tags([t.strip() for t in args.tags if t.strip()], args.new)
    for eid in args.ids:
        e = entry_by_id(cat, eid)
        if not args.remove and {"mi2", "mi3"} <= set(tags) | set(e.get("tags", [])):
            sys.exit(f"refcat: {eid} would carry both mi2 and mi3 (the gauge measures MI2 alone)")
        if "mi2" in tags and not args.remove and e.get("colours", 0) > 256:
            sys.exit(f"refcat: {eid} has {e['colours']} colours: not the 1991 original, "
                     "so it cannot be tagged mi2")
        have = e.setdefault("tags", [])
        for t in tags:
            if args.remove and t in have:
                have.remove(t)
            elif not args.remove and t not in have:
                have.append(t)
        print(f'{e["id"]:<40} {" ".join(have)}')
    save(cat)


def split_tags(text):
    return [t for t in (text or "").replace(" ", ",").split(",") if t]


def expand(word):
    """The tags a word stands for: itself, or its family's (`=word` is the tag alone)."""
    if word.startswith("="):
        return (word[1:],)
    word = ALIASES.get(word, word)
    return FAMILIES.get(word, (word,))


def check_words(words):
    """Stops on a word that is neither a tag nor a family, and says what can be said."""
    bad = [w for w in words if not all(t in ALL_TAGS for t in expand(w))]
    if bad:
        sys.exit(f"refcat: nothing is tagged {', '.join(bad)}. Families: {' '.join(FAMILIES)}. "
                 "Every tag: refcat.py tags")


def matches(e, want, without=()):
    have = set(e.get("tags", []))
    return (all(any(t in have for t in expand(w)) for w in want)
            and not any(t in have for w in without for t in expand(w)))


# ---- the Keri photo map: the reference photographs and keri.ee's, catalogued by another tool

# The Keri photo map (docs/keri.md section 6): photo -> place -> scene -> code. Studied locally, never committed:
# `private/keri/` (gitignored), or wherever PAINTER_KERI_MAP points.
KERI_MAP = os.environ.get("PAINTER_KERI_MAP") or os.path.join(_REPO, "private", "keri", "photos.json")


def keri_json(name, key):
    """One file of the photo map (`places`, `scenes`, `departures`, `lore`), or an empty list without it."""
    try:
        with open(os.path.join(os.path.dirname(KERI_MAP), name + ".json"), encoding="utf-8") as f:
            return json.load(f).get(key, [])
    except (FileNotFoundError, ValueError):
        return []


# Everyday words for a place of the photo map (its ids come from content/world/keri.json).
KERI_PLACE_WORDS = {
    "sauna": "hut-middle", "well": "hut-west", "well-house": "hut-west", "house": "warden-house",
    "warden": "warden-house", "room": "living-room", "jetty": "north-jetty", "docks": "north-jetty",
    "dock": "north-jetty", "pier": "slipway", "power-station": "north-shed", "elektrijaam": "north-shed",
    "memorial": "kaleva-memorial", "kaleva": "kaleva-memorial", "tractor": "sunken-tractor",
    "signpost": "guide-pole", "cinema": "kinomaja", "roses": "rose-thicket", "gym": "outdoor-gym",
    "fire": "fireplace", "boat-shed": "wood-shed", "gull-shed": "shore-shed",
}


def keri_places(word):
    """The places a word names: an id, an everyday word, or a word of a place's name."""
    import re
    places = keri_json("places", "places")
    word = word.lower().strip()
    word = KERI_PLACE_WORDS.get(word, word)
    exact = [p for p in places if p["id"] == word]
    if exact:
        return exact
    return [p for p in places
            if word in p["id"].split("-") or word in re.findall(r"[a-zäöüõ]+", p.get("name", "").lower())]
# A place a photograph shows (its "shows") and what that means in tags.
KERI_SHOWS = {
    "lighthouse": ("lighthouse", "building"), "warden-house": ("building",), "hut-middle": ("hut", "building"),
    "hut-west": ("hut", "building"), "red-shed": ("hut", "building"), "north-shed": ("hut", "building"),
    "building-2": ("building",), "building-3": ("building",), "kinomaja": ("building",),
    "engine-room": ("building",), "weather-station": ("mast",), "mast": ("mast",), "flagpole": ("mast",),
    "north-jetty": ("jetty", "shore"), "slipway": ("jetty", "shore"), "guide-pole": ("sign",),
    "rose-thicket": ("bush", "flowers"), "knoll": ("grass",), "sauna-rise": ("grass",),
    "fireplace": ("fire",), "living-room": ("indoor", "furniture"), "terrace": ("furniture",),
    "crossroads": ("path",), "track-to-lighthouse": ("path",), "se-spit": ("shore", "shingle"),
    "nw-spit": ("shore", "shingle"), "north-shore": ("shore",),
}
# A word in a photograph's description ("what") and what it means in tags.
KERI_WORDS = {
    "lighthouse": ("lighthouse", "building"), "house": ("building",), "houses": ("building",),
    "sauna": ("hut", "building"), "shed": ("hut", "building"), "building": ("building",),
    "porch": ("building",), "gable": ("building",), "roof": ("roof",), "chimney": ("roof",),
    "window": ("window",), "windows": ("window",), "door": ("door",), "wall": ("building",),
    "shore": ("shore",), "sea": ("sea",), "water": ("sea",), "waves": ("sea",), "wave": ("sea",),
    "surf": ("sea", "shore"), "boulder": ("rock",), "boulders": ("rock",), "stones": ("rock",),
    "stone": ("rock",), "rock": ("rock",), "rocks": ("rock",), "limestone": ("rock",), "slab": ("rock",),
    "shingle": ("shingle",), "pebble": ("shingle",), "pebbles": ("shingle",), "lichen": ("rock",),
    "grass": ("grass",), "turf": ("grass",), "meadow": ("grass",), "moss": ("moss",), "mossy": ("moss",),
    "bush": ("bush",), "bushes": ("bush",), "rose": ("bush", "flowers"), "roses": ("bush", "flowers"),
    "flowers": ("flowers",), "daisy": ("flowers",), "daisies": ("flowers",), "cornflowers": ("flowers",),
    "stonecrop": ("flowers",), "plants": ("foliage",),
    "path": ("path",), "walk": ("path",), "concrete": ("path",),
    "jetty": ("jetty",), "pier": ("jetty",), "landing": ("jetty",), "mooring": ("jetty",),
    "boat": ("boat",), "boats": ("boat",), "mast": ("mast",), "flagpole": ("mast",), "pole": ("mast",),
    "sign": ("sign",), "signposts": ("sign",), "driftwood": ("wood",), "boards": ("wood",),
    "wooden": ("wood",), "deck": ("wood",),
    "birds": ("bird",), "gull": ("bird",), "gulls": ("bird",), "tern": ("bird",), "seal": ("animal",),
    "stove": ("fire", "furniture"), "fire": ("fire",), "lamp": ("lamp",), "lantern": ("lamp",),
    "table": ("furniture",), "tables": ("furniture",), "sofa": ("furniture",), "bench": ("furniture",),
    "benches": ("furniture",), "chairs": ("furniture",), "frames": ("furniture",),
    "room": ("indoor",), "rooms": ("indoor",), "kitchen": ("indoor", "furniture"), "floor": ("indoor",),
    "ceiling": ("indoor",), "bedrooms": ("indoor",), "washroom": ("indoor",),
    "sunset": ("dusk", "sky"), "dusk": ("dusk",), "evening": ("dusk",), "sunsets": ("dusk", "sky"),
    "night": ("night",), "sunrise": ("dawn",), "sky": ("sky",), "clouds": ("clouds", "sky"),
    "storm": ("clouds", "sky"), "haze": ("sky",),
}


def keri_map_entries():
    """The photo map's pictures as catalogue entries. A photograph's own "tags" list wins; without one its tags
    are read from its description and the places it shows, so they are a first guess, not a study."""
    import re
    try:
        with open(KERI_MAP, encoding="utf-8") as f:
            photos = json.load(f).get("photos", [])
    except (FileNotFoundError, ValueError):
        return []
    out = []
    for p in photos:
        tags = list(p.get("tags") or [])
        if not tags:
            found = set()
            for place in p.get("shows", []):
                found.update(KERI_SHOWS.get(place, ()))
            for word in re.findall(r"[a-z]+", (p.get("what") or "").lower()):
                found.update(KERI_WORDS.get(word, ()))
            if str((p.get("camera") or {}).get("height", "")).startswith("air"):
                found.add("aerial")
            found.add("indoor" if "indoor" in found else "outdoor")
            tags = [t for group in TAGS.values() for t in group if t in found]
        if "keri" not in tags:
            tags.append("keri")
        cam = p.get("camera") or {}
        out.append({"id": p["id"], "kind": "keri-photo", "title": p.get("what", ""),
                    "path": os.path.join(os.path.dirname(KERI_MAP), p["file"]), "tags": tags,
                    "guessed": not p.get("tags"), 
                    "n": p.get("n"), "scenes": p.get("scenes", []), "shows": p.get("shows", []),
                    "cell": cam.get("cell"), "bearing": cam.get("bearing"), "placed": cam.get("by") == "maintainer",
                    "note": p.get("note") or cam.get("note")})
    return out


def everything(cat):
    """Every picture that can be found: the catalogue's, then the Keri photo map's."""
    have = {e["id"] for e in cat["entries"]}
    return cat["entries"] + [e for e in keri_map_entries() if e["id"] not in have]


def on_keri(args):
    """A test for the photo map's side of a search: the scene a photograph feeds, the place it shows, the cell it
    was taken in, and whether it was placed on the photo map. None when the search asks for none of these."""
    scene, shows = getattr(args, "scene", None), getattr(args, "shows", None)
    cell, placed = getattr(args, "cell", None), getattr(args, "placed", False)
    if not (scene or shows or cell or placed):
        return None
    ids = set()
    if shows:
        ids = {p["id"] for p in keri_places(shows)}
        if not ids:
            sys.exit(f"refcat: the photo map has no place called {shows}. Its places: refcat.py about")
    if scene and scene not in {x["id"] for x in keri_json("scenes", "scenes")}:
        sys.exit(f"refcat: no scene {scene}. Scenes: " + " ".join(x["id"] for x in keri_json("scenes", "scenes")))
    return lambda e: ("scenes" in e and (not scene or scene in e["scenes"])
                      and (not shows or ids & set(e["shows"]))
                      and (not cell or (e.get("cell") or "").upper() == cell.upper())
                      and (not placed or e.get("placed")))


# Which artist's note holds the house recipe for a family of things (projects/painter/artists-notes/).
NOTES = {"stones": ["stones"], "plants": ["grass", "bushes-and-foliage", "trees"], "ground": ["paths"],
         "light": ["light-and-heat"]}


def atlas_like(cat, picks, want=(), without=(), n=8):
    """The rooms of the 1991 game most like these pictures: clean backgrounds that carry the asked words, ranked
    by how many of the pictures' own tags they share (setting, hour and subjects). The pairing of what a thing is
    on Keri with how the game paints it."""
    weigh = set(TAGS["setting"]) | set(TAGS["hour"]) | set(TAGS["subject"])
    freq = Counter(t for e in picks for t in e.get("tags", []) if t in weigh)
    total = max(1, len(picks))
    scored, asked = [], {e["id"] for e in picks}
    for e in cat["entries"]:
        have = set(e.get("tags", []))
        if e["id"] in asked or "mi2" not in have or have & {"screenshot", "blurry", "map", "title", "cutscene"}:
            continue
        if not matches(e, want, without):
            continue
        shared = sorted((t for t in have if freq[t]), key=lambda t: -freq[t])
        score = sum(freq[t] for t in shared) / total - 0.15 * len([t for t in have & weigh if not freq[t]])
        scored.append((score, e["id"], e, shared))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [(e, shared) for _, _, e, shared in scored[:n]]


def cmd_find(args):
    cat = load()
    want, without = split_tags(args.tags), split_tags(args.without)
    check_words(want + without)
    keri = on_keri(args)
    n = 0
    for e in everything(cat):
        if args.kind and e["kind"] != args.kind:
            continue
        if matches(e, want, without) and (keri is None or keri(e)):
            n += 1
            room = f'  (shows {e["room"]})' if e.get("room") else ""
            if "scenes" in e:
                where = f'{e["cell"] or "no place"}{"" if e["placed"] or not e["cell"] else "?"}'
                room = f'  [{where}; shows {" ".join(e["shows"]) or "-"}; feeds {" ".join(e["scenes"]) or "-"}]'
            print(f'{e["id"]:<40} {" ".join(e.get("tags", []))}{room}')
            if args.long:
                print(f'{"":<40} {e.get("title", "")[:110]}\n{"":<40} {e["path"]}')
                if e.get("note"):
                    print(f'{"":<40} note: {e["note"][:150]}')
    print(f"{n} pictures", file=sys.stderr)
    if args.atlas:
        picks = [e for e in everything(cat) if matches(e, want, without) and (keri is None or keri(e))
                 and (not args.kind or e["kind"] == args.kind)]
        words = [w for w in want if w not in ("keri", "ours")]
        like = atlas_like(cat, picks, words, without, args.atlas)
        print("the 1991 game's rooms most like these:" if like else "the 1991 game has no other room with those words")
        for e, shared in like:
            place = " ".join(t for t in e.get("tags", []) if t in TAGS["place"])
            print(f'{e["id"]:<40} {place:<24} shares: {" ".join(shared)}')


def cmd_about(args):
    """What is known about a scene or a place of Keri, on one page: where it is, the code that paints it, the
    photographs that feed it, what was changed from the real island on purpose, and its lore."""
    scenes, places = keri_json("scenes", "scenes"), keri_json("places", "places")
    if not places:
        sys.exit(f"refcat: no photo map beside {KERI_MAP} (private/keri/, or set PAINTER_KERI_MAP)")
    photos = keri_map_entries()
    departures, lore = keri_json("departures", "departures"), keri_json("lore", "lore")

    def spot(p):
        at = f'{p.get("cell") or "no cell"}'
        if p.get("x") is not None:
            at += (f', {abs(p["x"]):.0f} m {"west" if p["x"] < 0 else "east"} and '
                   f'{abs(p["y"]):.0f} m {"south" if p["y"] < 0 else "north"} of the lighthouse')
        return at + ("" if p.get("sure", True) else " (not sure: KERI-TODO)")

    def subjects(group):
        count = Counter(f for e in group for f, tags in FAMILIES.items() if any(t in e["tags"] for t in tags))
        return ", ".join(f"{f} {n}" for f, n in count.most_common()) or "none"

    def changed(test):
        for d in departures:
            if test(d):
                print(f'  changed on purpose ({d["kind"]}, {d["state"]}): {d["painted"]}')
                print(f'      real: {d["real"]}\n      {d["by"]}')
                if d.get("mi2") and not str(d["mi2"]).startswith("none"):
                    print(f'      after: {d["mi2"]}')

    def stories(ids):
        for x in lore:
            if x.get("place") in ids:
                print(f'  lore ({x["state"]}): {x["title"]}. {x.get("use", "")}')

    if not args.word:
        print("scenes:  " + ", ".join(f'{x["id"]} ({x["title"]})' for x in scenes))
        print("places:")
        for p in places:
            print(f'  {p["id"]:<16} {p.get("cell") or "":<6} {p["name"][:80]}')
        print("also understood: " + ", ".join(f"{a} = {b}" for a, b in sorted(KERI_PLACE_WORDS.items())))
        return
    word, found = args.word.lower(), False
    for x in scenes:
        if x["id"] != word:
            continue
        found = True
        mine = [e for e in photos if x["id"] in e["scenes"]]
        print(f'SCENE {x["id"]}: {x["title"]}  [{x["state"]}]')
        place = next((p for p in places if p["id"] == x.get("place")), None)
        if place:
            print(f'  place: {place["id"]}, {place["name"]}: {spot(place)}')
        cam = x.get("camera")
        if isinstance(cam, dict):
            print(f'  view: from {cam.get("x")}, {cam.get("y")} looking {cam.get("bearing")} degrees. {cam.get("note", "")}')
        elif cam:
            print(f"  view: {cam}")
        print("  code: " + (", ".join(x.get("code") or []) or "none yet"))
        print("  notes: " + (", ".join(x.get("docs") or []) or "none yet") + (f'   render: {x["render"]}' if x.get("render") else ""))
        changed(lambda d: d.get("scene") == x["id"])
        stories({x["place"]} if x.get("place") else {None} | {y.get("place") for y in lore})  # the map: all of it
        print(f'  photographs that feed it: {len(mine)} ({sum(e["placed"] for e in mine)} placed by the maintainer)')
        print(f"      they show: {subjects(mine)}")
        seen = Counter(q for e in mine for q in e["shows"])
        if seen:
            print("      places in them (refcat.py about <place>): " + ", ".join(f"{k} {v}" for k, v in seen.most_common(10)))
        print(f'      look: refcat.py sheet --scene {x["id"]} [--tags <thing>]   list: refcat.py find --scene {x["id"]} --long')
        count = Counter(f for e in mine for f, tags in FAMILIES.items() if any(t in e["tags"] for t in tags))
        fams = [f for f, _ in count.most_common()]
        top = next((f for f in fams if f in NOTES), fams[0] if fams else "stones")
        like = atlas_like(load(), mine, n=5) if mine else []
        if like:
            print("  in the MI2 atlas, the rooms most like its photographs:")
            for e, shared in like:
                place = " ".join(t for t in e.get("tags", []) if t in TAGS["place"])
                print(f'      {e["id"]:<16} {place:<22} shares: {" ".join(shared[:8])}')
            print(f'      both on one sheet: refcat.py sheet --scene {x["id"]} --tags {top} --atlas')
        notes = [f"{f}: " + ", ".join(f"{n}.md" for n in NOTES[f]) for f in fams if f in NOTES
                 and any(os.path.exists(os.path.join(_REPO, "projects", "painter", "artists-notes", n + ".md")) for n in NOTES[f])]
        print("  recipes for the things in it (projects/painter/artists-notes/): " + ("; ".join(notes) or "README.md"))
    for p in keri_places(word):
        found = True
        mine = [e for e in photos if p["id"] in e["shows"]]
        print(f'PLACE {p["id"]}: {p["name"]}')
        print(f'  where: {spot(p)}\n  from: {p.get("from", "")[:300]}')
        changed(lambda d: d.get("place") == p["id"])
        stories({p["id"]})
        feeds = Counter(q for e in mine for q in e["scenes"])
        print(f'  photographs that show it: {len(mine)} ({sum(e["placed"] for e in mine)} placed by the maintainer); '
              f'they feed: {", ".join(f"{k} {v}" for k, v in feeds.most_common()) or "no scene"}')
        print(f'      look: refcat.py sheet --shows {p["id"]}   list: refcat.py find --shows {p["id"]} --long')
    if not found:
        sys.exit(f"refcat: the photo map knows no scene or place called {args.word}. Try: refcat.py about")


def cmd_tags(args):
    """The tag set, the families, and how many pictures carry each tag."""
    cat = load()
    count = Counter(t for e in everything(cat) for t in e.get("tags", []))
    if args.md:
        print("| Say | Finds pictures tagged | Pictures |\n|---|---|---|")
        for name, members in FAMILIES.items():
            n = sum(1 for e in everything(cat) if any(t in e.get("tags", []) for t in members))
            print(f"| `{name}` | {', '.join(members)} | {n} |")
        print("\n| Place | What it is | Rooms | Screens |\n|---|---|---|---|")
        for t in TAGS["place"]:
            rooms = [e["id"][7:] if e["id"].startswith("mi2") else "MI3 " + e["id"][7:] for e in cat["entries"]
                     if e["id"].startswith(("mi2-bg", "mi3-bg")) and t in e.get("tags", [])]
            scr = sum(1 for e in cat["entries"] if e["id"].startswith("mi2-scr") and t in e.get("tags", []))
            print(f"| `{t}` | {PLACES.get(t, '')} | {', '.join(rooms)} | {scr} |")
        for group in ("setting", "hour", "subject", "source", "flag"):
            print(f"\n**{group}:** " + ", ".join(f"{t} ({count[t]})" for t in TAGS[group]))
        return
    for group, tags in TAGS.items():
        print(f"{group}:")
        for t in tags:
            print(f'  {t:<16} {count[t]:>4}  {PLACES.get(t, "")}')
    print("families (a picture with any one of the tags matches):")
    for name, members in FAMILIES.items():
        print(f'  {name:<16} {" ".join(members)}')
    print("also understood: " + ", ".join(f"{a} = {b}" for a, b in sorted(ALIASES.items())))
    stray = sorted(t for t in count if t not in ALL_TAGS)
    if stray:
        print("in the catalogue but not in the set: " + " ".join(stray))


def cmd_rooms(args):
    """Each game screen of the 1991 game takes the place and the subjects of the background room it shows."""
    import numpy as np
    cat = load()

    def packed(e, size=None):
        im = open_rgba(e["path"]).convert("RGB")
        im = im.resize(size, Image.NEAREST) if size else art_pixels(e["path"])
        a = np.asarray(im).astype(np.int32)
        return (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]

    rooms = [(e, packed(e)) for e in cat["entries"] if e["id"].startswith("mi2-bg")]
    keep = set(TAGS["setting"]) | set(TAGS["hour"]) | set(TAGS["subject"]) | set(TAGS["place"])
    done = 0
    for e in cat["entries"]:
        if "screenshot" not in e.get("tags", []) or "mi2" not in e.get("tags", []):
            continue
        if e.get("room") and not args.again:
            continue
        s = packed(e, (320, 200))  # the screens are 320 x 200 shown at 4 x 4.8
        best, second, of = 0.0, 0.0, None
        for room, b in rooms:
            if b.shape[1] < 320:
                continue
            h = min(b.shape[0], 200)
            part = s[:h:3, ::3]
            top = max(float((b[:h:3, x:x + 320:3] == part).mean()) for x in range(b.shape[1] - 319))
            if top > best:
                best, second, of = top, best, room
            elif top > second:
                second = top
        tags = e.setdefault("tags", [])
        if int((s[150:] != 0).mean() > 0.2) and "interface" not in tags:
            tags.append("interface")
        if of is not None and best >= 0.5 and best - second >= 0.15:
            e["room"] = of["id"]
            tags.extend(t for t in of.get("tags", []) if t in keep and t not in tags)
            done += 1
            print(f'{e["id"]:<18} {of["id"]}  {best:.2f}')
        else:
            print(f'{e["id"]:<18} no room ({best:.2f}): tag it by eye', file=sys.stderr)
    save(cat)
    print(f"{done} screens took a room's tags", file=sys.stderr)


def art_pixels(path):
    """The picture at one art pixel per pixel, RGB."""
    im = open_rgba(path)
    s = pixel_scale(im)
    im = im.convert("RGB")
    return im if s == 1 else im.resize((im.width // s, im.height // s), Image.NEAREST)


def cmd_crop(args):
    cat = load()
    e = entry_by_id(cat, args.id)
    x, y, w, h = (int(v) for v in args.box.split(","))
    art = art_pixels(e["path"])
    if x < 0 or y < 0 or x + w > art.width or y + h > art.height or w < 2 or h < 2:
        sys.exit(f"refcat: box {args.box} is outside the picture's {art.width} x {art.height} art pixels")
    sw = cat.setdefault("swatches", [])
    sid = args.name or f"{args.subject}-{sum(1 for s_ in sw if s_['subject'] == args.subject) + 1}"
    if any(s_["id"] == sid for s_ in sw):
        sys.exit(f"refcat: swatch {sid} is taken")
    rec = {"id": sid, "subject": args.subject, "from": e["id"], "box": [x, y, w, h],
           "note": args.note or ""}
    sw.append(rec)
    save(cat)
    print(json.dumps(rec, ensure_ascii=False))


def _font(size):
    from PIL import ImageFont
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow < 10.1
        return ImageFont.load_default()


def zoom_to(im, height):
    k = max(1, height // max(1, im.height))
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def cmd_swatches(args):
    """All swatches of a subject on one sheet, each enlarged by whole pixels."""
    from PIL import ImageDraw
    cat = load()
    picks = [s_ for s_ in cat.get("swatches", []) if s_["subject"] == args.subject]
    if not picks:
        sys.exit(f"refcat: no swatches of {args.subject} yet (refcat.py crop ID x,y,w,h --subject {args.subject})")
    tiles = []
    for s_ in picks:
        x, y, w, h = s_["box"]
        crop = art_pixels(entry_by_id(cat, s_["from"])["path"]).crop((x, y, x + w, y + h))
        tiles.append((zoom_to(crop, args.height), f'{s_["id"]}  ({s_["from"]})', s_["note"]))
    for spec in args.ours or []:
        path, boxes = parse_spec(spec)
        art = art_pixels(path)
        for (x, y, w, h), label in boxes or [((0, 0, art.width, art.height), "ours")]:
            tiles.append((zoom_to(art.crop((x, y, x + w, y + h)), args.height),
                          f"OURS {label}  ({os.path.basename(path)})", ""))
    gap, cap = 14, 40
    width = args.width
    rows, row, rw = [], [], gap
    for t in tiles:
        if row and rw + t[0].width + gap > width:
            rows.append(row); row, rw = [], gap
        row.append(t); rw += t[0].width + gap
    rows.append(row)
    W = max(width, max(sum(t[0].width + gap for t in r) + gap for r in rows))
    H = gap + sum(max(t[0].height for t in r) + cap + gap for r in rows)
    sheet = Image.new("RGB", (W, H), (40, 34, 30))
    d = ImageDraw.Draw(sheet)
    y = gap
    for r in rows:
        x = gap
        for im, label, note in r:
            ours = label.startswith("OURS")
            d.text((x, y), label, fill=(255, 210, 0) if ours else (240, 230, 210), font=_font(14))
            if note:
                d.text((x, y + 17), note[:90], fill=(190, 180, 160), font=_font(12))
            sheet.paste(im, (x, y + cap))
            if ours:
                d.rectangle([x - 3, y + cap - 3, x + im.width + 2, y + cap + im.height + 2],
                            outline=(255, 210, 0), width=2)
            x += im.width + gap
        y += max(t[0].height for t in r) + cap + gap
    out = args.out or os.path.join(CATALOG, "swatches", f"{args.subject}.png")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out)
    print(out)


def traits(path):
    """Countable traits of a picture at its own pixel size (needs numpy)."""
    import numpy as np
    a = np.asarray(art_pixels(path)).astype(np.int64)
    h, w, _ = a.shape
    key = (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]
    c = a / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    Y = 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
    L = np.where(Y > 0.008856, 116 * np.cbrt(Y) - 16, 903.3 * Y)
    mx, mn = a.max(-1).astype(float), a.min(-1).astype(float)
    sat = (mx - mn) / np.maximum(mx, 1)
    t = {}
    uniq, first = np.unique(key.ravel(), return_index=True)
    t["colours"] = int(len(uniq))
    # hue families: 12 sectors of the colours with some saturation
    px = a.reshape(-1, 3)[first].astype(float)
    pmx, pmn = px.max(1), px.min(1)
    psat = (pmx - pmn) / np.maximum(pmx, 1)
    r_, g_, b_ = px[:, 0], px[:, 1], px[:, 2]
    hue = np.degrees(np.arctan2(np.sqrt(3) * (g_ - b_), 2 * r_ - g_ - b_)) % 360
    counts = np.bincount((hue[psat > 0.12] // 30).astype(int), minlength=12)
    t["tones_per_hue"] = float(np.sort(counts)[-6:].mean())
    dh = np.abs(np.diff(L, axis=1))[key[:, 1:] != key[:, :-1]]
    dv = np.abs(np.diff(L, axis=0))[key[1:] != key[:-1]]
    d = np.concatenate([dh, dv])
    t["step_L"] = float(np.median(d)) if d.size else 0.0
    k00, k01, k10, k11 = key[:-1, :-1], key[:-1, 1:], key[1:, :-1], key[1:, 1:]
    t["dither"] = float(((k00 == k11) & (k01 == k10) & (k00 != k01)).mean())
    c_ = key[1:-1, 1:-1]
    t["lone"] = float(((c_ != key[:-2, 1:-1]) & (c_ != key[2:, 1:-1]) & (c_ != key[1:-1, :-2])
                       & (c_ != key[1:-1, 2:])).mean())
    runs = h * w / max(1, int((key[:, 1:] != key[:, :-1]).sum()) + h)
    t["mark"] = float(runs * 320.0 / w)
    t["dark"] = float((L < 25).mean())
    t["spread_L"] = float(np.percentile(L, 95) - np.percentile(L, 5))
    t["saturation"] = float(np.median(sat))
    return {k: round(v, 4) if isinstance(v, float) else v for k, v in t.items()}


def load_gauge():
    try:
        with open(GAUGE, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        sys.exit(f"refcat: no gauge ranges at {GAUGE} yet (refcat.py baseline)")


def cmd_baseline(args):
    """Measure every MI2 picture fit for comparing and keep the numbers."""
    cat = load()
    rows = []
    for e in cat["entries"]:
        if not matches(e, ["mi2"], ["blurry", "screenshot", "interface", "text", "title", "cutscene",
                                    "map", "closeup"]):
            continue
        if not any(t in e.get("tags", []) for t in ("outdoor", "indoor")):
            continue
        rows.append({"id": e["id"], "tags": e.get("tags", []), **traits(e["path"])})
        print(f'{e["id"]:<40} measured', file=sys.stderr)
    old = {}
    try:
        with open(GAUGE, encoding="utf-8") as f:
            old = json.load(f)
    except FileNotFoundError:
        pass
    lost = sorted({r["id"] for r in old.get("rooms", [])} - {r["id"] for r in rows})
    if lost and not args.shrink:
        # A half-filled library on a new machine would wipe the numbers git keeps.
        sys.exit(f"refcat: {len(lost)} rooms of {GAUGE} are not in the library "
                 f"(such as {', '.join(lost[:5])}); import them first, or --shrink to drop them")
    out = {
        "schemaVersion": 1,
        "about": "MI2 (1991) traits measured by refcat.py baseline from the painter's library; "
                 "numbers only, the pictures are studied locally and never committed. Weights and the dial "
                 "fit come from refcat.py calibrate.",
        "traits": TRAITS,
        "weights": old.get("weights", {k: 1.0 for k in TRAITS}),
        "dial": old.get("dial", {"a": 1.0, "b": 0.0, "fitOn": []}),
        "rooms": rows,
    }
    os.makedirs(os.path.dirname(os.path.abspath(GAUGE)), exist_ok=True)
    with open(GAUGE, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"{GAUGE}: {len(rows)} rooms")


HOUR_TRAITS = ("dark", "spread_L", "saturation")


def group_for(g, want):
    """MI2 rooms to compare with: same setting and hour, widened when too few."""
    rooms = g["rooms"]
    tries = [want, [t for t in want if t in TAGS["setting"] + TAGS["hour"]],
             [t for t in want if t in TAGS["hour"]], [t for t in want if t in TAGS["setting"]], []]
    for t in tries:
        grp = [r for r in rooms if all(x in r["tags"] for x in t)]
        if len(grp) >= 5:
            return grp, t
    return rooms, []


def score_against(g, ours, want):
    import numpy as np
    grp, used = group_for(g, want)
    rows = []
    for k in TRAITS:
        vals = np.array([r[k] for r in grp], dtype=float)
        lo, hi = np.percentile(vals, 10), np.percentile(vals, 90)
        span = max(hi - lo, 1e-6, 0.15 * abs(np.median(vals)))
        v = ours[k]
        off = 0.0 if lo <= v <= hi else (lo - v if v < lo else v - hi) / span
        s = 100.0 * float(np.exp(-1.5 * off * off))
        move = "" if s >= 80 else ("raise" if v < lo else "lower")
        rows.append({"trait": k, "ours": v, "mi2Low": round(float(lo), 4),
                     "mi2High": round(float(hi), 4), "score": round(s), "move": move})
    wts = g.get("weights", {})
    raw = sum(r["score"] * wts.get(r["trait"], 1.0) for r in rows) / max(
        1e-6, sum(wts.get(r["trait"], 1.0) for r in rows))
    dial = g.get("dial", {"a": 1.0, "b": 0.0})
    total = max(0.0, min(100.0, dial["a"] * raw + dial["b"]))
    return {"group": used, "rooms": len(grp), "raw": round(raw), "mi2": round(total), "traits": rows,
            "calibrated": bool(dial.get("fitOn"))}


def print_score(path, res):
    print(f"{path}\n  compared with {res['rooms']} MI2 rooms tagged "
          f"{' '.join(res['group']) or '(all)'}")
    for r in res["traits"]:
        fmt = "{:.3f}" if isinstance(r["ours"], float) and r["ours"] < 1 else "{:.1f}"
        print(f"  {r['trait']:<14} ours {fmt.format(r['ours']):>8}   MI2 {fmt.format(r['mi2Low'])}"
              f" to {fmt.format(r['mi2High'])}   {r['score']:>3}  {r['move']}")
    note = "" if res["calibrated"] else "  (not calibrated against the maintainer yet)"
    print(f"  MI2 gauge: {res['mi2']}%{note}")


def cmd_gauge(args):
    g = load_gauge()
    for path in args.files:
        res = score_against(g, traits(path), split_tags(args.tags))
        if args.json:
            print(json.dumps({"file": path, **res}, indent=1))
        else:
            print_score(path, res)


def nearest_rooms(g, ours, want, n):
    import numpy as np
    keys = list(TRAITS)
    m = np.array([[r[k] for k in keys] for r in g["rooms"]], dtype=float)
    sd = m.std(0) + 1e-9
    o = np.array([ours[k] for k in keys], dtype=float)
    def rank(r):
        missing = sum(1 for t in want if t not in r["tags"])
        return (missing, float(np.sum(((np.array([r[k] for k in keys]) - o) / sd) ** 2)))
    ranked = sorted(g["rooms"], key=rank)
    return ranked[:n]


def cmd_beside(args):
    """Ours on top, the closest MI2 rooms of the same kind under it, the gauge beside."""
    from PIL import ImageDraw
    g = load_gauge()
    cat = load()
    want = split_tags(args.tags)
    ours = traits(args.file)
    res = score_against(g, ours, want)
    rooms = nearest_rooms(g, ours, want, args.n)
    W = args.width
    def fit(im):
        k = W / im.width
        return im.resize((W, max(1, round(im.height * k))), Image.NEAREST)
    panels = [(fit(art_pixels(args.file)), f"OURS  {os.path.basename(args.file)}")]
    for r in rooms:
        e = entry_by_id(cat, r["id"])
        panels.append((fit(art_pixels(e["path"])), f'MI2 1991  {r["id"]}  ({" ".join(r["tags"])})'))
    gap, cap, side = 14, 22, 520
    H = gap + sum(p.height + cap + gap for p, _ in panels)
    sheet = Image.new("RGB", (W + side + 3 * gap, max(H, 420)), (40, 34, 30))
    d = ImageDraw.Draw(sheet)
    y = gap
    for im, label in panels:
        d.text((gap, y), label, fill=(255, 210, 0) if label.startswith("OURS") else (240, 230, 210),
               font=_font(15))
        sheet.paste(im, (gap, y + cap)); y += im.height + cap + gap
    x0, y = W + 2 * gap, gap
    d.text((x0, y), f"MI2 gauge {res['mi2']}%", fill=(255, 210, 0), font=_font(30)); y += 40
    d.text((x0, y), f"against {res['rooms']} rooms: {' '.join(res['group']) or 'all'}"
           + ("" if res["calibrated"] else "  (uncalibrated)"), fill=(200, 190, 170), font=_font(14))
    y += 30
    for r in res["traits"]:
        fmt = "{:.3f}" if isinstance(r["ours"], float) and r["ours"] < 1 else "{:.1f}"
        c = (120, 220, 110) if r["score"] >= 80 else (255, 190, 60) if r["score"] >= 40 else (255, 90, 80)
        d.text((x0, y), r["trait"], fill=(240, 230, 210), font=_font(16))
        d.text((x0 + 140, y), f"ours {fmt.format(r['ours'])}", fill=c, font=_font(16))
        d.text((x0 + 270, y), f"MI2 {fmt.format(r['mi2Low'])}-{fmt.format(r['mi2High'])}",
               fill=(200, 190, 170), font=_font(16))
        d.text((x0 + 450, y), f"{r['score']}", fill=c, font=_font(16))
        y += 24
        if r["move"]:
            d.text((x0 + 140, y - 4), f"{r['move']} it", fill=(170, 160, 140), font=_font(12)); y += 14
    out = args.out or os.path.join(CATALOG, "beside", os.path.splitext(os.path.basename(args.file))[0] + "-beside.png")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out)
    print(out)
    print_score(args.file, res)


def cmd_calibrate(args):
    """Fit the dial to the maintainer's own numbers: FILE=SCORE[:tags] ..."""
    import numpy as np
    g = load_gauge()
    pts = []
    for spec in args.pairs:
        path, _, rest = spec.rpartition("=")
        score, _, tags = rest.partition(":")
        g_ = dict(g, dial={"a": 1.0, "b": 0.0})
        raw = score_against(g_, traits(path), split_tags(tags))["raw"]
        pts.append((os.path.basename(path), float(score), raw))
    if len(pts) < 3:
        sys.exit("refcat: calibrate needs at least three pictures the maintainer dialled")
    x = np.array([p[2] for p in pts]); y = np.array([p[1] for p in pts])
    a, b = np.polyfit(x, y, 1) if x.std() > 0 else (1.0, float(y.mean() - x.mean()))
    g["dial"] = {"a": round(float(a), 4), "b": round(float(b), 2),
                 "fitOn": [{"picture": p[0], "score": p[1], "raw": p[2]} for p in pts]}
    with open(GAUGE, "w", encoding="utf-8") as f:
        json.dump(g, f, indent=1, ensure_ascii=False)
        f.write("\n")
    for p in pts:
        print(f"{p[0]:<40} dial {p[1]:>5.0f}   gauge {max(0, min(100, a * p[2] + b)):>5.0f}")


def cmd_sheet(args):
    """Contact sheets of the pictures with these tags, each labelled with its id. With --atlas the 1991 game's
    rooms most like them go underneath, and with --ours our own picture: what it is, how the game paints it, ours."""
    from PIL import ImageDraw
    cat = load()
    want, without = split_tags(args.tags), split_tags(args.without)
    check_words(want + without)
    keri = on_keri(args)
    picks = [e for e in everything(cat) if matches(e, want, without)
             and (not args.kind or e["kind"] == args.kind) and (keri is None or keri(e))]
    picks.sort(key=lambda e: not e.get("placed", True))  # the photographs placed on the photo map come first
    if not picks:
        sys.exit("refcat: nothing has those tags")
    tw, cols, gap, cap = args.thumb, args.cols, 10, 20

    def label(e):
        if "scenes" in e:
            return f'{e["id"]}  {e["cell"] or ""}{"" if e["placed"] else "?"}'
        if e.get("shared") is not None:
            return f'{e["id"].removeprefix("mi2-")}  {" ".join(t for t in e.get("tags", []) if t in TAGS["place"])}'
        return e["id"]

    def draw(groups, out):
        rows = []  # a heading (a string) or a row of thumbnails
        for head, group in groups:
            if head:
                rows.append(head)
            thumbs = []
            for e in group:
                art = art_pixels(e["path"])
                if max(art.size) > 4 * tw:  # a photograph: shrink it smoothly first
                    art.thumbnail((4 * tw, 4 * tw))
                k = tw / art.width
                th = max(1, round(art.height * k))
                if th > tw:  # very tall: cap the height
                    k = tw / art.height; th = tw
                thumbs.append((art.resize((max(1, round(art.width * k)), th), Image.NEAREST), e))
            rows += [thumbs[i:i + cols] for i in range(0, len(thumbs), cols)]
        H = gap + sum(30 + gap if isinstance(r, str) else max(t[0].height for t in r) + cap + gap for r in rows)
        sheet = Image.new("RGB", (gap + cols * (tw + gap), H), (40, 34, 30))
        d = ImageDraw.Draw(sheet)
        y = gap
        for r in rows:
            if isinstance(r, str):
                d.text((gap, y + 4), r, fill=(255, 255, 255), font=_font(20))
                y += 30 + gap
                continue
            x = gap
            for im, e in r:
                d.text((x, y), label(e)[:tw // 8], fill=(255, 230, 120), font=_font(14))
                sheet.paste(im, (x, y + cap)); x += tw + gap
            y += max(t[0].height for t in r) + cap + gap
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        sheet.save(out)
        print(out)

    name = "-".join(x for x in (args.scene, args.shows, args.cell, (args.tags or "").replace(",", "-")) if x)
    base = args.out or os.path.join(CATALOG, "sheets", name or "all")
    if args.atlas or args.ours:  # one sheet in parts: the pictures asked for, the game's rooms most like them, ours
        first = picks[:args.per_sheet]
        what = "Keri" if all("scenes" in e for e in first) else "asked for"
        groups = [(f'{what}: {name.replace("-", " ") or "all"} ({len(first)} of {len(picks)})', first)]
        if args.atlas:
            like = [dict(e, shared=shared) for e, shared in
                    atlas_like(cat, picks, [w for w in want if w not in ("keri", "ours")], without, args.atlas)]
            if like:
                groups.append(("the 1991 game: the rooms most like them", like))
        if args.ours:
            groups.append(("ours", [{"id": os.path.basename(f), "path": f} for f in args.ours]))
        draw(groups, f"{base}-beside-atlas.png" if args.atlas else f"{base}-beside-ours.png")
        return
    for page in range(0, len(picks), args.per_sheet):
        draw([(None, picks[page:page + args.per_sheet])], f"{base}-{page // args.per_sheet + 1}.png")


# --- setting the atlas up ----------------------------------------------------
# The library lives only on the machine that studies it (d223). On a new
# machine `init` makes the empty shelves and `import` fills them in one go.
# The words and numbers that survive in git (mi2-gauge.json: each measured
# room's id and tags) give a re-imported room its tags back.

SHELVES = {
    # shelf: (folder under the catalogue, id prefix, tags every picture gets, title)
    "mi2-bg": ("game-1990s/mi2-1991/backgrounds", "mi2-bg", ["mi2"],
               "Monkey Island 2 (1991), VGA background"),
    "mi2-screen": ("game-1990s/mi2-1991/screens", "mi2-screen", ["mi2", "screenshot"],
                   "Monkey Island 2 (1991), PC VGA screenshot"),
    "mi3-bg": ("game-1990s/mi3-1997/backgrounds", "mi3-bg", ["mi3"],
               "The Curse of Monkey Island (1997), background"),
    "mi3-inv": ("game-1990s/mi3-1997/inventory", "mi3-inv", ["mi3", "item"],
                "The Curse of Monkey Island (1997), inventory item"),
}
PICTURE_EXT = (".png", ".gif", ".bmp", ".pcx", ".jpg", ".jpeg", ".webp")

README_ROOT = """# The painter's reference library (local only, never committed: d223)

`refcat.py` keeps its catalogue here (`catalog.json`). Every picture is studied
for its approach and never copied, traced or named in the game.

- `game-1990s/mi2-1991/backgrounds/`: Monkey Island 2 as released in 1991, the VGA
  backgrounds without characters (at most 256 colours; the 2010 remake is refused).
- `game-1990s/mi2-1991/screens/`: PC VGA screenshots with characters and the verb band.
- `game-1990s/mi3-1997/backgrounds/part0..4/`, `inventory/`, `sheets/`: the second shelf.
- `questions/`: marked sheets for asking the maintainer (`refcat.py mark`).
- Keri's photographs and the photo map: `private/keri/` (`photos.json`).

Fill a shelf: drop the pictures in its folder, then
`python3 -I .claude/skills/study-a-picture/refcat.py import <folder> --shelf <shelf> --source "<where from>"`.
Name a room `<part>-<room>` (`0-004.png`) so its id is `mi2-bg-0-004`, the id the gauge knows.
"""

README_SHELF = """# {title}

Where these pictures came from (write it down for each batch):

- Source:
- Version (release and platform):
- Added:

Shelf `{shelf}`: ids `{prefix}-<file name>`, filed with
`python3 -I .claude/skills/study-a-picture/refcat.py import private/painter/references/{folder} --shelf {shelf} --source "<the source above>"`.
Never in git (d223).
"""


def cmd_init(args):
    made = []

    def write_new(path, text):
        if os.path.exists(path):
            return
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        made.append(path)

    for sub in ("questions", "game-1990s/mi3-1997/sheets",
                *(f"game-1990s/mi3-1997/backgrounds/part{n}" for n in range(5))):
        d = os.path.join(CATALOG, sub)
        if not os.path.isdir(d):
            os.makedirs(d)
            made.append(d + os.sep)
    write_new(os.path.join(CATALOG, "README.md"), README_ROOT)
    for shelf, (folder, prefix, _tags, title) in SHELVES.items():
        write_new(os.path.join(CATALOG, folder, "README.md"),
                  README_SHELF.format(title=title, shelf=shelf, prefix=prefix, folder=folder))
    if not os.path.exists(catalog_path()):
        save(load())
        made.append(catalog_path())
    keri = os.path.dirname(KERI_MAP)
    if not os.path.isdir(keri):
        os.makedirs(keri)
        made.append(keri + os.sep)
    for m in made:
        print(f"made {m}")
    print(f"refcat: the library is at {CATALOG} ({len(made)} new, nothing overwritten)")


def gauge_rooms():
    try:
        with open(GAUGE, encoding="utf-8") as f:
            return {r["id"]: r["tags"] for r in json.load(f).get("rooms", [])}
    except FileNotFoundError:
        return {}


def shelf_id(prefix, path, root):
    """`<prefix>-<path below root, folders joined by dashes>`, lower case; a name
    that already starts with the prefix is kept (`part0/004.png` gives `mi3-bg-part0-004`,
    `mi2-bg-0-004.png` stays `mi2-bg-0-004`)."""
    import re
    rel = os.path.splitext(os.path.relpath(path, root))[0]
    stem = re.sub(r"[^a-z0-9]+", "-", rel.lower().replace(os.sep, "-")).strip("-")
    return stem if stem.startswith(prefix + "-") else f"{prefix}-{stem}"


def cmd_import(args):
    folder, prefix, base_tags, title = SHELVES[args.shelf]
    known = gauge_rooms()
    cat = load()
    ids = {e["id"] for e in cat["entries"]}
    pixels = {e["pixel"]: e["id"] for e in cat["entries"]}
    files = sorted(os.path.join(d, n) for d, _, ns in os.walk(args.dir) for n in ns
                   if n.lower().endswith(PICTURE_EXT))
    added = skipped = restored = 0
    for path in files:
        eid = shelf_id(prefix, path, args.dir)
        try:
            fp = fingerprint(path)
            colours = look(path)["colours"]
        except OSError as err:
            print(f"skip {path}: {err}", file=sys.stderr); skipped += 1; continue
        if eid in ids or fp["pixel"] in pixels:
            print(f"skip {path}: already {eid if eid in ids else pixels[fp['pixel']]}", file=sys.stderr)
            skipped += 1; continue
        if "mi2" in base_tags and colours > 256:
            print(f"skip {path}: {colours} colours, not the 1991 original", file=sys.stderr)
            skipped += 1; continue
        tags = list(base_tags)
        if eid in known:
            tags += [t for t in known[eid] if t not in tags and t in ALL_TAGS]
            restored += 1
        tags += [t for t in split_tags(args.tags) if t not in tags]
        check_tags(tags, args.new)
        dest = os.path.abspath(path)
        if args.copy:
            dest = os.path.join(CATALOG, folder, os.path.basename(path))
            if os.path.abspath(path) != os.path.abspath(dest):
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copyfile(path, dest)
        cat["entries"].append({
            "id": eid, "kind": "game-1990s", "title": f"{title} {eid[len(prefix) + 1:]}",
            "source": args.source or "", "path": dest, "pixel": fp["pixel"], "dhash": fp["dhash"],
            "size": fp["size"], "pixelScale": look(path)["pixelScale"], "colours": colours,
            "tags": tags, "fed": []})
        ids.add(eid); pixels[fp["pixel"]] = eid; added += 1
        print(f"{eid:<34} {' '.join(tags)}")
    save(cat)
    missing = [r for r in known if r.startswith(prefix + "-") and r not in ids]
    print(f"refcat: {added} added ({restored} with their tags back from the gauge), {skipped} skipped")
    if missing:
        print(f"refcat: the gauge knows {len(missing)} {prefix} rooms not in the library yet, "
              f"such as {', '.join(missing[:5])}")
    untagged = added - restored
    if untagged and prefix.startswith("mi2"):
        print(f"refcat: {untagged} new pictures carry only {' '.join(base_tags)}: tag them "
              "(refcat.py tag ID --tags outdoor,night,...) before refcat.py baseline")


def cmd_list(args):
    for e in load()["entries"]:
        if args.kind and e["kind"] != args.kind:
            continue
        print(f'{e["id"]:<34} {e["kind"]:<13}  {e["title"]}')


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("check"); s.add_argument("files", nargs="+"); s.set_defaults(f=cmd_check)
    s = sub.add_parser("look"); s.add_argument("file"); s.set_defaults(f=cmd_look)
    s = sub.add_parser("add")
    s.add_argument("file"); s.add_argument("--id", required=True)
    s.add_argument("--kind", required=True); s.add_argument("--title", required=True)
    s.add_argument("--source"); s.add_argument("--note")
    s.add_argument("--tags", help="comma-separated, from TAGS (refcat.py tag)")
    s.add_argument("--new", action="store_true", help="allow a tag not in TAGS")
    s.add_argument("--copy", action="store_true",
                   help="copy the picture into references/<kind>/<id>.<ext>")
    s.set_defaults(f=cmd_add)
    s = sub.add_parser("note"); s.add_argument("id"); s.add_argument("text"); s.set_defaults(f=cmd_note)
    s = sub.add_parser("list"); s.add_argument("--kind"); s.set_defaults(f=cmd_list)
    s = sub.add_parser("mark", help="pictures side by side with labelled boxes, for asking the maintainer")
    s.add_argument("out")
    s.add_argument("specs", nargs="+", metavar="FILE@x,y,w,h=LABEL[@...]")
    s.add_argument("--height", type=int, default=600)
    s.add_argument("--zoom-height", type=int, default=220)
    s.set_defaults(f=cmd_mark)
    s = sub.add_parser("pin", help="put a thing, a camera or a noticed detail on the Keri grid")
    s.add_argument("where", help="a cell such as O9, or x,y in metres (d108)")
    s.add_argument("what")
    s.add_argument("--kind", choices=("thing", "camera", "noticed"), default="thing")
    s.add_argument("--bearing", type=float, help="compass degrees the camera looks to (0 north, 90 east)")
    s.add_argument("--from", dest="source", help="catalogue id or doc it came from")
    s.add_argument("--id")
    s.set_defaults(f=cmd_pin)
    s = sub.add_parser("pins"); s.add_argument("--cell"); s.set_defaults(f=cmd_pins)
    s = sub.add_parser("map", help="draw the Keri grid with every pin")
    s.add_argument("out", nargs="?"); s.add_argument("--scale", type=float, default=2.5)
    s.set_defaults(f=cmd_map)
    s = sub.add_parser("tag", help="add or remove tags on entries")
    s.add_argument("ids", nargs="+"); s.add_argument("--tags", required=True, type=split_tags)
    s.add_argument("--remove", action="store_true"); s.add_argument("--new", action="store_true")
    s.set_defaults(f=cmd_tag)
    s = sub.add_parser("find", help="entries with all these tags")
    s.add_argument("--tags"); s.add_argument("--without"); s.add_argument("--kind")
    s.add_argument("--long", action="store_true", help="also print each picture's title and path")
    s.add_argument("--scene", help="Keri photo map: photographs that feed this painted scene")
    s.add_argument("--shows", help="Keri photo map: photographs that show this place (sauna, lighthouse, jetty)")
    s.add_argument("--cell", help="Keri photo map: photographs taken in this cell of the 25 m grid (K7)")
    s.add_argument("--placed", action="store_true", help="Keri photo map: only photographs placed on the photo map")
    s.add_argument("--atlas", nargs="?", type=int, const=8, metavar="N",
                   help="also the N rooms of the 1991 game most like the pictures found (8)")
    s.set_defaults(f=cmd_find)
    s = sub.add_parser("tags", help="the tag set, the families and how many pictures carry each tag")
    s.add_argument("--md", action="store_true", help="as the tables of vocabulary/atlas-words.md")
    s.set_defaults(f=cmd_tags)
    s = sub.add_parser("about", help="a scene or a place of Keri on one page: where, code, photographs, changes, lore")
    s.add_argument("word", nargs="?", help="a scene (knoll, docks) or a place (sauna, lighthouse); none lists them")
    s.set_defaults(f=cmd_about)
    s = sub.add_parser("rooms", help="1991 game screens take the place and subjects of the room they show")
    s.add_argument("--again", action="store_true", help="also screens that have a room already")
    s.set_defaults(f=cmd_rooms)
    s = sub.add_parser("crop", help="file a swatch: a box of a catalogued picture, by subject")
    s.add_argument("id"); s.add_argument("box", help="x,y,w,h in the picture's art pixels")
    s.add_argument("--subject", required=True); s.add_argument("--name"); s.add_argument("--note")
    s.set_defaults(f=cmd_crop)
    s = sub.add_parser("swatches", help="every swatch of a subject on one sheet")
    s.add_argument("--subject", required=True); s.add_argument("--out")
    s.add_argument("--ours", action="append", metavar="FILE[@x,y,w,h=LABEL]")
    s.add_argument("--height", type=int, default=240); s.add_argument("--width", type=int, default=1600)
    s.set_defaults(f=cmd_swatches)
    s = sub.add_parser("sheet", help="contact sheets of tagged pictures, labelled by id")
    s.add_argument("--tags", default=""); s.add_argument("--without"); s.add_argument("--kind")
    s.add_argument("--thumb", type=int, default=320); s.add_argument("--cols", type=int, default=4)
    s.add_argument("--per-sheet", type=int, default=12); s.add_argument("--out")
    s.add_argument("--scene", help="Keri photo map: photographs that feed this painted scene")
    s.add_argument("--shows", help="Keri photo map: photographs that show this place (sauna, lighthouse, jetty)")
    s.add_argument("--cell", help="Keri photo map: photographs taken in this cell of the 25 m grid (K7)")
    s.add_argument("--placed", action="store_true", help="Keri photo map: only photographs placed on the photo map")
    s.add_argument("--atlas", nargs="?", type=int, const=8, metavar="N",
                   help="also the N rooms of the 1991 game most like the pictures found (8)")
    s.add_argument("--ours", action="append", metavar="FILE", help="our own picture(s), as a last part of the sheet")
    s.set_defaults(f=cmd_sheet)
    s = sub.add_parser("baseline", help="measure the MI2 rooms into the gauge's ranges")
    s.add_argument("--shrink", action="store_true", help="allow rooms the library lacks to drop out")
    s.set_defaults(f=cmd_baseline)
    s = sub.add_parser("init", help="make the empty library on a new machine; never overwrites")
    s.set_defaults(f=cmd_init)
    s = sub.add_parser("import", help="catalogue a folder of pictures on one shelf in one go")
    s.add_argument("dir"); s.add_argument("--shelf", required=True, choices=tuple(SHELVES))
    s.add_argument("--source", help="where the batch came from (also in the shelf's README)")
    s.add_argument("--tags", help="extra tags for every picture of the batch")
    s.add_argument("--new", action="store_true", help="allow a tag not in TAGS")
    s.add_argument("--copy", action="store_true", help="copy each picture into its shelf's folder")
    s.set_defaults(f=cmd_import)
    s = sub.add_parser("gauge", help="how MI2 a picture is, trait by trait")
    s.add_argument("files", nargs="+"); s.add_argument("--tags", default="")
    s.add_argument("--json", action="store_true")
    s.set_defaults(f=cmd_gauge)
    s = sub.add_parser("beside", help="ours over the closest MI2 rooms, with the gauge")
    s.add_argument("file"); s.add_argument("--tags", default=""); s.add_argument("--n", type=int, default=3)
    s.add_argument("--width", type=int, default=960); s.add_argument("--out")
    s.set_defaults(f=cmd_beside)
    s = sub.add_parser("calibrate", help="fit the gauge's dial to the maintainer's numbers")
    s.add_argument("pairs", nargs="+", metavar="FILE=SCORE[:tags]")
    s.set_defaults(f=cmd_calibrate)
    import re
    # x,y with a negative x ('-60,40') would read as an option: hide its dash
    argv = [" " + v if re.match(r"^-\d+(\.\d+)?,-?\d", v) else v for v in sys.argv[1:]]
    a = p.parse_args(argv)
    a.f(a)


if __name__ == "__main__":
    main()
