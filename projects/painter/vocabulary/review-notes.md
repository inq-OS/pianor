# Art review notes: what reviews tend to miss or overrate

The `art-review` skill (d122) writes here when the maintainer's verdict differs from a review, so the next review learns. Each note is a lesson for the reviewer, newest first.

## Smooth skies (the southern harbour)

- **A sky and open water are smooth, as in MI, with the details and buildings in pixel art.** A low `lone` there is not too little grain. A question about grain can be read two ways: ask or look before building.
- **Why MI2's sky reads smooth with `lone` near 0.2:** its grain is between many near tones (80 to 100 colours in a patch of sky). Ours was 11 tones with steps of up to 8 of lightness, a dither and long strokes. The gauge's `lone` cannot tell the two apart. In the sky and on open water `lone` is not to be chased; count the tones and the size of their steps.

## Level lines on built things (the southern harbour)

- **Do not overrate the level line.** A built quay seen side-on and a sea horizon may be level (the docks keep a straight horizon); the quirk belongs in the things: the boats, the arches, the wonders under the water. A reviewer weighs a level line less on a built thing and on the sea, and more on what stands on them.
- **What reviews catch well:** lawn-like weed at a quay's foot, a lantern that reads as a pause button, boats sitting on a grained quay like clean stickers, and the copy check of own boats beside the reference screenshots.
- **The gauge and grain:** turning the grain up alone moves `lone` into range but pushes `dither` out (two tones alternating make checkerboards) and the score falls. Mixing four or five near tones is what the scanned paint has; see the scene's notes before chasing the number.

## Does it read as its material (the room)

- **Ask of each new thing, before anything else: covered up to its outline, what would I say it is made of?** Paper is known by thin leaves, edges that waver, sheets that droop and lie askew, and a warm shade; a book by a pale strip of pages and a rounded back. Slabs 2.2 cm thick with ruled edges read as stone, not fat paper. Put the thing beside the atlas room at the same size and name the material each reads as.
- **A word of direction can be read two ways: look at the example sent with it before building.** Fat paper was the pile in the map maker's office (as high as it is deep, its side shown), not a thick sheet.

## Loud colour and busyness (the room)

- **Measure loud colour by hand: the gauge misses it.** The gauge's `saturation` counts dark browns as saturated, so it cannot tell a dark brown room from a bright orange one. Count the share of pixels both bright and strongly coloured (CIELAB chroma over 55 at L* over 45): the atlas's indoor day rooms have 1 to 3%. Until the gauge has the trait (TODO in `docs/keri/scene-room.md`), say it in the review.
- **Busyness is pattern, not pixel noise.** The atlas's rooms have more single-pixel change than ours (scanned paint), yet read calm: one hue family a room, big plain surfaces, a pattern only on one or two things. A reviewer counts the surfaces that carry a fine pattern.
- **Do not chase the gauge's points.** Grain added for `lone` makes the pictures grainy. A number from the gauge is no reason to add anything the eye did not ask for.

## The request a reviewer gets (the docks)

- **Missed context, not a missed eye:** the first review called the tower on the rock and the timber jetty "invented", because the request held the photographs but not the description of the scene (a small roofed tower on top of the rock, not a modern instrument house). Fixed in the skill: `request.md` states the description of the scene in plain words, and the reviewer treats it as Keri.
- **Copy guard gap:** it compared only the library (`mi2-...`), not the MI2 screenshots sent for the scene. Fixed: catalogue kind `game-1990s` counts too.
- **A dHash `loose` hit is often chance:** docks dawn against an underwater wreck at distance 17. Look side by side before calling it anything.
