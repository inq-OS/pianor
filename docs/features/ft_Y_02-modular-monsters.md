---
id: "ft_Y_02"
title: "Modular monsters"
scope: "A base body plus parts, more parts at higher levels; seeded recipes"
effort: "medium"
status: "on hold (d129): waits on the maintainer's answer on what carries over into challenges. Was: idea, refined"
completeness: 0
depends_on: ["ft_Y_11"]
---
# ft_Y_02: Modular monsters

**On hold (d129: no battles, challenges with characters instead):** this was designed as part of a fight. What of it carries over into the challenges of [ft_1_21](ft_1_21-challenges-with-characters.md) waits on the maintainer (see the section What must come from the maintainer in ft_1_21); do not build it until then.

Phase: after the MVP. Status: idea, refined; not scheduled. Index: [FEATURES.md](FEATURES.md).

**Update:** the drawing machinery (colour ramps and slots, bases with sockets, parts with layers and frames, the pure composer, the render and contact-sheet tools) is its own feature, ft_Y_11, designed in `docs/sprites.md` (d051). This feature keeps what is about monsters: the part costs and budget, sizes by level, the seeded generator, strength from level, and which monster the student meets. Where the sections below and `docs/sprites.md` differ on how pictures are drawn (sockets as paths with hand overrides instead of arcs only), `docs/sprites.md` is the newer and confirmed design.

The game has one monster picture, and this note says how monsters can grow from there. Numbers are first guesses, to be tuned when the work is planned.

## The idea

A monster is a **base body plus parts**. A level 0 monster is a bare base, a round blob with a simple face (two eyes and a mouth, so it reads as a creature), and level 0 monsters differ only in colour. As its level rises, a monster gains parts: more eyes, legs, tails, ears or horns, arms, wings, an aura. An eight-eyed, eight-legged, two-tailed winged demon is a high-level monster. The student can see how strong a monster is from how it looks, and every monster is a little different without anyone drawing each one.

## Parts and their cost

A monster of level L has a budget of **2 x L points** (provisional) to spend on parts. Style variants (cat or bunny ears, bat or feather wings, flame or sparkle aura) cost nothing; only how much a monster has costs points.

| Part | Attaches | Counts | Cost | Drawn |
|---|---|---|---|---|
| Eyes | face | 1 or 2 (the base face), 3, 4, 6, 8 | 0 for 1 or 2; 1 for 3 or 4; 2 for 6; 3 for 8 | in front |
| Mouth | face | 1 | 0 (smile, open), 1 (fangs) | in front |
| Ears or horns | top | a pair | 1 (ears), 2 (horns) | behind |
| Arms | sides | a pair | 2 | in front |
| Legs | bottom | 2, 4, 6, 8 | 2 per pair | front pair in front, the rest behind |
| Tail | back | 1 to 3 | 2 each | behind |
| Wings | upper back | a pair | 4 | behind |
| Aura | around | 1 | 3 | behind everything |

The demon: 8 eyes (3), fangs (1), horns (2), 8 legs (8), 2 tails (4), wings (4) is 22 points, a level 11 monster.

- **Size grows with level** so the parts have room: a small base up to level 3, medium up to 7, large above. Six or more legs and wings need a medium base or larger.
- **Strength grows with level:** HP and potential XP come from the level (numbers in JSON). Later the difficulty estimator (core_08) ties them to the piece being played.
- **Which monster the student meets:** around the student's own level. The encounter rule belongs to the battle work, not to this note.

## Colour

Each monster has a body colour and an accent colour, each a ramp of three shades (dark, mid, light). Parts and bases are drawn with slot letters: the body ramp, the accent ramp, and fixed colours (outline, eye white). A level 0 monster is the bare blob in one of these colour pairs. Today's palette (`src/game/ui/pixel/palette.ts`) has full ramps only for blue and gold, so monsters need a few more (purple, green, orange, red: about twelve colours), recorded in `docs/assets.md` as original.

## How it would be built

- **Recipe:** a small JSON describing one monster: base, size, colours, and the parts (kind, style, count). Named monsters made by hand are recipes in content/monsters/; random ones come from a seeded generator, `(seed, level) -> recipe`, using `src/core/random.ts`, so the same seed and level always give the same monster, and a defeated monster can be saved as its seed or its recipe. Recipes have a `schemaVersion` like all content.
- **Parts and bases are content, not code:** bitmaps as palette rows in JSON (the pixel kit's format: `fromAscii`, `flipX`, `recolor` in `src/game/ui/pixel/bitmap.ts`), each with a pivot point, a layer (behind or in front of the body), whether a pair is drawn mirrored, and two to four animation frames. Adding a part or a base needs no engine code.
- **Where parts go:** a base defines, for each kind of part, an arc or region on its outline (legs along the bottom arc, horns along the top), and the parts spread evenly along it, so 2 legs and 8 legs both fit the same base. Eyes use a fixed layout for each count.
- **Composer** (pure): recipe to RGBA frames, composited once into one texture per frame. ft_0_13 found that many small game objects and canvas textures are slow, so a monster is one image per frame, drawn at the whole-number zoom like the rest of the pixel art.
- **Animation:** legs step, wings flap, a tail sways, eyes blink, the aura pulses; when hit, the monster flashes white and squashes.
- **Fits the battle stage:** the size classes have fixed canvases, small 32 x 28, medium 48 x 40 and large 64 x 48 art pixels, drawn at 1x and never scaled up; the large one stands on the 64-pixel battle stage, so the staff keeps its size (ft_0_16).
- **Tests:** the same recipe gives the same image (golden hashes for a few recipes); the same seed and level give the same recipe; the generator never spends more than the budget or exceeds a part's count; mirrored pairs are symmetric; no part is cut off at the sprite's edge; every level from 0 to 12 makes a valid monster for a few hundred seeds.

## To decide later

- **Visible damage:** parts fall off as the monster loses HP, and the last ones pop off when it is defeated.
- **Parts with battle traits** (wings dodge one hit, an aura shields, horns hit harder): this would make looks part of the rules, so it is a game-design decision for the battle work, not part of the look.
- **A bestiary:** the monsters a player has defeated, kept per player as recipes.
- **Names from parts** through string keys ("Eight-eyed Flapblob").
- **More bases:** a long slug, a ghost drop, a box golem, each with its own attach arcs.
- **Fun-scary, never frightening:** the target player is 7. Check the high-level monsters with the student before many of them exist.

## Rules it keeps

Original art only: "Pokémon-style" means the feel, never their creatures. All text through string keys. Monster looks are data, and the battle rules stay in core/battle and never read pixels.
