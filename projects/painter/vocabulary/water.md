# Water

## The sea in the 1991 game (swatches sea-1 to sea-7)
- **Day, open water (sea-1, sea-4):** four or five blues laid as short horizontal dashes, 2 to 3 pixels long, lighter dashes on the near side of each swell; a one-pixel pale line at the horizon. Darker towards the viewer, never lighter. 73 to 123 colours in a strip.
- **Round things in the water (sea-2):** curved, rope-like light rings around each post, dark under the post; the rings get wider and further apart away from it. 134 colours, a third of the pixels lone grain.
- **Surf on a beach (sea-3):** a ragged near-white foam band one to four pixels high, turquoise shallows above, deep blue beyond. The foam edge on the sand side is a hard line, on the sea side it breaks into dots.
- **Night (sea-5, sea-7):** two or three blues, the sea almost flat; lights on the water are short vertical streaks of 2 to 6 pixels under their source, never a round blob. Surf at night is the lightest thing in the picture (near-white blue), with near-black rocks right against it.
- **Storm at dusk (sea-6):** a pale streak at the horizon, below it broken horizontal bands of grain, lighter in the middle distance.
- Steps between neighbours 3.5 to 10.6 L*, checkerboards about 1 to 2%, lone grain 8% to 38%.
- Ours: the docks' sea (`docksPicture.ts`) is closest to sea-1; its night has no light streaks.
- IDEA(painter): lights on night water as 2 to 6 pixel vertical streaks under each lamp and the lighthouse.

## Sand under clear water, from the air (a reference drone photograph of Keri's south-east strip)
- A sand bank under shallow water is no colour of the land: the sea over it turns from blue through green to a pale sand where the sand nearly breaks the surface, in bands that follow the bank's edge.
- A thin broken white line lies where the sea breaks on its shallowest ridge, on one side more than the other.
- The strip is long, thin where it leaves the land and broader further out, and it bends: from above it reads as a creature under the water.
- Mixing sea blue with sand yellow gives grey, which a palette snaps to stone. The green between them has to be colours of its own (the map's `SHOAL_DAY`); at dawn, dusk and night the sea's own paler tones do it.
- Ours: `sandColour` in `mapPicture.ts`. The docks' and the knoll's shallows have no sand yet.
