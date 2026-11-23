# The template character: how it is made and what is set

ft_1_24 (d142, d144). Code: `src/game/ui/pixel/actors/`. Sheet: `npm run art:render -- figures [day|dawn|dusk|night]` (written to `test-logs/art/figures-<hour>.png`). The passes shown for review are, `painter/characters/` (sketch 1, pass 1 with its art review, pass 2).

## Direction

- Sketch 1 (three proportions in the docks): proportion A; characters imitate MI2 as closely as possible and aim higher than the 70% scene dial.
- Pass 1 (fine grid): the figures were more detailed than MI2's (the finer grid) and sat at about 70% on the dial; go further toward MI2.
- Pass 2 (MI2's grid): accepted and locked.

## What the 1991 people taught (studied on the atlas, never copied)

- No line round a figure; the shaded edge is simply the deepest tone of its material.
- Strong, saturated bands: five tones per material, cool in the shade and warm in the light.
- Big noses and big boots, a wide stance, the near foot forward; coats show their lining at the hem.
- One pixel for an eye, one for the mouth, on the 320-wide grid; the face is set by hand, never cast from shapes.
- People are lit like the picture they stand in: dark at night, warm at dusk.

## How it is made

1. `figureModel.ts`: a puppet in fine pixels, y up, feet at 0. Each layer adds shapes (capsule, ellipse, polygon) with a z order and a material; arms and legs are two-bone limbs. `castFigure` samples the shapes on g x g blocks (g = 2), shades each block from its normal against a light from the upper front, adds the contact shadows, then sets the face. A ghost fades at its feet.
2. `ramps.ts`: `ramp(mid)` makes the five tones from a mid tone; skins are set by hand (a made ramp turns skin red); `ghostly` makes a ghost's sea-green.
3. `features.ts`: `FEATURE_SET` (every option of every key), `lookFromFeatures`, `generateFeatures(seed)` for walkers and visitors (never a ghost, a held thing or a pocket), the six sample people.
4. `states.ts`: idle 3 fps, talk 6, listen 2, play 4 (only with a sax; anyone else idles), walk 8.
5. `figure.ts`: `figureFrames(features, state, { scale, hour })` doubles the cast to fine pixels and lights it by the hour; `templateActorNumbers` gives the `ActorDef` numbers. The frame is 72 x 104 fine pixels at size 1 and grows with the size.

## A new layer or option

Add the option to `FEATURE_SET`, draw it in the layer's builder in `figureModel.ts` (a few shapes, never a bitmap), look at the sheet at every hour, and let `figure.test.ts` check that it draws and changes the picture. A named character's own thing (the teacher's folder and metronome) is an option like any other.

## The student: the student (d154)

The players look like a young student. Three proportions on the template were shown; A, about three heads, was picked.

- `age: child` swaps in `BODY_CHILD` and a child's face. What made a small grown-up read as a child, in order: a round head as big as a grown-up's (headW 0.98), the face set low under a big skull (`CHILD_FACE_LOW`), a snub nose (the grown-ups' MI2 noses make a child look like a little old man), no neck, one rosy cheek pixel. Shrinking body A alone did not do it.
- A child in the foreground reads best at a place's size 1.3 to 1.4; beside a grown-up at the same depth, size 1.
- Grey or ash hair on a child under a beanie reads as an old woman: keep children's hair in the browns and reds.
- Art review 1: a dark hair ramp's two shade tones are near black (`ramp` collapses them), which made a black slab on the back of a child's big head; a child's shaded hair is now `childHairShade`, and its skin never takes the deepest tone (it read as stubble). Grown-ups keep both as locked.
- The student's outfit: a striped shirt, like a seaman's, and a red hat. Drawn as navy stripes on off-white (`sail`) and a red stocking cap with its tip flopped back, kept clear of known characters (no red-and-white stripes, no bobble, no brimmed red cap: that read as a famous plumber in the first try).
- The other two sample children (`SAMPLE_CHILDREN`) are outfits only.

## Still to do

- The small map version for the walkers of ft_1_24 (walkers on the map).
- `ActorDef.template` in the core contract (the 10x dev, d142).
- From the student's art review 1, for when figures stand in scenes for real: the red ramp's light tone is salmon and reads as a pink stripe on a red sweater; a bonfire or lamp beside a figure should warm it at dusk and night; the template lights from the upper front, so at dusk a figure can be lit from the side away from the sun.
- More held things as characters need them (a rake, a fishing net, an accordion), each when its character is built.
