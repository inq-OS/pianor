#!/usr/bin/env python3
"""Gauge, copy guard and side-by-side sheets for one art review.

    python3 .claude/skills/art-review/review.py OUT_DIR PICTURE[=tag,tag]...

Each PICTURE is a PNG of ours (one hour of one scene). Its tags pick the MI2
rooms it is measured against, for example `docks-day.png=outdoor,day`
(without tags: the setting and hour read from the file name, else all rooms).
Writes into OUT_DIR (a local folder, never in git, because the
sheets hold MI2 pictures):

    gauge.json      every picture's gauge and copy-guard hits
    gauge.md        the table for the review comment
    beside-<name>.png  ours over the 3 nearest MI2 rooms, with the gauge

Exit code 2 when the copy guard blocks (a picture within the near distance of
an MI2 picture), else 0. The tool behind it is study-a-picture's refcat.py.
"""
import json
import os
import subprocess
import sys

sys.dont_write_bytecode = True  # importing refcat must leave no __pycache__ in the skill
HERE = os.path.dirname(os.path.abspath(__file__))
REFCAT = os.path.join(HERE, "..", "study-a-picture", "refcat.py")
HOURS = ("dawn", "day", "dusk", "night")


def refcat(*args):
    out = subprocess.run([sys.executable, REFCAT, *args], check=True,
                         capture_output=True, text=True)
    return out.stdout


def guess_tags(path):
    name = os.path.basename(path).lower()
    tags = ["outdoor"]
    for h in HOURS:
        if h in name:
            tags.append(h)
            break
    return tags


def parse(arg):
    if "=" in arg:
        path, tags = arg.split("=", 1)
        return path, [t for t in tags.split(",") if t]
    return arg, guess_tags(arg)


def guard(path):
    """MI2 pictures within the loose distance; `near` blocks."""
    hits = json.loads(refcat("check", path))[0]["seen"]
    # The atlas library (mi2-...) and any other game picture in the catalogue
    # (kind game-1990s, such as MI2 screenshots studied for one scene).
    return [h for h in hits
            if h["id"].startswith("mi2-") or h.get("kind") == "game-1990s"]


def nearest(path, tags, n=3):
    """The ids of the n nearest MI2 rooms, as beside picks them."""
    # refcat's gauge JSON has no room ids; beside prints its sheet only, so
    # read them from the library through refcat's own functions.
    sys.path.insert(0, os.path.dirname(REFCAT))
    import refcat as rc  # noqa: E402
    g = rc.load_gauge()
    return [r["id"] for r in rc.nearest_rooms(g, rc.traits(path), tags, n)]


def fmt(v):
    if isinstance(v, float):
        return f"{v:.3f}" if abs(v) < 1 else f"{v:.1f}"
    return str(v)


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    out_dir = argv[1]
    os.makedirs(out_dir, exist_ok=True)
    results, blocks = [], False
    for arg in argv[2:]:
        path, tags = parse(arg)
        g = json.loads(refcat("gauge", path, "--tags", ",".join(tags), "--json"))
        g = g[0] if isinstance(g, list) else g
        hits = guard(path)
        blocks |= any(h["match"] in ("exact", "near") for h in hits)
        name = os.path.splitext(os.path.basename(path))[0]
        sheet = os.path.join(out_dir, f"beside-{name}.png")
        refcat("beside", path, "--tags", ",".join(tags), "--out", sheet)
        results.append({"name": name, "tags": tags, "gauge": g, "guard": hits,
                        "nearest": nearest(path, tags), "sheet": sheet})

    with open(os.path.join(out_dir, "gauge.json"), "w") as f:
        json.dump(results, f, indent=1)

    calibrated = all(r["gauge"].get("calibrated") for r in results)
    lines = ["| Picture | Against | Score | Off range (ours vs MI2 low to high) | Nearest rooms | Copy guard |",
             "|---|---|---|---|---|---|"]
    for r in results:
        off = [f'{t["trait"]} {fmt(t["ours"])} vs {fmt(t["mi2Low"])}-{fmt(t["mi2High"])}'
               for t in r["gauge"]["traits"] if t["move"]]
        hit = ", ".join(f'{h["match"]} {h["id"]} ({h["distance"]})' for h in r["guard"]) or "clear"
        lines.append(f'| {r["name"]} | {" ".join(r["tags"])} ({r["gauge"]["rooms"]} rooms) '
                     f'| {r["gauge"]["mi2"]}% | {"; ".join(off) or "none"} '
                     f'| {" ".join(r["nearest"])} | {hit} |')
    lines.append("")
    lines.append("Gauge: " + ("calibrated to the maintainer's dial." if calibrated else
                 "not yet calibrated to the maintainer's dial (MI2 rooms read about 100%)."))
    if blocks:
        lines.append("COPY GUARD: BLOCKS. A picture is within the near distance of an MI2 picture.")
    with open(os.path.join(out_dir, "gauge.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines))
    return 2 if blocks else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
