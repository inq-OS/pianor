# Rocks

## Heaped round boulders at night by the water
- A boulder is a heap of fat round lumps, each lit in a few flat bands (top pale, belly mid, underside dark), never a smooth gradient or speckled texture.
- A hard, dark seam runs where two lumps meet; the outer edge has a dark line too, so each lump reads as a cartoon shape.
- The light is one hue at night (blue to near-white), the shade side goes almost to the ink.
- Ours: `docksPicture.ts` `boulder()` paints heaped lumps in three flat bands with dark seams between lumps and an ink outline (pass 3). `knollPicture.ts` still paints its stones as one speckled grey run.
- TODO(painter, R2): give the knoll's stones and the corner rocks of other pictures the same flat bands, seams and outline (the aim of about 70 percent of MI2, docs/art-direction.md section 1).

## Rock in the 1991 game, by day and night (swatches rock-1 to rock-3)
- **Day cliff of red-brown stone (rock-1):** lumps in four or five warm tones with dark seams, a green top hanging over the edge; 162 colours.
- **Grey cliff face (rock-2):** slabs of grey-violet with dark cracks, lit faces almost white, lichen as single yellow-green pixels.
- **Night boulders (rock-3):** heaped lumps in three blues with near-black seams, the same build as the Scabb dock boulders above.
- Steps 6.6 to 7.5 L*, about 40% lone grain: the surface is paint grain, never a texture of speckles on one tone.

## Rocks standing in shallow water (the ellipses marked on mi2-bg-0-004)
- Every rock is a wedge or a slab that leans, never a ball: a slanted top plane two tones paler than its faces, one face toward the light and one two tones darker, the edge between them a dark line from the peak down.
- They stand in groups of three to six that lean the same way, a big one with small ones before and beside it; single rocks are rare.
- At the foot the water is paler and broken into short strokes; the rock's lowest row is its darkest.
- Ours: the map's rocks follow this (`slab` in `mapPicture.ts`); the kit's boulder is still a heap of round lumps. IDEA(painter): a kit type `slab` for rocks in water, for the docks and the knoll's shore.


## Rocks on the 1991 island map (the circles marked on mi2-bg-0-002)
- No two rocks of the map are alike: a low flat one, a tooth, a pair, a stack; the sizes run from a few pixels to one stack as tall as a house of the map's town. The absurdly oversized one is the one to keep.
- No ring lies round a rock. A few short pale arcs of unlike length lie before it at unlike distances, and a darker broken stroke under its foot; our rings were too even and orderly.
- A foot is never one level row: it is ragged, lifts at its ends and is the rock's darkest part.
- A rock near a place is part of the shore (a head of a reef with small ones about it), never a lone stone off it: ours at the docks looked as if accidentally dropped there.
- Ours: `rock`, `slab`, `ripples` and `giantRock` in `mapPicture.ts` (five builds by seed, tint and weed by seed).
