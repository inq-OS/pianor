---
id: "au01"
summary: "The two files of a piece (ABC and meta), with an example"
---
# au01: Piece files (ABC and meta)

Part of [piece authoring](AUTHORING.md).

**Authoring format: ABC notation** (a plain-text standard, easy for humans and LLMs to read and write). Read by our own strict parser (`src/core/piece/abc.ts`, no dependency). abcjs was tried and rejected for this job: it understands fingerings, voices and clefs, but silently accepts accidentals, tuplets and repeats and gives no line numbers, and the compiler must refuse what the game cannot show. The rest of the pipeline only sees the chart JSON.

**Sidecar meta file** (`piece.meta.json`) carries everything ABC doesn't: level, phrases, tags, status and provenance.

```
content/pieces/<id>/piece.abc
content/pieces/<id>/piece.meta.json
build/charts/<id>.chart.json      # generated, not committed
```

Example `piece.abc` (right hand, C position, 4/4, level 1: steps only):

```
X:1
T:Little Steps
M:4/4
L:1/4
Q:1/4=70
K:C
V:RH clef=treble
!1!C !2!D !3!E !4!F | !5!G2 !4!F2 | !4!F !3!E !2!D !1!C | !1!C4 |]
```

Example `piece.meta.json`:

```json
{
  "id": "little-steps",
  "title": "Little Steps",
  "titles": { "et": "Väikesed sammud" },
  "level": 1,
  "status": "draft",
  "hands": ["RH"],
  "phrases": [{ "name": "Steps", "bars": [1, 4] }],
  "styles": ["original"],
  "tags": ["c-position", "stepwise"],
  "source": "original",
  "license": "CC0-1.0",
  "generator": { "kind": "manual" }
}
```

`titles` is optional: the title per language (only `et` is read so far). The game shows the Estonian title in Estonian and the `title` where none is given (ft_0_18.AC4). `styles` names the piece's styles from the closed list in `content/pieces/styles.json` (`folk`, `classical`, `exercise`, `original`; more than one is allowed). `piece:lint` makes a word that is not on the list an error and a piece with no style a warning; an own piece in `private/pieces/` needs none. To add a style, add it to that file with a name key in `src/core/text/strings.ts`. `tags` is a free list for technique and provenance (`c-position`, `generated`); it is not shown as a style ([d066](../decisions/notation.md#d066)). `difficulty` is optional: how hard the piece is on the one scale of [d138](../decisions/game.md#d138), a whole number from 1 to 10, separate from `level`; a character's phrases carry their tug level as their difficulty (1 to 3).

Fingering uses ABC decorations `!1!`-`!5!`. `status` is `draft` until a human sets `approved`. `contentVersion` (optional, default 1) goes up when a piece is edited. `unlockLevel` (optional) places the piece in the list, before `level`; it locks nothing. It defaults to `level` (the curriculum level). Lower it for a piece the player should meet early. In the game, drafts show only on the dev server; a production build offers approved pieces only.
