---
name: use-free-art-packs
description: Use before drawing any icon, sprite, panel, frame, tile, effect or other UI art in pianor, to check the free CC0 pixel packs first and bring a fitting piece in under d084.
---

# Use free art packs before drawing

Rule: [d084](../../../docs/decisions/art.md#d084). Standard shapes (arrows, check, cross, lock, gear, key, cursor, frames, sparks, tiles) come from a free pack; draw your own only when nothing fits or the thing is the game's identity (Kiur, the monsters, the staff).

## 1. Will it fit?

The art canvas is 640 x 360 fine pixels (d110); layouts, the font and most sprites count in cells of 2 x 2 fine pixels (320 x 180 cells). A background that needs depth and light (a room, a map, a scene) is not made from packs: it is painted by code (`docs/art-direction.md`, d111). A pack fits only if it is **real pixel art (hard edges, no soft alpha) at roughly our size, 5 to 32 px**. Our button icons are 10 to 17 px, Kiur 24 x 29, tiles 16 px, battle monsters up to 64 x 48.

**Vector or soft packs are shape reference only**, never imported: Kenney `game-icons`, `ranks-pack`, `foliage-sprites`, `particle-pack`, `board-game-icons`, `smoke-particles`. Shrunk to 12 px they turn to mush.

## 2. Look here first (all CC0 unless marked)

| Need | Pack |
|---|---|
| Menu panels, dialog frames, dividers, corners | Kenney `fantasy-ui-borders` (24 px, one colour; the PNG is drawn at 2x, halve it exactly); Kenney `pixel-ui-pack` (48 px 9-slice) |
| Button icons, arrows, lock, "?", hands, pointer | Kenney `cursor-pixel-pack` (16 px, already black outline); Kenney `1-bit-pack` (16 px, about 1000 tiles; the person, key and gear icons came from it) |
| Map markers, tiny glyphs | Kenney `minimap-pack` (8 px), `micro-roguelike` (8 px) |
| Kiur's reactions | Kenney `emotes-pack`, pixel style (16 px); objective only, no praise bubbles (AX-2) |
| Prize and item icons | OGA "496 pixel art icons for RPG" (7Soul1, 32 px) |
| Small tiles and props | Kenney `tiny-town`, `tiny-farm` (16 px); OGA "Zelda-like tilesets" (ArMM1998; keep it from looking like the franchise) |

Kenney: `kenney.nl/assets/<name>`. OGA: opengameart.org, licence per file on the author's page.

## 3. Licence check

CC0 first; CC BY and CC BY-SA with a credit; SIL OFL for fonts. **Never** NC, ND, "personal use", unstated licences, ripped or franchise art (no Pokémon, Zelda, Mario looks), AI-generated images.

## 4. Bring it in

1. Take only the pieces used, never a whole pack.
2. Small art (up to about 32 px): copy it as rows of letters into a file in `src/game/ui/pixel/` (example: `iconArt.ts`), mapped to the palette (`palette.ts`) with the black ink outline. One-colour packs need only a colour swap. A comment above each bitmap names pack and licence.
3. Bigger files loaded as images: `public/assets/<pack>/` with the pack's `LICENSE` beside them.
4. Never scale by a fraction; mixed styles on one screen are a defect. If it cannot be mapped cleanly, redraw it or leave it out.
5. Add a row to `docs/assets.md` (what, where, source URL and author, licence, credit). CC BY or CC BY-SA also goes on the credits screen through a string key.
6. Say in the PR which pack you used, or why none fit.
