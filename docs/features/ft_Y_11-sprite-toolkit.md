---
id: "ft_Y_11"
title: "Sprite toolkit"
scope: "Colour ramps and slots, bases and parts as content, a pure composer, render, contact-sheet and lint tools, a sprite preview page"
effort: "medium"
status: "planned; design confirmed, not scheduled"
completeness: 0
---
# ft_Y_11: Sprite toolkit

The machinery for making, keeping and using pixel art, so monsters (ft_Y_02), Kiur's outfits and later characters are data drawn once and reused in many colours. Design: `docs/sprites.md`; decisions: `docs/decisions/art.md#d051`. Comes before or with ft_Y_02. Index: [FEATURES.md](FEATURES.md).

## Scope

1. **Palette ramps:** the palette grows to about 32 colours, grouped into named ramps of three shades; a list of allowed body and accent colour pairs in content. Recorded in `docs/assets.md`.
2. **Slot drawings:** bitmaps drawn in slot letters (outline, body dark/mid/light, accent dark/mid/light, eye white, pupil, mouth, teeth) and filled from ramps when composed.
3. **Bases and parts as content** with zod schemas and `schemaVersion`: a base per size class with its sockets (paths, mirrored points, eye centre, per-count overrides) and ground row; a part with pivot, layer, sizes and frames per animation; a kinds table; animation timelines.
4. **Composer** (pure, in the planned src/core/sprite/ module): recipe + catalogue + animation + frame to an indexed bitmap, by layer, with mirroring, socket spreading, eye layouts, frame fallback and an optional outline pass. The bitmap operations of `src/game/ui/pixel/bitmap.ts` move with it; the game keeps the RGB palette and textures.
5. **Recipes:** the monster format version 2 accepts a recipe or a fixed picture, with a tested migration from version 1. content/monsters/wobble.json keeps its drawn picture.
6. **Tools** (planned, tools/sprite/): render to an upscaled PNG, contact sheet, content lint (in `npm run check` and CI), palette export as `.gpl`, import from an indexed PNG. A PNG writer on Node's `zlib`, no new dependency.
7. **Game glue:** compose all frames once, pack into one RGBA sheet, one texture, Phaser frames and animations; a monster is one sprite.
8. **Sprite preview page** in the preview tool: browse parts and bases, edit a recipe and see it composed, play the animations at real zoom on the battle strip. No approve button: art has no approval gate.
9. **Project skill** for agents (`.claude/skills/pixel-sprite/SKILL.md`, planned): the look-and-fix loop of `docs/sprites.md` section 4 and the drawing checklist, written after the tools exist.
10. **Starter content:** the blob base in three sizes and one style of each part kind of ft_Y_02, drawn by an agent with the loop and shown to the maintainer as a contact sheet.

Not in this feature: the generator, budgets and encounter rules (ft_Y_02); visible damage, bestiary and the other extensions in `docs/sprites.md` section 7.

## Acceptance criteria

The composer is pure and passes the coverage gate; golden hashes for a few recipes; property tests (mirrored pairs symmetric, nothing drawn on the canvas edge, every part fits the sizes it claims, frame fallback works, every colour pair passes the contrast check); the content lint catches a bad row width, an unknown slot, an unknown part id and a pivot outside the drawing; the PNG writer's output opens in a browser and matches the bitmap (a test decodes it); version 1 monster files migrate; the battle screenshot shows a composed monster; the maintainer has looked at the contact sheet of the starter parts and is happy with the look [human].

## Settled

No approval gate for art; the composer in core; sockets as paths with hand overrides; Wobble keeps its drawn picture; no monster maker; AI image generators out for now. Details in `docs/sprites.md` section 9 and d051.
